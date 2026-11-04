import { formatNumber, ukParts } from '../lib/ukTime'
import type { Medicine } from '../plan/api'
import type { DayLogs } from './api'
import { describeFeed } from './feedLog'

export type TimelineEntry =
  | { kind: 'feed'; row: DayLogs['feeds'][number] }
  | { kind: 'nappy'; row: DayLogs['nappies'][number] }
  | { kind: 'given'; row: DayLogs['given'][number] }
  | { kind: 'note'; row: DayLogs['notes'][number] }
  | { kind: 'tube'; row: DayLogs['tubeChanges'][number] }

export type TimelineItem = {
  key: string
  entry: TimelineEntry
  at: string
  time: string
  by: string
  text: string
  /** Dot colour (section accent). */
  colour: string
  /** Something non-routine worth noticing (e.g. a large sick). */
  flagged: boolean
}

export const DOT = { feed: '#7FA9C1', nappy: '#A994C4', given: '#E9A06B', note: '#D9B45A', tube: '#6FA89F' } as const

export function nappyText(wet: boolean, dirty: boolean): string {
  return `Nappy · ${wet && dirty ? 'wet and dirty' : wet ? 'wet' : 'dirty'}`
}

export function buildTimeline(logs: DayLogs, medicines: Medicine[]): TimelineItem[] {
  const medName = (id: string) => medicines.find((m) => m.id === id)?.name ?? 'Medicine'
  const medUnit = (id: string) => medicines.find((m) => m.id === id)?.versions[0]?.unit ?? 'ml'
  const items: TimelineItem[] = [
    ...logs.feeds.map((row) => ({
      entry: { kind: 'feed' as const, row },
      text: describeFeed(row),
      colour: DOT.feed,
      flagged: row.sick_level === 'large',
    })),
    ...logs.nappies.map((row) => ({ entry: { kind: 'nappy' as const, row }, text: nappyText(row.wet, row.dirty), colour: DOT.nappy, flagged: false })),
    ...logs.given.map((row) => ({
      entry: { kind: 'given' as const, row },
      text: `${medName(row.medicine_id)}${row.dose_given !== null ? ` ${formatNumber(row.dose_given)} ${medUnit(row.medicine_id)}` : ''}${row.scheduled_for ? '' : ' (extra dose)'}`,
      colour: DOT.given,
      flagged: false,
    })),
    ...logs.notes.map((row) => ({ entry: { kind: 'note' as const, row }, text: `Note · ${row.text}`, colour: DOT.note, flagged: false })),
    ...logs.tubeChanges.map((row) => ({
      entry: { kind: 'tube' as const, row },
      text: `NG tube changed · ${row.nostril} nostril`,
      colour: DOT.tube,
      flagged: false,
    })),
  ].map((i) => ({
    ...i,
    key: `${i.entry.kind}:${i.entry.row.id}`,
    at: i.entry.row.logged_at,
    time: ukParts(i.entry.row.logged_at).time,
    by: i.entry.row.logged_by,
  }))
  return items.sort((a, b) => b.at.localeCompare(a.at))
}
