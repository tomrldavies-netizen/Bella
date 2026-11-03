import { describe, expect, it } from 'vitest'
import {
  actualAgeLabel,
  addDays,
  correctedAgeLabel,
  daysBetween,
  dueDateFrom,
  dueDateLabel,
  monthsBetween,
  ukToday,
} from './age'

describe('date helpers', () => {
  it('counts whole days across the October clock change', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('counts calendar months', () => {
    expect(monthsBetween('2026-01-31', '2026-02-28')).toBe(0)
    expect(monthsBetween('2026-01-15', '2026-03-15')).toBe(2)
    expect(monthsBetween('2026-03-15', '2026-01-15')).toBe(0)
  })

  it('uses the UK date, not UTC', () => {
    // 23:30 UTC on 31 May is 00:30 on 1 June in London (BST).
    expect(ukToday(new Date('2026-05-31T23:30:00Z'))).toBe('2026-06-01')
    // In winter London is on GMT.
    expect(ukToday(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12-31')
  })
})

describe('dueDateFrom', () => {
  it('adds the weeks still to go to 40+0', () => {
    // Born at 31+2: 8 weeks 5 days (61 days) early.
    expect(dueDateFrom('2026-09-10', 31, 2)).toBe('2026-11-10')
    expect(dueDateFrom('2026-09-10', 40, 0)).toBe('2026-09-10')
  })
})

describe('actualAgeLabel', () => {
  it.each([
    ['2026-09-10', '0 days old'],
    ['2026-09-11', '1 day old'],
    ['2026-09-23', '13 days old'],
    ['2026-09-24', '2 wks old'],
    ['2026-10-29', '7 wks old'],
    ['2026-12-10', '3 months old'],
  ])('on %s says %s', (today, expected) => {
    expect(actualAgeLabel('2026-09-10', today)).toBe(expected)
  })
})

describe('correctedAgeLabel', () => {
  const born = '2026-09-10' // at 31+2, due 2026-11-10

  it('shows post-menstrual age before term', () => {
    expect(correctedAgeLabel(born, 31, 2, born)).toBe('31+2 corrected')
    expect(correctedAgeLabel(born, 31, 2, '2026-09-15')).toBe('32+0 corrected')
    expect(correctedAgeLabel(born, 31, 2, '2026-11-09')).toBe('39+6 corrected')
  })

  it('shows corrected age from term', () => {
    expect(correctedAgeLabel(born, 31, 2, '2026-11-10')).toBe('0 days corrected')
    expect(correctedAgeLabel(born, 31, 2, '2026-11-11')).toBe('1 day corrected')
    expect(correctedAgeLabel(born, 31, 2, '2026-12-01')).toBe('3 wks corrected')
    expect(correctedAgeLabel(born, 31, 2, '2027-02-10')).toBe('3 months corrected')
  })
})

describe('dueDateLabel', () => {
  it('counts down to the due date, then disappears', () => {
    expect(dueDateLabel('2026-11-10', '2026-11-03')).toBe('Due in 7 days')
    expect(dueDateLabel('2026-11-10', '2026-11-09')).toBe('Due in 1 day')
    expect(dueDateLabel('2026-11-10', '2026-11-10')).toBe('Due date today')
    expect(dueDateLabel('2026-11-10', '2026-11-11')).toBeNull()
  })
})
