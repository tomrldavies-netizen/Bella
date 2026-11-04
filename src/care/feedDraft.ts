import type { MilkType } from '../plan/feedPlan'
import type { PlannedFeed } from './feedLog'
import type { FeedMethod, SickLevel } from './types'

export type FeedDraft = {
  planned: PlannedFeed | null
  method: FeedMethod
  oral: number
  tube: number
  milk: MilkType | null
  fortified: boolean
  sick: SickLevel
  note: string
  /** HH:MM UK time the feed happened. */
  time: string
}

export const FEED_STEP = 5
export const FEED_FINE_STEP = 1

/** Pre-fill milk type and amount from a planned feed (SPEC §4.2). */
export function draftFromPlanned(p: PlannedFeed | null, time: string): FeedDraft {
  return { planned: p, method: 'tube', oral: 0, tube: p?.ml ?? 0, milk: p?.milk ?? null, fortified: false, sick: 'none', note: '', time }
}

/** Database row for a feed draft. */
export function feedRow(d: FeedDraft, loggedAt: string) {
  return {
    logged_at: loggedAt,
    feed_plan_slot_id: d.planned?.id ?? null,
    method: d.method,
    oral_ml: d.method === 'tube' ? 0 : d.oral,
    tube_ml: d.tube,
    milk_type: d.milk,
    fortified: d.fortified,
    sick_level: d.sick,
    note: d.note.trim() || null,
  }
}
