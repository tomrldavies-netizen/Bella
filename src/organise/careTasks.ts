import { daysBetween } from '../lib/age'
import { addDaysIso, ukParts } from '../lib/ukTime'
import type { CareTaskDraft } from '../plan/routines'
import type { CareTaskLog } from './types'

const weekday = (iso: string) => ((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1 // 1 = Monday

export type CareTaskStatus = { doneToday: boolean; dueToday: boolean; next: string; overdueDays: number }

/**
 * When a care task is next due. "Every N days" counts from the last time it
 * was done (due today if never done); "weekly" uses the chosen days.
 */
export function careTaskStatus(task: CareTaskDraft, logs: CareTaskLog[], today: string): CareTaskStatus {
  const done = logs
    .filter((l) => l.care_task_id === task.id)
    .map((l) => ukParts(l.logged_at).date)
    .sort()
  const last = done[done.length - 1] ?? null
  const doneToday = last === today
  if (task.recurrence.kind === 'every_n_days') {
    const due = last ? addDaysIso(last, task.recurrence.every) : today
    const overdue = Math.max(0, daysBetween(due, today))
    const next = doneToday ? addDaysIso(today, task.recurrence.every) : overdue > 0 ? today : due
    return { doneToday, dueToday: !doneToday && daysBetween(today, due) <= 0, next, overdueDays: doneToday ? 0 : overdue }
  }
  const days = task.recurrence.days
  const isDay = (d: string) => days.includes(weekday(d))
  let next = doneToday ? addDaysIso(today, 1) : today
  for (let i = 0; i < 8 && !isDay(next); i++) next = addDaysIso(next, 1)
  return { doneToday, dueToday: !doneToday && isDay(today), next, overdueDays: 0 }
}

/** "today", "tomorrow", "Fri", "Fri 14 Nov" */
export function whenWords(date: string, today: string): string {
  const d = daysBetween(today, date)
  if (d <= 0) return 'today'
  if (d === 1) return 'tomorrow'
  const day = new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
  return d < 7 ? day : `${day} ${new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
}
