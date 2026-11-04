import { describe, expect, it } from 'vitest'
import { buildTimeline } from './timeline'

describe('timeline', () => {
  it('merges entries newest first with readable text', () => {
    const items = buildTimeline(
      {
        feeds: [{ id: 'f', logged_by: 'm1', logged_at: '2026-12-04T21:00:00Z', feed_plan_slot_id: null, started_at: null, ended_at: null, method: 'bottle_tube', oral_ml: 15, tube_ml: 35, milk_type: 'breast', fortified: false, sick_level: 'large', note: null }],
        nappies: [{ id: 'n', logged_by: 'm2', logged_at: '2026-12-04T20:40:00Z', wet: true, dirty: false, note: null }],
        given: [{ id: 'g', logged_by: 'm1', logged_at: '2026-12-04T20:00:00Z', medicine_id: 'v', scheduled_for: '2026-12-04T20:00:00Z', given_at: '2026-12-04T20:00:00Z', dose_given: 0.5 }],
        notes: [{ id: 'x', logged_by: 'm2', logged_at: '2026-12-04T21:30:00Z', text: 'Settled well' }],
        tubeChanges: [],
        obs: [{ id: 'o', logged_by: 'm1', logged_at: '2026-12-04T20:30:00Z', temperature_c: 38.1, breathing: 'normal', sleep: 'settled', note: null }],
        exercises: [],
        tummy: [{ id: 't', logged_by: 'm2', logged_at: '2026-12-04T19:20:00Z', duration_min: 6 }],
      },
      [{ id: 'v', name: 'Vitamin drops', notes: null, active: true, sort_order: 1, versions: [] }],
      [],
      { min: 36.5, max: 37.5 },
    )
    expect(items.map((i) => `${i.time} ${i.text}`)).toEqual([
      '21:30 Note · Settled well',
      '21:00 Feed 50 ml · bottle 15 ml, tube 35 ml · breast milk · large sick',
      '20:40 Nappy · wet',
      '20:30 Obs · 38.1 °C, all normal',
      '20:00 Vitamin drops 0.5 ml',
      '19:20 Tummy time 6 min',
    ])
    expect(items[1].flagged).toBe(true)
    // Above the parents' range, so highlighted even though breathing and sleep were normal.
    expect(items[3].flagged).toBe(true)
  })
})
