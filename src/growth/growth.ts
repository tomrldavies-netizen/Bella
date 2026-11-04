import { daysBetween, monthsBetween, TERM_DAYS } from '../lib/age'
import type { WeightLog } from '../care/types'

/** "2.31 kg" */
export const formatKg = (g: number) => `${(Math.round(g / 10) / 100).toFixed(2)} kg`
/** "+165 g" / "−20 g" */
export const signedGrams = (g: number) => `${g >= 0 ? '+' : '−'}${Math.abs(Math.round(g))} g`

/** Post-menstrual age in days on a date. */
export function pmaDays(birthIso: string, gestWeeks: number, gestDays: number, dateIso: string): number {
  return gestWeeks * 7 + gestDays + daysBetween(birthIso, dateIso)
}

/** Growth screen age cards. */
export function ageCards(birthIso: string, gestWeeks: number, gestDays: number, dueIso: string, todayIso: string) {
  const days = Math.max(0, daysBetween(birthIso, todayIso))
  const actual =
    days < 91 ? `${Math.floor(days / 7)} wks ${days % 7} d` : `${monthsBetween(birthIso, todayIso)} months`
  const pma = pmaDays(birthIso, gestWeeks, gestDays, todayIso)
  let corrected: string
  if (pma < TERM_DAYS) corrected = `${Math.floor(pma / 7)}+${pma % 7} wks`
  else {
    const c = pma - TERM_DAYS
    corrected = c < 91 ? `${Math.floor(c / 7)} wks ${c % 7} d` : `${monthsBetween(dueIso, todayIso)} months`
  }
  const toDue = daysBetween(todayIso, dueIso)
  const due = toDue > 0 ? `in ${toDue} day${toDue === 1 ? '' : 's'}` : toDue === 0 ? 'today' : `${-toDue} day${toDue === -1 ? '' : 's'} ago`
  return { actual, corrected, correctedLabel: pma < TERM_DAYS ? 'CORRECTED' : 'CORRECTED AGE', due }
}

/**
 * Weight gain: the latest weigh-in compared with the most recent one at least
 * 5 days earlier (so "this week" means roughly a week), or else the previous one.
 */
export function weightGain(weights: Pick<WeightLog, 'measured_on' | 'weight_g'>[]) {
  const sorted = [...weights].sort((a, b) => a.measured_on.localeCompare(b.measured_on))
  const latest = sorted[sorted.length - 1]
  if (!latest || sorted.length < 2) return null
  const earlier = sorted.slice(0, -1)
  const base = [...earlier].reverse().find((w) => daysBetween(w.measured_on, latest.measured_on) >= 5) ?? earlier[earlier.length - 1]
  const days = daysBetween(base.measured_on, latest.measured_on)
  if (days <= 0) return null
  const grams = latest.weight_g - base.weight_g
  return { grams, days, perDay: Math.round(grams / days), since: base.measured_on, weekly: days >= 5 && days <= 9 }
}

export type ChartPoint = { weeks: number; kg: number; date: string }

/** Weigh-ins as (post-menstrual weeks, kg) for the chart. */
export function chartPoints(weights: Pick<WeightLog, 'measured_on' | 'weight_g'>[], birthIso: string, gw: number, gd: number): ChartPoint[] {
  return [...weights]
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
    .map((w) => ({ weeks: pmaDays(birthIso, gw, gd, w.measured_on) / 7, kg: w.weight_g / 1000, date: w.measured_on }))
}

/** Axis ranges with tidy ends: weeks in steps of 2, kg in steps of 0.5. */
export function chartScale(points: ChartPoint[], todayWeeks: number, birthWeeks: number) {
  const ws = [birthWeeks, todayWeeks, ...points.map((p) => p.weeks)]
  const minW = Math.floor(Math.min(...ws) / 2) * 2
  const maxW = Math.max(40, Math.ceil((Math.max(...ws) + 1) / 2) * 2)
  const ks = points.map((p) => p.kg)
  const minK = ks.length ? Math.max(0, Math.floor((Math.min(...ks) - 0.25) * 2) / 2) : 1
  const maxK = ks.length ? Math.ceil((Math.max(...ks) + 0.25) * 2) / 2 : 3
  return { minW, maxW, minK, maxK: Math.max(maxK, minK + 1) }
}
