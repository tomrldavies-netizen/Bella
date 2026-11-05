import { formatNumber, ukParts } from '../lib/ukTime'
import type { Exercise, Medicine } from '../plan/api'
import { describeObs, obsConcerns, type TempRange } from './obs'
import type { DayLogs } from './api'
import { describeFeed } from './feedLog'

export type TimelineEntry =
  | { kind: 'feed'; row: DayLogs['feeds'][number] }
  | { kind: 'nappy'; row: DayLogs['nappies'][number] }
  | { kind: 'given'; row: DayLogs['given'][number] }
  | { kind: 'note'; row: DayLogs['notes'][number] }
  | { kind: 'tube'; row: DayLogs['tubeChanges'][number] }
  | { kind: 'obs'; row: DayLogs['obs'][number] }
  | { kind: 'exercise'; row: DayLogs['exercises'][number] }
  | { kind: 'tummy'; row: DayLogs['tummy'][number] }

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
  /** Saved on this phone, waiting for signal to sync. */
  pending: boolean
}

export const DOT = { feed: '#7FA9C1', nappy: '#A994C4', given: '#E9A06B', note: '#D9B45A', tube: '#6FA89F', obs: '#8DB596', exercise: '#B5677D', speech: '#6FA89F', tummy: '#D98CA0' } as const

export function nappyText(wet: boolean, dirty: boolean): string {
  return `Nappy · ${wet && dirty ? 'wet and dirty' : wet ? 'wet' : 'dirty'}`
}

export function buildTimeline(logs: DayLogs, medicines: Medicine[], exercises: Exercise[] = [], range: TempRange = null): TimelineItem[] {
  const exercise = (id: string) => exercises.find((e) => e.id === id)
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
    ...logs.obs.map((row) => ({ entry: { kind: 'obs' as const, row }, text: describeObs(row, range), colour: DOT.obs, flagged: obsConcerns(row, range).length > 0 })),
    ...logs.exercises.map((row) => {
      const ex = exercise(row.exercise_id)
      return { entry: { kind: 'exercise' as const, row }, text: `${ex?.name ?? 'Exercise'} done`, colour: ex?.type === 'speech_language' ? DOT.speech : DOT.exercise, flagged: false }
    }),
    ...logs.tummy.map((row) => ({ entry: { kind: 'tummy' as const, row }, text: `Tummy time ${row.duration_min} min`, colour: DOT.tummy, flagged: false })),
  ].map((i) => ({
    ...i,
    key: `${i.entry.kind}:${i.entry.row.id}`,
    at: i.entry.row.logged_at,
    time: ukParts(i.entry.row.logged_at).time,
    by: i.entry.row.logged_by,
    pending: !!(i.entry.row as { _pending?: boolean })._pending,
  }))
  return items.sort((a, b) => b.at.localeCompare(a.at))
}
