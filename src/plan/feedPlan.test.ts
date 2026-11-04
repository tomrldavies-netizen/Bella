import { describe, expect, it } from 'vitest'
import { cycleMilk, describePlan, evenInterval, fillEvery, nextSlot, summariseFeedChange, type FeedSlot } from './feedPlan'

const slot = (time: string, milk: FeedSlot['milk'], ml: number): FeedSlot => ({ time, milk, ml })
const eightFeeds = fillEvery(3, '00:00', 50, 'breast')

describe('feed plan', () => {
  it('cycles milk type', () => {
    expect(cycleMilk('breast')).toBe('formula')
    expect(cycleMilk('formula')).toBe('mix')
    expect(cycleMilk('mix')).toBe('breast')
  })

  it('fills feeds round the clock from the chosen values', () => {
    expect(eightFeeds.map((s) => s.time)).toEqual(['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'])
    expect(fillEvery(4, '02:00', 60, 'formula').map((s) => s.time)).toEqual(['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'])
  })

  it('describes a plan like the mockup', () => {
    const plan = eightFeeds.map((s) => (s.time === '06:00' || s.time === '15:00' ? { ...s, milk: 'formula' as const } : s))
    plan[4] = { ...plan[4], ml: 55 }
    expect(describePlan(plan)).toBe('8 feeds · 405 ml a day · 6 breast milk, 2 formula')
    expect(describePlan([])).toBe('No feeds set yet')
  })

  it('spots even spacing', () => {
    expect(evenInterval(eightFeeds)).toBe('every 3 hrs')
    expect(evenInterval([slot('00:00', 'breast', 1), slot('05:00', 'breast', 1)])).toBeNull()
  })

  it('finds the next feed', () => {
    expect(nextSlot(eightFeeds, '22:35')).toEqual({ time: '00:00', tomorrow: true })
    expect(nextSlot(eightFeeds, '03:00')).toEqual({ time: '06:00', tomorrow: false })
  })
})

describe('summariseFeedChange', () => {
  it('describes a brand new plan', () => {
    expect(summariseFeedChange(null, eightFeeds)).toBe('New feed plan: 8 feeds · 400 ml a day · 8 breast milk')
  })

  it('groups milk changes like the mockup', () => {
    const after = eightFeeds.map((s) => (s.time === '06:00' || s.time === '15:00' ? { ...s, milk: 'formula' as const } : s))
    expect(summariseFeedChange(eightFeeds, after)).toBe('06:00 and 15:00 feeds now formula, 50 ml')
  })

  it('describes amount, added and removed feeds', () => {
    const before = [slot('00:00', 'breast', 50), slot('03:00', 'breast', 50), slot('06:00', 'breast', 50)]
    const after = [slot('00:00', 'breast', 55), slot('03:00', 'breast', 55), slot('07:00', 'formula', 40)]
    expect(summariseFeedChange(before, after)).toBe(
      '00:00 and 03:00 feeds 50 → 55 ml; Added 07:00 feed, 40 ml formula; Removed 06:00 feed',
    )
  })

  it('is empty when nothing changed', () => {
    expect(summariseFeedChange(eightFeeds, [...eightFeeds].reverse())).toBe('')
  })
})
