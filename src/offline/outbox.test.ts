import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const insert = vi.fn()
const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ insert, update: () => ({ eq: vi.fn(async () => ({ error: null })) }), delete: () => ({ eq: vi.fn(async () => ({ error: null })) }) }),
    rpc,
  },
}))

const { flush, outbox, runOrQueue } = await import('./outbox')
const { OFFLINE_MESSAGE } = await import('./network')

const setOnline = (on: boolean) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => on })
const op = (id: string) => ({ id, at: '', kind: 'insert' as const, table: 'nappies', row: { id, household_id: 'h', wet: true } })

beforeEach(() => {
  outbox.reset()
  insert.mockReset()
  rpc.mockReset()
  setOnline(true)
})
afterEach(() => setOnline(true))

describe('outbox', () => {
  it('keeps changes made offline on the phone', async () => {
    setOnline(false)
    const runNow = vi.fn()
    expect(await runOrQueue(op('a'), runNow)).toBe(true)
    expect(runNow).not.toHaveBeenCalled()
    expect(outbox.get().ops.map((o) => o.id)).toEqual(['a'])
  })

  it('queues a change when the connection drops mid-save', async () => {
    expect(await runOrQueue(op('a'), async () => Promise.reject(new TypeError(OFFLINE_MESSAGE)))).toBe(true)
    expect(outbox.get().ops).toHaveLength(1)
  })

  it('does not hide real errors from the server', async () => {
    await expect(runOrQueue(op('a'), async () => Promise.reject(new Error('permission denied')))).rejects.toThrow('permission denied')
    expect(outbox.get().ops).toHaveLength(0)
  })

  it('sends queued changes in order, treating an already-saved insert as done', async () => {
    setOnline(false)
    await runOrQueue(op('a'), vi.fn())
    await runOrQueue(op('b'), vi.fn())
    setOnline(true)
    insert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } }).mockResolvedValueOnce({ error: null })
    await flush()
    expect(insert.mock.calls.map((c) => c[0].id)).toEqual(['a', 'b'])
    expect(outbox.get().ops).toHaveLength(0)
    expect(outbox.get().notices).toHaveLength(0)
  })

  it('stops at a dropped connection and keeps the rest for later', async () => {
    setOnline(false)
    await runOrQueue(op('a'), vi.fn())
    setOnline(true)
    insert.mockRejectedValueOnce(new TypeError(OFFLINE_MESSAGE))
    await flush()
    expect(outbox.get().ops).toHaveLength(1)
  })

  it('records a dose given offline even if someone else gave it, and flags it', async () => {
    setOnline(false)
    await runOrQueue({ id: 'g', at: '', kind: 'give', rowId: 'g', label: 'Iron 23:00', args: { p_medicine_id: 'iron' } }, vi.fn())
    setOnline(true)
    rpc
      .mockResolvedValueOnce({ error: { message: 'ALREADY_GIVEN', details: JSON.stringify({ by: 'Mum', at: '2026-12-04T23:01:00Z' }) } })
      .mockResolvedValueOnce({ error: null })
    await flush()
    expect(rpc.mock.calls.map((c) => c[1].p_allow_repeat)).toEqual([false, true])
    expect(outbox.get().notices[0].text).toBe('Iron 23:00 was also given by Mum at 23:01. Please check.')
  })

  it('drops a change the server refuses, and says so', async () => {
    setOnline(false)
    await runOrQueue(op('a'), vi.fn())
    setOnline(true)
    insert.mockResolvedValueOnce({ error: { code: '42501', message: 'new row violates row-level security policy' } })
    await flush()
    expect(outbox.get().ops).toHaveLength(0)
    expect(outbox.get().notices[0]).toMatchObject({ tone: 'error' })
  })
})
