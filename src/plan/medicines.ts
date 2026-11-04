import { formatNumber, listWords } from '../lib/ukTime'

export type MedRoute = 'mouth' | 'tube' | 'either'
export const ROUTE_LABEL: Record<MedRoute, string> = { mouth: 'By mouth', tube: 'Via tube', either: 'Either' }
const ROUTE_WORDS: Record<MedRoute, string> = { mouth: 'by mouth', tube: 'via tube', either: 'by mouth or tube' }

/** Tap −/+ moves 1 ml; press and hold moves 0.1 ml. */
export const DOSE_STEP = 1
export const DOSE_FINE_STEP = 0.1

export type DoseVersion = {
  id: string
  dose: number
  unit: string
  route: MedRoute
  times: string[]
  effective_from: string
  effective_to: string | null
  reason: string | null
}

export type MedicineState = {
  name: string
  active: boolean
  dose: number
  unit: string
  route: MedRoute
  times: string[]
  /** YYYY-MM-DD, or null for no end date. */
  endDate: string | null
}

export const formatDose = (dose: number, unit = 'ml') => `${formatNumber(dose)} ${unit}`

/** The version in force at `now`; if none has started yet, the first upcoming one. */
export function currentVersion(versions: DoseVersion[], now: Date = new Date()): DoseVersion | null {
  const t = now.getTime()
  const sorted = [...versions].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  const live = sorted.filter(
    (v) => Date.parse(v.effective_from) <= t && (!v.effective_to || Date.parse(v.effective_to) > t),
  )
  if (live.length) return live[live.length - 1]
  return sorted.find((v) => Date.parse(v.effective_from) > t) ?? sorted[sorted.length - 1] ?? null
}

/** The latest version: what the plan says from now on (may start in the future). */
export function latestVersion(versions: DoseVersion[]): DoseVersion | null {
  return [...versions].sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null
}

/** The version that ended when `version` began, for "was 1.0 ml until 19 Oct". */
export function previousVersion(versions: DoseVersion[], version: DoseVersion): DoseVersion | null {
  return (
    [...versions]
      .filter((v) => v.effective_from < version.effective_from)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null
  )
}

const sameTimes = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join()

/** Did the dose, route or times change (which needs a new dose version)? */
export function doseChanged(before: MedicineState, after: MedicineState): boolean {
  return before.dose !== after.dose || before.unit !== after.unit || before.route !== after.route || !sameTimes(before.times, after.times)
}

function endWords(name: string, endDate: string | null, short: (d: string) => string) {
  return endDate ? `${name} ends ${short(endDate)}` : `${name} has no end date`
}

/** e.g. "Iron 1.0 ml → 1.2 ml", "Added Iron 1.2 ml by mouth at 05:00 and 17:00". "" when unchanged. */
export function summariseMedicineChange(
  before: MedicineState | null,
  after: MedicineState,
  shortDate: (d: string) => string,
): string {
  const times = (t: string[]) => listWords([...t].sort())
  if (!before) {
    const at = after.times.length ? ` at ${times(after.times)}` : ''
    return `Added ${after.name} ${formatDose(after.dose, after.unit)} ${ROUTE_WORDS[after.route]}${at}`
  }
  const n = after.name
  const parts: string[] = []
  if (before.name !== after.name) parts.push(`${before.name} renamed to ${after.name}`)
  if (before.active && !after.active) return [...parts, `Stopped ${n}`].join('; ')
  if (!before.active && after.active) parts.push(`Restarted ${n}`)
  if (before.dose !== after.dose || before.unit !== after.unit) {
    parts.push(`${n} ${formatDose(before.dose, before.unit)} → ${formatDose(after.dose, after.unit)}`)
  }
  if (before.route !== after.route) parts.push(`${n} now ${ROUTE_WORDS[after.route]}`)
  if (!sameTimes(before.times, after.times)) parts.push(`${n} times now ${times(after.times) || 'none'}`)
  if (before.endDate !== after.endDate) parts.push(endWords(n, after.endDate, shortDate))
  return parts.join('; ')
}
