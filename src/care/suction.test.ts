import { describe, expect, it } from 'vitest'
import { countSuctions, describeCounts, suctionsByDay, suctionText } from './suction'
import type { SuctionLog } from './types'

const row = (logged_at: string, amount: SuctionLog['amount'], site: SuctionLog['site'] = null): SuctionLog => ({ id: logged_at, logged_by: 'm', logged_at, amount, site, note: null })

describe('suction', () => {
  it('describes a suction', () => {
    expect(suctionText(row('2026-11-22T10:00:00Z', 'lot', 'nose'))).toBe('Suction · a lot · nose')
    expect(suctionText(row('2026-11-22T10:00:00Z', 'little', 'both'))).toBe('Suction · a little · nose and mouth')
    expect(suctionText(row('2026-11-22T10:00:00Z', 'medium'))).toBe('Suction · medium')
  })

  it('counts by amount', () => {
    const c = countSuctions([row('a', 'little'), row('b', 'little'), row('c', 'lot')])
    expect(c).toEqual({ little: 2, medium: 0, lot: 1, total: 3 })
    expect(describeCounts(c)).toBe('2 a little · 1 a lot')
  })

  it('groups by UK day, oldest first, including empty days', () => {
    // 23:30 UTC on 21 Nov is still 21 Nov in winter; 00:30 UTC on 22 Nov is 22 Nov.
    const days = suctionsByDay([row('2026-11-21T23:30:00Z', 'lot'), row('2026-11-22T00:30:00Z', 'little'), row('2026-11-22T09:00:00Z', 'medium')], '2026-11-22', 3)
    expect(days.map((d) => [d.date, d.total])).toEqual([
      ['2026-11-20', 0],
      ['2026-11-21', 1],
      ['2026-11-22', 2],
    ])
    expect(days[2].rows[0].logged_at).toBe('2026-11-22T09:00:00Z')
  })
})
