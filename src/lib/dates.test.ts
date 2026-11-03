import { describe, expect, it } from 'vitest'
import { formatLongDate, greeting } from './dates'

describe('formatLongDate', () => {
  it('formats as weekday, day and month in British English', () => {
    expect(formatLongDate(new Date(2026, 9, 22, 21, 0))).toBe('Thursday 22 October')
  })
})

describe('greeting', () => {
  it.each([
    [4, 'Good evening'],
    [5, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('at %i:00 says %s', (hour, expected) => {
    expect(greeting(new Date(2026, 9, 22, hour, 0))).toBe(expected)
  })
})
