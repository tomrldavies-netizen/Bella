import { formatNumber, listWords } from '../lib/ukTime'

export type Recurrence = { kind: 'every_n_days'; every: number } | { kind: 'weekly'; days: number[] }
export type CareTaskDraft = { id: string | null; name: string; recurrence: Recurrence }
export type RoutinesState = {
  obsIntervalMin: number | null
  tummyGoalMin: number
  tubeChangeDays: number | null
  /** Normal temperature range from Bella's team; both null when not set. */
  tempMinC: number | null
  tempMaxC: number | null
  tasks: CareTaskDraft[]
}

/** "36.5–37.5 °C" */
export const formatTempRange = (min: number, max: number) => `${min.toFixed(1)}–${max.toFixed(1)} °C`

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

/** 240 → "4 hrs", 90 → "1½ hrs", 30 → "30 min" */
export function formatInterval(min: number): string {
  if (min < 60) return `${min} min`
  const hrs = min / 60
  const whole = Math.floor(hrs)
  if (hrs === whole) return `${whole} hr${whole === 1 ? '' : 's'}`
  if (min % 30 === 0) return `${whole}½ hrs`
  return `${formatNumber(hrs)} hrs`
}

export function describeRecurrence(r: Recurrence): string {
  if (r.kind === 'every_n_days') return r.every === 1 ? 'Every day' : `Every ${r.every} days`
  const days = [...r.days].sort().map((d) => WEEKDAYS[d - 1])
  return days.length === 7 ? 'Every day' : `Every ${listWords(days)}`
}

/** "Obs every 4 hrs · tube change every 7 days" */
export function describeRoutines(r: Pick<RoutinesState, 'obsIntervalMin' | 'tubeChangeDays'>): string {
  const parts = [
    r.obsIntervalMin ? `Obs every ${formatInterval(r.obsIntervalMin)}` : null,
    r.tubeChangeDays ? `tube change every ${r.tubeChangeDays} day${r.tubeChangeDays === 1 ? '' : 's'}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Not set yet'
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

const recKey = (r: Recurrence) => (r.kind === 'every_n_days' ? `n${r.every}` : `w${[...r.days].sort()}`)

/** Plain words for a routines change. "" when unchanged. */
export function summariseRoutineChange(before: RoutinesState, after: RoutinesState): string {
  const parts: string[] = []
  if (before.obsIntervalMin !== after.obsIntervalMin) {
    parts.push(
      after.obsIntervalMin
        ? `Obs every ${formatInterval(after.obsIntervalMin)}${before.obsIntervalMin ? ` (was ${formatInterval(before.obsIntervalMin)})` : ''}`
        : 'Obs interval removed',
    )
  }
  if (before.tummyGoalMin !== after.tummyGoalMin) {
    parts.push(`Tummy time goal ${before.tummyGoalMin} → ${after.tummyGoalMin} min a day`)
  }
  if (before.tubeChangeDays !== after.tubeChangeDays) {
    parts.push(after.tubeChangeDays ? `Tube change every ${after.tubeChangeDays} days` : 'Tube change interval removed')
  }
  const range = (r: RoutinesState) => (r.tempMinC !== null && r.tempMaxC !== null ? formatTempRange(r.tempMinC, r.tempMaxC) : null)
  if (range(before) !== range(after)) {
    parts.push(range(after) ? `Normal temperature range ${range(after)}` : 'Normal temperature range removed')
  }
  const old = new Map(before.tasks.filter((t) => t.id).map((t) => [t.id, t]))
  const kept = new Set<string>()
  for (const t of after.tasks) {
    const was = t.id ? old.get(t.id) : undefined
    if (!was) {
      parts.push(`Added ${t.name} (${lowerFirst(describeRecurrence(t.recurrence))})`)
      continue
    }
    kept.add(was.id!)
    if (was.name !== t.name) parts.push(`${was.name} renamed to ${t.name}`)
    if (recKey(was.recurrence) !== recKey(t.recurrence)) parts.push(`${t.name} now ${lowerFirst(describeRecurrence(t.recurrence))}`)
  }
  for (const t of before.tasks) if (t.id && !kept.has(t.id)) parts.push(`Removed ${t.name}`)
  return parts.join('; ')
}
