// Age maths for a baby born early. All dates are YYYY-MM-DD strings in UK time,
// counted as whole days so clock changes never shift a day.

const DAY_MS = 86_400_000
/** 40 weeks: a full-term pregnancy. */
export const TERM_DAYS = 280

const ukDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Today's date in the UK, as YYYY-MM-DD. */
export function ukToday(now: Date = new Date()): string {
  return ukDate.format(now)
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS)
}

function fromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string): number {
  return dayNumber(toIso) - dayNumber(fromIso)
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(dayNumber(iso) + days)
}

/** Whole calendar months from one date to another (never negative). */
export function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  let months = (ty - fy) * 12 + (tm - fm)
  if (td < fd) months -= 1
  return Math.max(0, months)
}

/** Due date: birth date plus the weeks of pregnancy that were still to go. */
export function dueDateFrom(birthIso: string, gestationWeeks: number, gestationDays: number): string {
  return addDays(birthIso, TERM_DAYS - (gestationWeeks * 7 + gestationDays))
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** "5 days old", "7 wks old", "4 months old". */
export function actualAgeLabel(birthIso: string, todayIso: string): string {
  const days = daysBetween(birthIso, todayIso)
  if (days < 0) return 'Not born yet'
  if (days < 14) return `${plural(days, 'day', 'days')} old`
  if (days < 91) return `${Math.floor(days / 7)} wks old`
  return `${plural(monthsBetween(birthIso, todayIso), 'month', 'months')} old`
}

/**
 * Before 40 weeks: post-menstrual age, e.g. "36+2 corrected" (as in the mockups).
 * From 40 weeks: corrected age, e.g. "3 wks corrected", "2 months corrected".
 */
export function correctedAgeLabel(
  birthIso: string,
  gestationWeeks: number,
  gestationDays: number,
  todayIso: string,
): string {
  const daysOld = Math.max(0, daysBetween(birthIso, todayIso))
  const pma = gestationWeeks * 7 + gestationDays + daysOld
  if (pma < TERM_DAYS) return `${Math.floor(pma / 7)}+${pma % 7} corrected`
  const corrected = pma - TERM_DAYS
  if (corrected < 14) return `${plural(corrected, 'day', 'days')} corrected`
  if (corrected < 91) return `${Math.floor(corrected / 7)} wks corrected`
  const termDate = addDays(birthIso, TERM_DAYS - (gestationWeeks * 7 + gestationDays))
  return `${plural(monthsBetween(termDate, todayIso), 'month', 'months')} corrected`
}

/** "Due in 12 days", "Due date today", or null once the due date has passed. */
export function dueDateLabel(dueIso: string, todayIso: string): string | null {
  const days = daysBetween(todayIso, dueIso)
  if (days < 0) return null
  if (days === 0) return 'Due date today'
  return `Due in ${plural(days, 'day', 'days')}`
}
