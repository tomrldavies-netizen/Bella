// Wall-clock time in the UK (GMT in winter, BST in summer). Plan times such as
// "06:00 feed" always mean UK time, whatever the phone's own time zone.

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function londonFields(ms: number) {
  const p = Object.fromEntries(parts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second }
}

/** Minutes the UK is ahead of UTC at this instant (0 or 60). */
function offsetMinutes(ms: number): number {
  const f = londonFields(ms)
  const asUtc = Date.UTC(f.y, f.mo - 1, f.d, f.h, f.mi, f.s)
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** UK date and time now: { date: 'YYYY-MM-DD', time: 'HH:MM' }. */
export function ukNow(now: Date = new Date()): { date: string; time: string } {
  const f = londonFields(now.getTime())
  return { date: `${f.y}-${pad(f.mo)}-${pad(f.d)}`, time: `${pad(f.h)}:${pad(f.mi)}` }
}

/** The instant (ISO, UTC) for a UK wall-clock date and time. */
export function ukToIso(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  let ms = guess - offsetMinutes(guess) * 60000
  // Re-check near the clock change.
  ms = guess - offsetMinutes(ms) * 60000
  return new Date(ms).toISOString()
}

/** UK date and time of an instant. */
export function ukParts(iso: string): { date: string; time: string } {
  return ukNow(new Date(iso))
}

export function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** "19 Oct" */
export function shortDate(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "Today, 23:00", "Tomorrow, 05:00", "Thu 6 Nov, 05:00" */
export function friendlyDateTime(iso: string, now: Date = new Date()): string {
  const { date, time } = ukParts(iso)
  const today = ukNow(now).date
  if (date === today) return `Today, ${time}`
  if (date === addDaysIso(today, 1)) return `Tomorrow, ${time}`
  if (date === addDaysIso(today, -1)) return `Yesterday, ${time}`
  const label = new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  return `${label.replace(',', '')}, ${time}`
}

/** "06:00:00" from Postgres → "06:00" */
export const hhmm = (t: string) => t.slice(0, 5)

/** The next of these daily times strictly after `now`: today's, or tomorrow's first. */
export function nextDailyTime(times: string[], now: Date = new Date()): string | null {
  if (times.length === 0) return null
  const { date, time } = ukNow(now)
  const sorted = [...times].sort()
  const later = sorted.find((t) => t > time)
  return later ? ukToIso(date, later) : ukToIso(addDaysIso(date, 1), sorted[0])
}

/** "a", "a and b", "a, b and c" */
export function listWords(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** 1 → "1", 1.2 → "1.2", 1.25 → "1.25" */
export function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** The clock, for event handlers (render code should use useNow()). */
export const currentTime = () => new Date()
