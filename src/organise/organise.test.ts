import { describe, expect, it } from 'vitest'
import type { Member } from '../data/types'
import type { Medicine, PlanChange } from '../plan/api'
import { careTaskStatus, whenWords } from './careTasks'
import { seenWords, unseenFor } from './changes'
import { freezerStock } from './expressing'
import { prescriptionStatus } from './prescriptions'

const log = (date: string) => ({ id: date, logged_by: 'm', logged_at: `${date}T09:00:00Z`, care_task_id: 't' })

describe('care tasks', () => {
  it('weekly tasks fall on their days', () => {
    const bath = { id: 't', name: 'Bath', recurrence: { kind: 'weekly' as const, days: [1, 4] } } // Mon, Thu
    // 4 Dec 2026 is a Friday.
    expect(careTaskStatus(bath, [], '2026-12-04')).toMatchObject({ dueToday: false, next: '2026-12-07' })
    expect(careTaskStatus(bath, [], '2026-12-03')).toMatchObject({ dueToday: true, next: '2026-12-03' })
    expect(careTaskStatus(bath, [log('2026-12-03')], '2026-12-03')).toMatchObject({ doneToday: true, dueToday: false, next: '2026-12-07' })
  })

  it('every-N-days tasks count from the last time', () => {
    const skin = { id: 't', name: 'Skin check', recurrence: { kind: 'every_n_days' as const, every: 2 } }
    expect(careTaskStatus(skin, [], '2026-12-04')).toMatchObject({ dueToday: true })
    expect(careTaskStatus(skin, [log('2026-12-03')], '2026-12-04')).toMatchObject({ dueToday: false, next: '2026-12-05' })
    expect(careTaskStatus(skin, [log('2026-12-01')], '2026-12-04')).toMatchObject({ dueToday: true, overdueDays: 1 })
  })

  it('says when in words', () => {
    expect(whenWords('2026-12-04', '2026-12-04')).toBe('today')
    expect(whenWords('2026-12-05', '2026-12-04')).toBe('tomorrow')
    expect(whenWords('2026-12-07', '2026-12-04')).toBe('Mon')
    expect(whenWords('2026-12-14', '2026-12-04')).toBe('Mon 14 Dec')
  })
})

describe('prescriptions', () => {
  const vit: Medicine = {
    id: 'v', name: 'Vitamin drops', notes: null, active: true, sort_order: 1,
    versions: [{ id: 'a', dose: 0.5, unit: 'ml', route: 'mouth', times: ['09:00'], effective_from: '2026-10-01T00:00:00Z', effective_to: null, reason: null }],
  }
  const rx = { id: 'r', medicine_id: 'v', bottle_volume: 25, opened_at: '2026-11-01T10:00:00Z', reorder_threshold_days: 7, reordered_at: null }

  it('estimates days left from the planned daily dose', () => {
    expect(prescriptionStatus(rx, vit, '2026-11-01')).toEqual({ daysLeft: 50, low: false, reordered: false })
    expect(prescriptionStatus(rx, vit, '2026-12-16')).toEqual({ daysLeft: 5, low: true, reordered: false })
    expect(prescriptionStatus({ ...rx, reordered_at: '2026-12-15T00:00:00Z' }, vit, '2026-12-16')?.low).toBe(false)
  })
})

describe('plan changes', () => {
  const m = (id: string, name: string, created_at = '2026-10-01T00:00:00Z'): Member & { created_at: string } => ({
    id, household_id: 'h', user_id: id, display_name: name, colour: '#fff', role: 'helper', active: true, created_at,
  })
  const dad = m('dad', 'Dad')
  const mum = m('mum', 'Mum')
  const gran = m('gran', 'Grandad')
  const late = m('late', 'Late', '2026-12-01T00:00:00Z')
  const change: PlanChange & { notify: boolean } = { id: 'c', area: 'feeds', summary: 'x', changed_by: 'dad', created_at: '2026-11-01T10:00:00Z', notify: true }

  it('shows the banner to others until they have seen it', () => {
    expect(unseenFor(mum, [change], [])).toHaveLength(1)
    expect(unseenFor(dad, [change], [])).toHaveLength(0)
    expect(unseenFor(mum, [change], [{ plan_change_id: 'c', member_id: 'mum', seen_at: '' }])).toHaveLength(0)
    expect(unseenFor(mum, [{ ...change, notify: false }], [])).toHaveLength(0)
    expect(unseenFor(late, [change], [])).toHaveLength(0)
  })

  it('says who has not seen it yet', () => {
    const members = [dad, mum, gran, late]
    expect(seenWords(change, members, [{ plan_change_id: 'c', member_id: 'mum', seen_at: '' }])).toBe("Grandad hasn't seen it yet")
    expect(seenWords(change, members, [])).toBe("Mum and Grandad haven't seen it yet")
    expect(
      seenWords(change, members, [
        { plan_change_id: 'c', member_id: 'mum', seen_at: '' },
        { plan_change_id: 'c', member_id: 'gran', seen_at: '' },
      ]),
    ).toBe('seen by everyone')
  })
})

describe('expressing', () => {
  it('counts frozen milk not yet used', () => {
    const s = (storage: 'fridge' | 'freezer', l: number, r: number, used: string | null = null) => ({
      id: String(l), logged_by: 'm', logged_at: '', duration_min: 10, left_ml: l, right_ml: r, storage, used_at: used,
    })
    expect(freezerStock([s('freezer', 40, 35), s('fridge', 20, 20), s('freezer', 30, 30, '2026-12-01')])).toBe(75)
  })
})
