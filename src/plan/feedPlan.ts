import { formatNumber, listWords } from '../lib/ukTime'

export type MilkType = 'breast' | 'formula' | 'mix'
export type FeedSlot = { time: string; milk: MilkType; ml: number }

export const MILK_LABEL: Record<MilkType, string> = {
  breast: 'Breast milk',
  formula: 'Formula',
  mix: 'Mix (half each)',
}
const MILK_WORD: Record<MilkType, string> = { breast: 'breast milk', formula: 'formula', mix: 'mix' }
const ORDER: MilkType[] = ['breast', 'formula', 'mix']

export const cycleMilk = (m: MilkType): MilkType => ORDER[(ORDER.indexOf(m) + 1) % ORDER.length]

export const sortSlots = (slots: FeedSlot[]) => [...slots].sort((a, b) => a.time.localeCompare(b.time))

export function planTotals(slots: FeedSlot[]) {
  const counts = { breast: 0, formula: 0, mix: 0 }
  let totalMl = 0
  for (const s of slots) {
    counts[s.milk] += 1
    totalMl += s.ml
  }
  return { feeds: slots.length, totalMl, counts }
}

/** "every 3 hrs" when the feeds are evenly spaced round the clock, else null. */
export function evenInterval(slots: FeedSlot[]): string | null {
  if (slots.length < 2) return null
  const mins = sortSlots(slots).map((s) => {
    const [h, m] = s.time.split(':').map(Number)
    return h * 60 + m
  })
  const gaps = mins.map((m, i) => ((i + 1 < mins.length ? mins[i + 1] : mins[0] + 1440) - m))
  if (!gaps.every((g) => g === gaps[0])) return null
  const hrs = gaps[0] / 60
  return `every ${formatNumber(hrs)} hr${hrs === 1 ? '' : 's'}`
}

/** "8 feeds · 405 ml a day · 6 breast milk, 2 formula" */
export function describePlan(slots: FeedSlot[]): string {
  if (slots.length === 0) return 'No feeds set yet'
  const { feeds, totalMl, counts } = planTotals(slots)
  const kinds = ORDER.filter((k) => counts[k] > 0).map((k) => `${counts[k]} ${MILK_WORD[k]}`)
  return `${feeds} feed${feeds === 1 ? '' : 's'} · ${formatNumber(totalMl)} ml a day · ${kinds.join(', ')}`
}

/**
 * Feeds every `hours` hours from `first`, round the clock. The parent chooses
 * every value; nothing here is a recommendation.
 */
export function fillEvery(hours: number, first: string, ml: number, milk: MilkType): FeedSlot[] {
  const [h, m] = first.split(':').map(Number)
  const start = h * 60 + m
  const step = Math.round(hours * 60)
  if (step <= 0) return []
  const slots: FeedSlot[] = []
  for (let t = start; t < start + 1440; t += step) {
    const mins = t % 1440
    const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
    slots.push({ time, milk, ml })
  }
  return sortSlots(slots)
}

const feedsWord = (times: string[]) => `${listWords(times)} feed${times.length === 1 ? '' : 's'}`

function groupBy<T>(items: T[], key: (t: T) => string): T[][] {
  const map = new Map<string, T[]>()
  for (const i of items) {
    const k = key(i)
    map.set(k, [...(map.get(k) ?? []), i])
  }
  return [...map.values()]
}

/**
 * Plain-words summary of a feed plan change, e.g.
 * "06:00 and 15:00 feeds now formula, 50 ml; 12:00 feed 50 → 55 ml".
 * Returns "" when nothing changed.
 */
export function summariseFeedChange(before: FeedSlot[] | null, after: FeedSlot[]): string {
  if (!before || before.length === 0) return after.length ? `New feed plan: ${describePlan(after)}` : ''
  const old = new Map(before.map((s) => [s.time, s]))
  const now = new Map(after.map((s) => [s.time, s]))
  const parts: string[] = []

  const milkChanged = sortSlots(after).filter((s) => old.has(s.time) && old.get(s.time)!.milk !== s.milk)
  for (const g of groupBy(milkChanged, (s) => `${s.milk}|${s.ml}`)) {
    parts.push(`${feedsWord(g.map((s) => s.time))} now ${MILK_WORD[g[0].milk]}, ${formatNumber(g[0].ml)} ml`)
  }

  const amountChanged = sortSlots(after).filter(
    (s) => old.has(s.time) && old.get(s.time)!.milk === s.milk && old.get(s.time)!.ml !== s.ml,
  )
  for (const g of groupBy(amountChanged, (s) => `${old.get(s.time)!.ml}|${s.ml}`)) {
    parts.push(
      `${feedsWord(g.map((s) => s.time))} ${formatNumber(old.get(g[0].time)!.ml)} → ${formatNumber(g[0].ml)} ml`,
    )
  }

  const added = sortSlots(after).filter((s) => !old.has(s.time))
  for (const g of groupBy(added, (s) => `${s.milk}|${s.ml}`)) {
    parts.push(`Added ${feedsWord(g.map((s) => s.time))}, ${formatNumber(g[0].ml)} ml ${MILK_WORD[g[0].milk]}`)
  }

  const removed = sortSlots(before).filter((s) => !now.has(s.time))
  if (removed.length) parts.push(`Removed ${feedsWord(removed.map((s) => s.time))}`)

  return parts.join('; ')
}

/** Next slot time after `nowTime` (HH:MM), wrapping to tomorrow's first. */
export function nextSlot(slots: FeedSlot[], nowTime: string): { time: string; tomorrow: boolean } | null {
  const sorted = sortSlots(slots)
  if (!sorted.length) return null
  const later = sorted.find((s) => s.time > nowTime)
  return later ? { time: later.time, tomorrow: false } : { time: sorted[0].time, tomorrow: true }
}
