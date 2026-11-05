import { careTaskStatus } from '../organise/careTasks'
import { ukToIso } from '../lib/ukTime'
import { countdown } from './countdown'
import { describePlanned, plannedFeedsAround } from './feedLog'
import { doseStatus, dosesForDay } from './medSchedule'
import { obsDueAt } from './obs'
import { tubeStatus } from './tube'
import { formatDose } from '../plan/medicines'
import type { TodayData } from './useToday'

/** Amber "due now" from the due time; red "overdue" from 15 minutes late (agreed). */
export const LATE_AFTER_MIN = 15

export type OverdueItem = {
  key: string
  kind: 'feed' | 'medicine' | 'obs' | 'tube' | 'task'
  title: string
  detail: string
  /** When it was due (ISO), if it has a time. */
  dueAt: string | null
  minsLate: number
  severity: 'due' | 'late'
  /** "35 min ago", "2 hr 10 min ago", "1 day late". */
  lateness: string
  to: string
  action: string
}

const severityOf = (mins: number) => (mins < LATE_AFTER_MIN ? 'due' : 'late')

/** Everything due or late right now. It reports; it never says what to do. */
export function overdueItems(t: Pick<TodayData, 'now' | 'today' | 'plans' | 'medicines' | 'logs' | 'scheduledGiven' | 'routines' | 'lastObs' | 'tube' | 'careTaskLogs'>): OverdueItem[] {
  const now = t.now.getTime()
  const startOfDay = Date.parse(ukToIso(t.today, '00:00'))
  const items: OverdueItem[] = []
  const lateness = (dueAt: string) => {
    const mins = Math.floor((now - Date.parse(dueAt)) / 60000)
    return { minsLate: mins, severity: severityOf(mins) as OverdueItem['severity'], lateness: mins < 1 ? 'due now' : countdown(dueAt, t.now) }
  }

  // Planned feeds today, in the last 6 hours, with no feed logged around them.
  const feeds = t.logs?.feeds ?? []
  for (const f of plannedFeedsAround(t.plans ?? [], t.now.toISOString(), 6)) {
    const at = Date.parse(f.at)
    if (at > now || at < startOfDay) continue
    const logged = feeds.some((x) => {
      const l = Date.parse(x.logged_at)
      return l >= at - 60 * 60_000 && l <= at + 3 * 60 * 60_000
    })
    if (!logged) items.push({ key: `feed:${f.at}`, kind: 'feed', title: 'Feed', detail: `due ${describePlanned(f)}`, dueAt: f.at, ...lateness(f.at), to: '/feeds', action: 'Log feed' })
  }

  // Doses whose time has passed and that aren't marked given.
  for (const d of dosesForDay(t.medicines ?? [], t.today)) {
    if (Date.parse(d.scheduledFor) > now) continue
    const st = doseStatus(d, t.scheduledGiven, t.now)
    if (st === 'due' || st === 'missed') {
      items.push({ key: `med:${d.medicineId}:${d.scheduledFor}`, kind: 'medicine', title: d.name, detail: `due ${d.time} · ${formatDose(d.dose, d.unit)}`, dueAt: d.scheduledFor, ...lateness(d.scheduledFor), to: '/meds', action: 'Mark given' })
    }
  }

  // Obs past their interval.
  const obsDue = t.lastObs ? obsDueAt(t.lastObs, t.routines?.obsIntervalMin ?? null, t.now) : null
  if (obsDue && Date.parse(obsDue) <= now) {
    items.push({ key: 'obs', kind: 'obs', title: 'Obs', detail: `due ${new Date(obsDue).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}`, dueAt: obsDue, ...lateness(obsDue), to: '/care', action: 'Do obs' })
  }

  // NG tube change past its interval (due at 09:00 on the day).
  const tube = tubeStatus(t.tube, t.routines?.tubeChangeDays ?? null, t.today)
  if (tube?.due && tube.dueDate) {
    const at = ukToIso(tube.dueDate, '09:00')
    if (Date.parse(at) <= now) items.push({ key: 'tube', kind: 'tube', title: 'NG tube change', detail: `${tube.nostril} nostril · day ${tube.day} of ${tube.intervalDays}`, dueAt: at, ...lateness(at), to: '/feeds', action: 'Log change' })
  }

  // Care tasks a day or more late.
  for (const task of t.routines?.tasks ?? []) {
    const st = careTaskStatus(task, t.careTaskLogs, t.today)
    if (st.overdueDays > 0) {
      items.push({ key: `task:${task.id}`, kind: 'task', title: task.name, detail: 'care task', dueAt: null, minsLate: st.overdueDays * 1440, severity: 'late', lateness: `${st.overdueDays} day${st.overdueDays === 1 ? '' : 's'} late`, to: '/plan', action: 'Open Plan' })
    }
  }

  // Most late first.
  return items.sort((a, b) => b.minsLate - a.minsLate)
}

/** Which tab each kind belongs to, for the red dots. */
export const OVERDUE_TAB: Record<OverdueItem['kind'], string> = { feed: '/feeds', tube: '/feeds', medicine: '/meds', obs: '/care', task: '/plan' }
