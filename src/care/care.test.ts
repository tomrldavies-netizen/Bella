import { describe, expect, it } from 'vitest'
import type { FeedPlanVersion, Medicine } from '../plan/api'
import { countdown } from './countdown'
import { describeFeed, feedTotals, nearestPlannedFeed, nextPlannedFeed, plannedDayTotal, plannedFeedsAround, plannedFeedsForDay } from './feedLog'
import { doseStatus, dosesForDay, nextDose } from './medSchedule'
import { describeTube, tubeStatus } from './tube'
import type { FeedLog, GivenLog } from './types'

const iron: Medicine = {
  id: 'iron',
  name: 'Iron',
  notes: null,
  active: true,
  sort_order: 1,
  versions: [
    // 1.0 ml until 12:00 UK on 4 Dec, then 1.2 ml.
    { id: 'a', dose: 1, unit: 'ml', route: 'mouth', times: ['05:00', '17:00'], effective_from: '2026-11-01T00:00:00Z', effective_to: '2026-12-04T12:00:00Z', reason: null },
    { id: 'b', dose: 1.2, unit: 'ml', route: 'mouth', times: ['05:00', '17:00', '23:00'], effective_from: '2026-12-04T12:00:00Z', effective_to: null, reason: null },
  ],
}
const given = (scheduled: string, by = 'm-dad'): GivenLog => ({
  id: scheduled, logged_by: by, logged_at: scheduled, medicine_id: 'iron', scheduled_for: scheduled, given_at: scheduled, dose_given: 1,
})

describe('medicine schedule', () => {
  it('uses the dose in force at each time', () => {
    const day = dosesForDay([iron], '2026-12-04')
    expect(day.map((d) => `${d.time} ${d.dose}`)).toEqual(['05:00 1', '17:00 1.2', '23:00 1.2'])
  })

  it('skips stopped medicines', () => {
    expect(dosesForDay([{ ...iron, active: false }], '2026-12-04')).toEqual([])
  })

  it('marks doses given, due, missed (1 hour after) or later', () => {
    const [five, seventeen, late] = dosesForDay([iron], '2026-12-04')
    const now = new Date('2026-12-04T16:30:00Z')
    expect(doseStatus(five, [given(five.scheduledFor)], now)).toBe('given')
    expect(doseStatus(five, [], now)).toBe('missed')
    expect(doseStatus(five, [], new Date('2026-12-04T06:00:00Z'))).toBe('due')
    expect(doseStatus(five, [], new Date('2026-12-04T06:01:00Z'))).toBe('missed')
    expect(doseStatus(seventeen, [], now)).toBe('due')
    expect(doseStatus(late, [], now)).toBe('later')
  })

  it('finds the next dose to give', () => {
    const now = new Date('2026-12-04T18:30:00Z')
    expect(nextDose([iron], [], '2026-12-04', now)?.time).toBe('23:00')
    const all = dosesForDay([iron], '2026-12-04').map((d) => given(d.scheduledFor))
    expect(nextDose([iron], all, '2026-12-04', now)?.scheduledFor).toBe('2026-12-05T05:00:00.000Z')
  })
})

const plan = (id: string, from: string, slots: FeedPlanVersion['slots']): FeedPlanVersion => ({ id, effective_from: from, note: null, created_by: 'm', slots })

describe('planned feeds', () => {
  const versions = [
    plan('new', '2026-12-04T12:00:00Z', [{ time: '06:00', milk: 'formula', ml: 60 }, { time: '18:00', milk: 'formula', ml: 60 }]),
    plan('old', '2026-11-01T00:00:00Z', [{ time: '06:00', milk: 'breast', ml: 50 }, { time: '18:00', milk: 'breast', ml: 50 }]),
  ]

  it('uses the plan in force at each feed', () => {
    expect(plannedFeedsForDay(versions, '2026-12-04').map((f) => `${f.time} ${f.milk} ${f.ml}`)).toEqual(['06:00 breast 50', '18:00 formula 60'])
    expect(plannedDayTotal(versions, '2026-12-04')).toBe(110)
  })

  it('offers planned feeds either side of midnight', () => {
    const around = plannedFeedsAround(versions, '2026-12-04T23:00:00Z')
    expect(around.map((f) => f.at)).toEqual(['2026-12-04T18:00:00.000Z', '2026-12-05T06:00:00.000Z'])
  })

  it('finds the next and nearest planned feed', () => {
    expect(nextPlannedFeed(versions, '2026-12-04', new Date('2026-12-04T19:00:00Z'))?.at).toBe('2026-12-05T06:00:00.000Z')
    expect(nearestPlannedFeed(versions, '2026-12-04T17:20:00Z')?.time).toBe('18:00')
    expect(nearestPlannedFeed(versions, '2026-12-05T01:00:00Z')?.time).toBe('06:00')
  })
})

describe('feed totals and text', () => {
  const feed = (oral: number, tube: number, extra: Partial<FeedLog> = {}): FeedLog => ({
    id: 'f', logged_by: 'm', logged_at: '', feed_plan_slot_id: null, started_at: null, ended_at: null, method: 'bottle_tube',
    oral_ml: oral, tube_ml: tube, milk_type: 'breast', fortified: false, sick_level: 'none', note: null, ...extra,
  })

  it('totals feeds and % by mouth', () => {
    expect(feedTotals([feed(15, 35), feed(0, 50)])).toEqual({ count: 2, oral: 15, tube: 85, total: 100, pctByMouth: 15 })
    expect(feedTotals([]).pctByMouth).toBe(0)
  })

  it('describes a feed', () => {
    expect(describeFeed(feed(15, 35, { fortified: true }))).toBe('Feed 50 ml · bottle 15 ml, tube 35 ml · breast milk + fortifier')
    expect(describeFeed(feed(0, 50, { method: 'tube', sick_level: 'posset' }))).toBe('Feed 50 ml · via tube · breast milk · posset')
    expect(describeFeed(feed(20, 0, { method: 'breast_tube', milk_type: null, sick_level: 'large' }))).toBe('Feed 20 ml · breast 20 ml · large sick')
  })
})

describe('NG tube', () => {
  const change = { id: 't', logged_by: 'm', logged_at: '', nostril: 'left' as const, inserted_at: '2026-12-01T09:00:00Z', retaped_at: '2026-12-04T08:10:00Z', note: null }
  it('counts days and spots a due change', () => {
    const s = tubeStatus(change, 7, '2026-12-04')!
    expect(describeTube(s)).toBe('Day 4 of 7 · retaped today at 08:10')
    expect(s.due).toBe(false)
    expect(tubeStatus(change, 7, '2026-12-08')!.due).toBe(true)
    expect(tubeStatus(null, 7, '2026-12-04')).toBeNull()
  })
})

describe('countdown', () => {
  const now = new Date('2026-12-04T12:00:00Z')
  it.each([
    ['2026-12-04T12:25:00Z', '25 min'],
    ['2026-12-04T13:05:00Z', '1 hr 5 min'],
    ['2026-12-04T14:00:00Z', '2 hrs'],
    ['2026-12-04T11:50:00Z', '10 min ago'],
    ['2026-12-04T12:00:10Z', 'Now'],
    ['2026-12-03T08:20:00Z', '1 day 3 hr ago'],
    ['2026-12-02T12:00:00Z', '2 days ago'],
  ])('%s → %s', (t, expected) => expect(countdown(t, now)).toBe(expected))
})
