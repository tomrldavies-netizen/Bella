import { describe, expect, it } from 'vitest'
import type { FeedPlanVersion, Medicine } from '../plan/api'
import { overdueItems } from './overdue'

const plan: FeedPlanVersion = { id: 'p', effective_from: '2026-11-01T00:00:00Z', note: null, created_by: 'm', slots: ['09:00', '12:00', '15:00'].map((time, i) => ({ id: `s${i}`, time, milk: 'formula' as const, ml: 55 })) }
const iron: Medicine = { id: 'iron', name: 'Iron', notes: null, active: true, sort_order: 1, versions: [{ id: 'v', dose: 1.2, unit: 'ml', route: 'either', times: ['11:00', '15:00'], effective_from: '2026-11-01T00:00:00Z', effective_to: null, reason: null }] }
const base = {
  today: '2026-12-04',
  plans: [plan],
  medicines: [iron],
  scheduledGiven: [],
  routines: { obsIntervalMin: 240, tummyGoalMin: 30, tubeChangeDays: 7, tempMinC: null, tempMaxC: null, tasks: [] },
  lastObs: { id: 'o', logged_by: 'm', logged_at: '2026-12-04T08:30:00Z', temperature_c: 36.8, breathing: 'normal' as const, sleep: 'settled' as const, note: null },
  tube: { id: 't', logged_by: 'm', logged_at: '', nostril: 'left' as const, inserted_at: '2026-11-26T10:00:00Z', retaped_at: null, note: null },
  careTaskLogs: [],
  logs: { feeds: [{ id: 'f', logged_by: 'm', logged_at: '2026-12-04T09:05:00Z', feed_plan_slot_id: null, started_at: null, ended_at: null, method: 'tube' as const, oral_ml: 0, tube_ml: 55, milk_type: 'formula' as const, fortified: false, sick_level: 'none' as const, note: null }], nappies: [], given: [], notes: [], tubeChanges: [], obs: [], exercises: [], tummy: [] },
}

describe('overdue', () => {
  it('lists what is late, most late first, with how long ago', () => {
    const items = overdueItems({ ...base, now: new Date('2026-12-04T12:40:00Z') })
    expect(items.map((i) => `${i.title} · ${i.lateness} · ${i.severity}`)).toEqual([
      'NG tube change · 1 day 3 hr ago · late', // in 26 Nov for 7 days: due 09:00 on 3 Dec
      'Iron · 1 hr 40 min ago · late', // 11:00 dose not given
      'Feed · 40 min ago · late', // 12:00 feed not logged; the 09:00 one was
      'Obs · 10 min ago · due', // due 12:30, within 15 minutes = amber
    ])
    expect(items.find((i) => i.kind === 'feed')).toMatchObject({ detail: 'due 12:00 · 55 ml formula', action: 'Log feed', to: '/feeds' })
  })

  it('turns red only after 15 minutes', () => {
    expect(overdueItems({ ...base, tube: null, lastObs: null, medicines: [], now: new Date('2026-12-04T12:14:00Z') })[0]).toMatchObject({ severity: 'due', lateness: '14 min ago' })
    expect(overdueItems({ ...base, tube: null, lastObs: null, medicines: [], now: new Date('2026-12-04T12:15:00Z') })[0]).toMatchObject({ severity: 'late' })
    expect(overdueItems({ ...base, tube: null, lastObs: null, medicines: [], now: new Date('2026-12-04T12:00:20Z') })[0]).toMatchObject({ lateness: 'due now' })
  })

  it('drops things once logged, and ignores what is not due yet', () => {
    const given = [{ id: 'g', logged_by: 'm', logged_at: '', medicine_id: 'iron', scheduled_for: '2026-12-04T11:00:00.000Z', given_at: '2026-12-04T11:02:00Z', dose_given: 1.2 }]
    const items = overdueItems({ ...base, scheduledGiven: given, tube: null, now: new Date('2026-12-04T11:30:00Z') })
    expect(items.map((i) => i.kind)).toEqual([])
  })
})
