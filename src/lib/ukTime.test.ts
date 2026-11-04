import { describe, expect, it } from 'vitest'
import { friendlyDateTime, listWords, nextDailyTime, ukNow, ukToIso } from './ukTime'

describe('UK time', () => {
  it('converts UK wall time to an instant in winter and summer', () => {
    expect(ukToIso('2026-12-01', '06:00')).toBe('2026-12-01T06:00:00.000Z')
    expect(ukToIso('2026-07-01', '06:00')).toBe('2026-07-01T05:00:00.000Z')
  })

  it('handles the October clock change', () => {
    // 25 Oct 2026: clocks go back at 02:00 BST. 00:30 is still BST, 03:00 is GMT.
    expect(ukToIso('2026-10-25', '00:30')).toBe('2026-10-24T23:30:00.000Z')
    expect(ukToIso('2026-10-25', '03:00')).toBe('2026-10-25T03:00:00.000Z')
  })

  it('reads the UK date and time of an instant', () => {
    expect(ukNow(new Date('2026-07-01T23:30:00Z'))).toEqual({ date: '2026-07-02', time: '00:30' })
  })

  it('finds the next daily time', () => {
    const now = new Date('2026-12-01T10:00:00Z')
    expect(nextDailyTime(['05:00', '17:00', '11:00'], now)).toBe('2026-12-01T11:00:00.000Z')
    expect(nextDailyTime(['05:00'], now)).toBe('2026-12-02T05:00:00.000Z')
    expect(nextDailyTime([], now)).toBeNull()
  })

  it('labels dates relative to today', () => {
    const now = new Date('2026-12-01T10:00:00Z')
    expect(friendlyDateTime('2026-12-01T23:00:00Z', now)).toBe('Today, 23:00')
    expect(friendlyDateTime('2026-12-02T05:00:00Z', now)).toBe('Tomorrow, 05:00')
    expect(friendlyDateTime('2026-12-04T05:00:00Z', now)).toBe('Fri 4 Dec, 05:00')
  })

  it('joins words', () => {
    expect(listWords(['a'])).toBe('a')
    expect(listWords(['a', 'b'])).toBe('a and b')
    expect(listWords(['a', 'b', 'c'])).toBe('a, b and c')
  })
})
