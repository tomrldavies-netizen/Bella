import { describe, expect, it } from 'vitest'
import { describeObs, obsConcerns, obsDueAt } from './obs'
import type { ObsLog } from './types'

const obs = (extra: Partial<ObsLog> = {}): ObsLog => ({
  id: 'o', logged_by: 'm', logged_at: '2026-12-04T20:30:00Z', temperature_c: 36.8, breathing: 'normal', sleep: 'settled', note: null, ...extra,
})

describe('obs', () => {
  it('describes normal and non-normal obs', () => {
    expect(describeObs(obs(), null)).toBe('Obs · 36.8 °C, all normal')
    expect(describeObs(obs({ temperature_c: 37.9, breathing: 'noisy', sleep: 'unsettled' }), null)).toBe('Obs · 37.9 °C, noisy breathing and unsettled')
  })

  it('only flags temperature against the range the parents set', () => {
    expect(obsConcerns(obs({ temperature_c: 38.2 }), null)).toEqual([])
    expect(obsConcerns(obs({ temperature_c: 38.2 }), { min: 36.5, max: 37.5 })).toEqual(['temperature above the normal range'])
    expect(obsConcerns(obs({ temperature_c: 36.4 }), { min: 36.5, max: 37.5 })).toEqual(['temperature below the normal range'])
    expect(obsConcerns(obs({ temperature_c: 37.5 }), { min: 36.5, max: 37.5 })).toEqual([])
    expect(obsConcerns(obs({ breathing: 'pauses', sleep: 'very_sleepy' }), null)).toEqual(['breathing pauses', 'very sleepy'])
  })

  it('works out when obs are due', () => {
    const now = new Date('2026-12-04T22:00:00Z')
    expect(obsDueAt(obs(), 240, now)).toBe('2026-12-05T00:30:00.000Z')
    expect(obsDueAt(null, 240, now)).toBe(now.toISOString())
    expect(obsDueAt(obs(), null, now)).toBeNull()
  })
})
