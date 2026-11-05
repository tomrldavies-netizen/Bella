import type { DayLogs } from '../care/api'
import type { GivenLog } from '../care/types'
import type { OutboxOp } from './outbox'

export type Pending = { _pending?: true }

const KEY: Record<string, keyof DayLogs> = {
  feeds: 'feeds',
  nappies: 'nappies',
  notes: 'notes',
  obs: 'obs',
  exercise_logs: 'exercises',
  tummy_time: 'tummy',
  tube_changes: 'tubeChanges',
  medicine_given: 'given',
}

function givenRow(op: Extract<OutboxOp, { kind: 'give' }>, memberId: string): GivenLog & Pending {
  const a = op.args as { p_medicine_id: string; p_scheduled_for: string | null; p_given_at: string; p_dose_given: number }
  return {
    id: op.rowId,
    logged_by: memberId,
    logged_at: a.p_given_at,
    medicine_id: a.p_medicine_id,
    scheduled_for: a.p_scheduled_for,
    given_at: a.p_given_at,
    dose_given: a.p_dose_given,
    _pending: true,
  }
}

/**
 * Today's entries as this phone sees them: what the server has, plus changes
 * still waiting to sync (marked _pending), so nothing seems to vanish offline.
 */
export function withPending(logs: DayLogs, ops: OutboxOp[], memberId: string, fromIso: string, toIso: string): DayLogs {
  if (!ops.length) return logs
  const out = Object.fromEntries(Object.entries(logs).map(([k, v]) => [k, [...(v as object[])]])) as unknown as Record<keyof DayLogs, (Record<string, unknown> & Pending)[]>
  const inDay = (at: unknown) => typeof at === 'string' && at >= fromIso && at < toIso
  for (const op of ops) {
    if (op.kind === 'insert' && KEY[op.table] && inDay(op.row.logged_at)) {
      const list = out[KEY[op.table]]
      if (!list.some((r) => r.id === op.row.id)) list.push({ logged_by: memberId, ...op.row, _pending: true })
    } else if (op.kind === 'give' && inDay((op.args as { p_given_at: string }).p_given_at)) {
      out.given.push(givenRow(op, memberId) as unknown as Record<string, unknown>)
    } else if (op.kind === 'update' && KEY[op.table]) {
      const list = out[KEY[op.table]]
      const i = list.findIndex((r) => r.id === op.rowId)
      if (i >= 0) list[i] = { ...list[i], ...op.patch, _pending: true }
    } else if (op.kind === 'delete' && KEY[op.table]) {
      const k = KEY[op.table]
      out[k] = out[k].filter((r) => r.id !== op.rowId)
    }
  }
  for (const k of Object.keys(out) as (keyof DayLogs)[]) out[k].sort((a, b) => String(b.logged_at).localeCompare(String(a.logged_at)))
  return out as unknown as DayLogs
}

/** Doses marked given on this phone but not yet synced, for the schedule and double-dose check. */
export function pendingGiven(ops: OutboxOp[], memberId: string): (GivenLog & Pending)[] {
  return ops.filter((o): o is Extract<OutboxOp, { kind: 'give' }> => o.kind === 'give').map((o) => givenRow(o, memberId))
}
