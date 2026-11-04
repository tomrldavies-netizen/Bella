import type { DayLogs } from '../care/api'
import { feedTotals, plannedDayTotal } from '../care/feedLog'
import { doseStatus, dosesForDay } from '../care/medSchedule'
import { obsConcerns, type TempRange } from '../care/obs'
import type { GivenLog, WeightLog } from '../care/types'
import { ukParts } from '../lib/ukTime'
import type { FeedPlanVersion, Medicine } from '../plan/api'

export type FeedBar = { time: string; hour: number; oral: number; tube: number }

/** The numbers for one UK day (SPEC §4.7). */
export function daySummary(args: {
  date: string
  logs: DayLogs
  given: GivenLog[]
  plans: FeedPlanVersion[]
  medicines: Medicine[]
  tummyGoal: number
  range: TempRange
  weights: WeightLog[]
  now: Date
}) {
  const { date, logs, given, plans, medicines, tummyGoal, range, weights, now } = args
  const feeds = feedTotals(logs.feeds)
  const scheduled = dosesForDay(medicines, date)
  const statuses = scheduled.map((s) => doseStatus(s, given, now))
  const sick = logs.feeds.filter((f) => f.sick_level !== 'none')
  const temps = logs.obs.map((o) => o.temperature_c).filter((t): t is number => t !== null)
  const flagged = logs.obs.filter((o) => obsConcerns(o, range).length > 0).length
  const lastNappy = [...logs.nappies].sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0]
  const bars: FeedBar[] = [...logs.feeds]
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .map((f) => {
      const t = ukParts(f.logged_at).time
      const [h, m] = t.split(':').map(Number)
      return { time: t, hour: h + m / 60, oral: Number(f.oral_ml), tube: Number(f.tube_ml) }
    })
  return {
    milk: { total: feeds.total, target: plannedDayTotal(plans, date), count: feeds.count, oral: feeds.oral, pctByMouth: feeds.pctByMouth },
    nappies: { wet: logs.nappies.filter((n) => n.wet).length, dirty: logs.nappies.filter((n) => n.dirty).length, last: lastNappy ? ukParts(lastNappy.logged_at).time : null },
    meds: { given: statuses.filter((s) => s === 'given').length, scheduled: scheduled.length, missed: statuses.filter((s) => s === 'missed').length },
    tummy: { minutes: logs.tummy.reduce((s, t) => s + t.duration_min, 0), goal: tummyGoal },
    sick: {
      possets: sick.filter((f) => f.sick_level === 'posset').length,
      sick: sick.filter((f) => f.sick_level === 'small' || f.sick_level === 'large').length,
      large: sick.filter((f) => f.sick_level === 'large').length,
    },
    obs: { count: logs.obs.length, normal: logs.obs.length - flagged, flagged, tempMin: temps.length ? Math.min(...temps) : null, tempMax: temps.length ? Math.max(...temps) : null },
    weight: weights.find((w) => w.measured_on === date) ?? null,
    bars,
  }
}
