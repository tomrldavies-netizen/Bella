import { daysBetween } from '../lib/age'
import { ukParts } from '../lib/ukTime'
import type { TubeChange } from './types'

export type TubeStatus = {
  nostril: 'left' | 'right'
  /** Day 1 is the day it went in. */
  day: number
  intervalDays: number | null
  dueDate: string | null
  due: boolean
  retaped: string | null
}

export function tubeStatus(latest: TubeChange | null, intervalDays: number | null, today: string): TubeStatus | null {
  if (!latest) return null
  const inserted = ukParts(latest.inserted_at).date
  const day = daysBetween(inserted, today) + 1
  const due = intervalDays !== null && day > intervalDays
  let retaped: string | null = null
  if (latest.retaped_at) {
    const r = ukParts(latest.retaped_at)
    const ago = daysBetween(r.date, today)
    retaped = ago === 0 ? `retaped today at ${r.time}` : ago === 1 ? 'retaped yesterday' : `retaped ${ago} days ago`
  }
  const dueDate = intervalDays !== null ? new Date(Date.parse(inserted + 'T12:00:00Z') + intervalDays * 86_400_000).toISOString().slice(0, 10) : null
  return { nostril: latest.nostril, day, intervalDays, dueDate, due, retaped }
}

/** "Day 4 of 7 · retaped this morning" */
export function describeTube(s: TubeStatus): string {
  const days = s.intervalDays ? `Day ${s.day} of ${s.intervalDays}` : `Day ${s.day}`
  return [days, s.retaped].filter(Boolean).join(' · ')
}
