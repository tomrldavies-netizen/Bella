import { addDaysIso, ukParts } from '../lib/ukTime'
import type { SuctionAmount, SuctionLog, SuctionSite } from './types'

export const SUCTION_AMOUNTS: { value: SuctionAmount; label: string }[] = [
  { value: 'little', label: 'A little' },
  { value: 'medium', label: 'Medium' },
  { value: 'lot', label: 'A lot' },
]
export const SUCTION_SITES: { value: SuctionSite; label: string }[] = [
  { value: 'nose', label: 'Nose' },
  { value: 'mouth', label: 'Mouth' },
  { value: 'both', label: 'Both' },
]

/** Bar shades for a little / medium / a lot, lightest to darkest (Care green). */
export const SUCTION_SHADE: Record<SuctionAmount, string> = { little: '#C9DFC9', medium: '#8DB596', lot: '#4F7F5A' }

export const amountLabel = (a: SuctionAmount) => SUCTION_AMOUNTS.find((x) => x.value === a)!.label
const siteWord = (s: SuctionSite) => (s === 'both' ? 'nose and mouth' : s)

/** "a lot · nose" */
export function suctionDetail(row: Pick<SuctionLog, 'amount' | 'site'>): string {
  return [amountLabel(row.amount).toLowerCase(), row.site ? siteWord(row.site) : null].filter(Boolean).join(' · ')
}

/** "Suction · a lot · nose" */
export const suctionText = (row: Pick<SuctionLog, 'amount' | 'site'>) => `Suction · ${suctionDetail(row)}`

export type SuctionCounts = Record<SuctionAmount, number> & { total: number }

export function countSuctions(rows: Pick<SuctionLog, 'amount'>[]): SuctionCounts {
  const c: SuctionCounts = { little: 0, medium: 0, lot: 0, total: rows.length }
  for (const r of rows) c[r.amount]++
  return c
}

/** "2 a little · 1 a lot" */
export function describeCounts(c: SuctionCounts): string {
  return SUCTION_AMOUNTS.filter((a) => c[a.value] > 0)
    .map((a) => `${c[a.value]} ${a.label.toLowerCase()}`)
    .join(' · ')
}

export const timesWord = (n: number) => `${n} time${n === 1 ? '' : 's'}`

/** One entry per UK day, oldest first, ending today. */
export function suctionsByDay(rows: SuctionLog[], today: string, days = 7): ({ date: string; rows: SuctionLog[] } & SuctionCounts)[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysIso(today, i - days + 1)
    const dayRows = rows.filter((r) => ukParts(r.logged_at).date === date).sort((a, b) => b.logged_at.localeCompare(a.logged_at))
    return { date, rows: dayRows, ...countSuctions(dayRows) }
  })
}
