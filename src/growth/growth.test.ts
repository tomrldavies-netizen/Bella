import { describe, expect, it } from 'vitest'
import { ageCards, chartPoints, chartScale, formatKg, signedGrams, weightGain } from './growth'

describe('growth', () => {
  it('shows age cards like the mockup', () => {
    // Born 10 Sep at 31+2, due 10 Nov.
    expect(ageCards('2026-09-10', 31, 2, '2026-11-10', '2026-10-31')).toEqual({ actual: '7 wks 2 d', corrected: '38+4 wks', correctedLabel: 'CORRECTED', due: 'in 10 days' })
    expect(ageCards('2026-09-10', 31, 2, '2026-11-10', '2026-11-24').corrected).toBe('2 wks 0 d')
    expect(ageCards('2026-09-10', 31, 2, '2026-11-10', '2026-11-24').due).toBe('14 days ago')
  })

  it('works out weekly gain and grams a day', () => {
    const w = [
      { measured_on: '2026-10-05', weight_g: 1980 },
      { measured_on: '2026-10-12', weight_g: 2145 },
      { measured_on: '2026-10-15', weight_g: 2200 },
      { measured_on: '2026-10-19', weight_g: 2310 },
    ]
    expect(weightGain(w)).toEqual({ grams: 165, days: 7, perDay: 24, since: '2026-10-12', weekly: true })
    expect(weightGain(w.slice(0, 1))).toBeNull()
  })

  it('formats weights', () => {
    expect(formatKg(2310)).toBe('2.31 kg')
    expect(formatKg(2405)).toBe('2.41 kg')
    expect(signedGrams(165)).toBe('+165 g')
    expect(signedGrams(-20)).toBe('−20 g')
  })

  it('places weigh-ins by post-menstrual weeks', () => {
    const pts = chartPoints([{ measured_on: '2026-09-17', weight_g: 1500 }], '2026-09-10', 31, 2)
    expect(pts[0].weeks).toBeCloseTo(32 + 2 / 7)
    expect(chartScale(pts, 38, 31 + 2 / 7)).toEqual({ minW: 30, maxW: 40, minK: 1, maxK: 2 })
  })
})
