import { describe, expect, it } from 'vitest'
import type { DayLogs } from '../care/api'
import type { OutboxOp } from './outbox'
import { pendingGiven, withPending } from './pending'

const empty: DayLogs = { feeds: [], nappies: [], given: [], notes: [], tubeChanges: [], obs: [], exercises: [], tummy: [] }
const day = ['2026-12-04T00:00:00.000Z', '2026-12-05T00:00:00.000Z'] as const

describe('changes waiting to sync', () => {
  it('shows queued entries, edits and deletes straight away', () => {
    const logs: DayLogs = { ...empty, nappies: [{ id: 'n1', logged_by: 'm', logged_at: '2026-12-04T08:00:00Z', wet: true, dirty: false, note: null }] }
    const ops: OutboxOp[] = [
      { id: 'a', at: '', kind: 'insert', table: 'nappies', row: { id: 'n2', household_id: 'h', logged_at: '2026-12-04T09:00:00Z', wet: false, dirty: true } },
      { id: 'b', at: '', kind: 'update', table: 'nappies', rowId: 'n1', patch: { dirty: true } },
      { id: 'c', at: '', kind: 'insert', table: 'nappies', row: { id: 'n3', household_id: 'h', logged_at: '2026-12-03T09:00:00Z', wet: true, dirty: false } },
    ]
    const out = withPending(logs, ops, 'me', ...day)
    expect(out.nappies.map((n) => [n.id, n.dirty, (n as { _pending?: boolean })._pending ?? false])).toEqual([
      ['n2', true, true],
      ['n1', true, true],
    ])
    expect(out.nappies[0].logged_by).toBe('me')
    const deleted = withPending(out, [{ id: 'd', at: '', kind: 'delete', table: 'nappies', rowId: 'n2' }], 'me', ...day)
    expect(deleted.nappies.map((n) => n.id)).toEqual(['n1'])
  })

  it('counts a dose marked given offline', () => {
    const op: OutboxOp = {
      id: 'g', at: '', kind: 'give', rowId: 'g', label: 'Iron 23:00',
      args: { p_household: 'h', p_medicine_id: 'iron', p_scheduled_for: '2026-12-04T23:00:00Z', p_given_at: '2026-12-04T23:02:00Z', p_dose_given: 1.2 },
    }
    expect(withPending(empty, [op], 'me', ...day).given).toHaveLength(1)
    expect(pendingGiven([op], 'me')[0]).toMatchObject({ medicine_id: 'iron', scheduled_for: '2026-12-04T23:00:00Z', logged_by: 'me' })
  })
})
