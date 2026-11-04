import { addDaysIso, formatNumber, ukParts, ukToIso } from '../lib/ukTime'
import type { FeedPlanVersion } from '../plan/api'
import { MILK_LABEL, type FeedSlot, type MilkType } from '../plan/feedPlan'
import type { FeedLog, FeedMethod, SickLevel } from './types'

export const METHOD_LABEL: Record<FeedMethod, string> = { tube: 'Tube only', bottle_tube: 'Bottle + tube', breast_tube: 'Breast + tube' }
export const SICK_LABEL: Record<SickLevel, string> = { none: 'None', posset: 'Posset', small: 'Small', large: 'Large' }

/** The plan version in force at an instant. Versions are newest first. */
export function planAt(versions: FeedPlanVersion[], iso: string): FeedPlanVersion | null {
  const t = Date.parse(iso)
  return versions.find((v) => Date.parse(v.effective_from) <= t) ?? null
}

export type PlannedFeed = FeedSlot & { at: string }

/** Planned feeds on a UK date, each from the plan in force at that time. */
export function plannedFeedsForDay(versions: FeedPlanVersion[], date: string): PlannedFeed[] {
  const out: PlannedFeed[] = []
  const times = new Set(versions.flatMap((v) => v.slots.map((s) => s.time)))
  for (const time of [...times].sort()) {
    const at = ukToIso(date, time)
    const slot = planAt(versions, at)?.slots.find((s) => s.time === time)
    if (slot) out.push({ ...slot, at })
  }
  return out
}

/** The next planned feed after `now`. */
export function nextPlannedFeed(versions: FeedPlanVersion[], today: string, now: Date): PlannedFeed | null {
  const t = now.getTime()
  return [...plannedFeedsForDay(versions, today), ...plannedFeedsForDay(versions, addDaysIso(today, 1))].find((f) => Date.parse(f.at) > t) ?? null
}

/** The planned feed closest to an instant (within the same or neighbouring day). */
export function nearestPlannedFeed(versions: FeedPlanVersion[], iso: string): PlannedFeed | null {
  const { date } = ukParts(iso)
  const t = Date.parse(iso)
  const all = [-1, 0, 1].flatMap((d) => plannedFeedsForDay(versions, addDaysIso(date, d)))
  return all.reduce<PlannedFeed | null>((best, f) => (!best || Math.abs(Date.parse(f.at) - t) < Math.abs(Date.parse(best.at) - t) ? f : best), null)
}

/** Planned feeds within `hours` either side of an instant, across midnight. */
export function plannedFeedsAround(versions: FeedPlanVersion[], iso: string, hours = 12): PlannedFeed[] {
  const { date } = ukParts(iso)
  const t = Date.parse(iso)
  return [-1, 0, 1]
    .flatMap((d) => plannedFeedsForDay(versions, addDaysIso(date, d)))
    .filter((f) => Math.abs(Date.parse(f.at) - t) <= hours * 3_600_000)
}

/** Day total from the plan in force at the start of `date`'s first feed. */
export function plannedDayTotal(versions: FeedPlanVersion[], date: string): number {
  return plannedFeedsForDay(versions, date).reduce((sum, f) => sum + f.ml, 0)
}

export function feedTotals(feeds: Pick<FeedLog, 'oral_ml' | 'tube_ml'>[]) {
  const oral = feeds.reduce((s, f) => s + Number(f.oral_ml), 0)
  const tube = feeds.reduce((s, f) => s + Number(f.tube_ml), 0)
  const total = oral + tube
  return { count: feeds.length, oral, tube, total, pctByMouth: total ? Math.round((oral / total) * 100) : 0 }
}

const MILK_WORD: Record<MilkType, string> = { breast: 'breast milk', formula: 'formula', mix: 'mix' }

/** Timeline text, e.g. "Feed 50 ml · bottle 15 ml, tube 35 ml · breast milk + fortifier · posset". */
export function describeFeed(f: FeedLog): string {
  const total = Number(f.oral_ml) + Number(f.tube_ml)
  const oralWord = f.method === 'breast_tube' ? 'breast' : 'bottle'
  const how =
    f.method === 'tube' || Number(f.oral_ml) === 0
      ? 'via tube'
      : Number(f.tube_ml) === 0
        ? `${oralWord} ${formatNumber(Number(f.oral_ml))} ml`
        : `${oralWord} ${formatNumber(Number(f.oral_ml))} ml, tube ${formatNumber(Number(f.tube_ml))} ml`
  const milk = f.milk_type ? ` · ${MILK_WORD[f.milk_type]}${f.fortified ? ' + fortifier' : ''}` : f.fortified ? ' · fortifier' : ''
  const sick = f.sick_level !== 'none' ? ` · ${SICK_LABEL[f.sick_level].toLowerCase()}${f.sick_level === 'posset' ? '' : ' sick'}` : ''
  return `Feed ${formatNumber(total)} ml · ${how}${milk}${sick}`
}

/** "00:00 · 50 ml breast milk" */
export const describePlanned = (f: FeedSlot) => `${f.time} · ${formatNumber(f.ml)} ml ${MILK_LABEL[f.milk].toLowerCase()}`
