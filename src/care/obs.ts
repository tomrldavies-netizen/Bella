import { listWords } from '../lib/ukTime'
import type { Breathing, ObsLog, Sleep } from './types'

export const BREATHING_LABEL: Record<Breathing, string> = { normal: 'Normal', noisy: 'Noisy', pauses: 'Pauses', colour_change: 'Colour change' }
export const SLEEP_LABEL: Record<Sleep, string> = { settled: 'Settled', unsettled: 'Unsettled', very_sleepy: 'Very sleepy' }

export type TempRange = { min: number; max: number } | null

export const tempRangeOf = (r: { tempMinC: number | null; tempMaxC: number | null } | null | undefined): TempRange =>
  r && r.tempMinC !== null && r.tempMaxC !== null ? { min: r.tempMinC, max: r.tempMaxC } : null

/** What's not routine about an obs entry. Temperature only counts when the parents set a range. */
export function obsConcerns(o: Pick<ObsLog, 'temperature_c' | 'breathing' | 'sleep'>, range: TempRange): string[] {
  const out: string[] = []
  if (range && o.temperature_c !== null) {
    if (o.temperature_c < range.min) out.push('temperature below the normal range')
    if (o.temperature_c > range.max) out.push('temperature above the normal range')
  }
  const BREATHING_WORDS: Record<Breathing, string> = { normal: '', noisy: 'noisy breathing', pauses: 'breathing pauses', colour_change: 'colour change' }
  if (o.breathing && o.breathing !== 'normal') out.push(BREATHING_WORDS[o.breathing])
  if (o.sleep && o.sleep !== 'settled') out.push(SLEEP_LABEL[o.sleep].toLowerCase())
  return out
}

/** "Obs · 36.8 °C, all normal" / "Obs · 37.9 °C, noisy breathing and unsettled" */
export function describeObs(o: ObsLog, range: TempRange): string {
  const temp = o.temperature_c !== null ? `${Number(o.temperature_c).toFixed(1)} °C` : null
  const concerns = obsConcerns(o, range).filter((c) => !c.startsWith('temperature'))
  const rest = concerns.length ? listWords(concerns) : o.breathing || o.sleep ? 'all normal' : null
  return `Obs · ${[temp, rest].filter(Boolean).join(', ') || 'logged'}`
}

/** When the next obs is due: last obs + interval, or now if none logged yet. */
export function obsDueAt(last: ObsLog | null, intervalMin: number | null, now: Date): string | null {
  if (!intervalMin) return null
  if (!last) return now.toISOString()
  return new Date(Date.parse(last.logged_at) + intervalMin * 60_000).toISOString()
}
