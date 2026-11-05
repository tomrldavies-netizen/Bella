import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { isNetworkError } from './network'

/**
 * Changes made without signal are kept here (on this phone) and sent, in
 * order, as soon as there's signal again (SPEC §4.9). Inserts carry their own
 * id, so a retry after a dropped connection can't create a duplicate.
 * Later edits simply apply after earlier ones: the newest edit wins.
 */
export type OutboxOp =
  | { id: string; at: string; kind: 'insert'; table: string; row: Record<string, unknown> }
  | { id: string; at: string; kind: 'update'; table: string; rowId: string; patch: Record<string, unknown> }
  | { id: string; at: string; kind: 'delete'; table: string; rowId: string }
  | { id: string; at: string; kind: 'rpc'; fn: string; args: Record<string, unknown> }
  /** Mark a dose given. If someone else already gave it, it's still recorded (it was given) and flagged. */
  | { id: string; at: string; kind: 'give'; args: Record<string, unknown>; label: string; rowId: string }

export type OutboxNotice = { id: string; text: string; tone: 'warning' | 'error' }
type State = { ops: OutboxOp[]; notices: OutboxNotice[]; syncing: boolean; online: boolean }

const KEY = 'bella.outbox'
const listeners = new Set<() => void>()

function load(): Pick<State, 'ops' | 'notices'> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return { ops: [], notices: [] }
}

let state: State = { ...load(), syncing: false, online: typeof navigator === 'undefined' ? true : navigator.onLine }

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify({ ops: state.ops, notices: state.notices }))
  } catch {
    // Storage full or blocked: the queue still works until the app is closed.
  }
  listeners.forEach((l) => l())
}

export const outbox = {
  subscribe(l: () => void) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  get: () => state,
  dismiss(id: string) {
    set({ notices: state.notices.filter((n) => n.id !== id) })
  },
  /** For tests. */
  reset() {
    set({ ops: [], notices: [], syncing: false })
  },
}

export function useOutbox(): State {
  return useSyncExternalStore(outbox.subscribe, outbox.get, outbox.get)
}

export const newId = () => crypto.randomUUID()

function db() {
  if (!supabase) throw new Error('Not connected')
  return supabase
}

/** Postgres "already exists": a retried insert that had in fact gone through. */
const isDuplicate = (e: { code?: string } | null) => e?.code === '23505'

async function exec(op: OutboxOp): Promise<OutboxNotice | null> {
  switch (op.kind) {
    case 'insert': {
      const { error } = await db().from(op.table).insert(op.row)
      if (error && !isDuplicate(error)) throw error
      return null
    }
    case 'update': {
      const { error } = await db().from(op.table).update(op.patch).eq('id', op.rowId)
      if (error) throw error
      return null
    }
    case 'delete': {
      const { error } = await db().from(op.table).delete().eq('id', op.rowId)
      if (error) throw error
      return null
    }
    case 'rpc': {
      const { error } = await db().rpc(op.fn, op.args)
      if (error) throw error
      return null
    }
    case 'give': {
      const first = await db().rpc('give_medicine', { ...op.args, p_allow_repeat: false })
      if (!first.error) return null
      if (first.error.message !== 'ALREADY_GIVEN') throw first.error
      // Given on this phone while offline, and someone else also gave it: record it and flag it.
      const d = JSON.parse(first.error.details ?? '{}') as { by?: string; at?: string }
      const again = await db().rpc('give_medicine', { ...op.args, p_allow_repeat: true })
      if (again.error) throw again.error
      const at = d.at ? new Date(d.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }) : ''
      return { id: op.id, tone: 'warning', text: `${op.label} was also given by ${d.by ?? 'someone'}${at ? ` at ${at}` : ''}. Please check.` }
    }
  }
}

/** Sends queued changes in order. Stops at the first network failure and tries again later. */
export async function flush(): Promise<void> {
  if (state.syncing || state.ops.length === 0 || !supabase || !navigator.onLine) return
  set({ syncing: true })
  try {
    while (state.ops.length) {
      const op = state.ops[0]
      try {
        const notice = await exec(op)
        set({ ops: state.ops.slice(1), notices: notice ? [...state.notices, notice] : state.notices })
      } catch (e) {
        if (isNetworkError(e)) break
        // The server refused it (e.g. permissions changed): drop it, and say so.
        const msg = e instanceof Error ? e.message : String((e as { message?: string }).message ?? e)
        set({ ops: state.ops.slice(1), notices: [...state.notices, { id: op.id, tone: 'error', text: `A change made offline couldn't be saved: ${msg}` }] })
      }
    }
  } finally {
    set({ syncing: false })
  }
}

/**
 * Do it now if possible; otherwise keep it for later. Returns true if queued.
 * Anything already waiting goes first, so changes always arrive in order.
 */
export async function runOrQueue(op: OutboxOp, runNow: () => Promise<void>): Promise<boolean> {
  const queue = () => {
    set({ ops: [...state.ops, op] })
    return true
  }
  if (!navigator.onLine || state.ops.length > 0) {
    queue()
    void flush()
    return true
  }
  try {
    await runNow()
    return false
  } catch (e) {
    if (isNetworkError(e)) return queue()
    throw e
  }
}

let started = false
/** Watches the connection and sends the queue whenever there's signal. */
export function startOutbox() {
  if (started || typeof window === 'undefined') return
  started = true
  const online = () => {
    set({ online: navigator.onLine })
    if (navigator.onLine) void flush()
  }
  window.addEventListener('online', online)
  window.addEventListener('offline', online)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void flush())
  setInterval(() => state.ops.length && void flush(), 20_000)
  void flush()
}
