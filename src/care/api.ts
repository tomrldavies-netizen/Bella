import { supabase } from '../lib/supabase'
import type { ExerciseLog, FeedLog, GivenLog, NappyLog, NoteLog, ObsLog, TubeChange, TummyLog, WeightLog } from './types'

function db() {
  if (!supabase) throw new Error('Not connected')
  return supabase
}

function check<T>(res: { data: T | null; error: { message: string; details?: string | null } | null }): T {
  if (res.error) throw Object.assign(new Error(res.error.message), { details: res.error.details ?? null })
  return res.data as T
}

export type LogTable = 'feeds' | 'nappies' | 'medicine_given' | 'tube_changes' | 'notes' | 'obs' | 'exercise_logs' | 'tummy_time' | 'weights'

export type DayLogs = {
  feeds: FeedLog[]
  nappies: NappyLog[]
  given: GivenLog[]
  notes: NoteLog[]
  tubeChanges: TubeChange[]
  obs: ObsLog[]
  exercises: ExerciseLog[]
  tummy: TummyLog[]
}

const num = <T extends object>(row: T, keys: (keyof T)[]): T => {
  const out = { ...row }
  for (const k of keys) if (out[k] !== null && out[k] !== undefined) (out as Record<keyof T, unknown>)[k] = Number(out[k])
  return out
}

/** Everything logged between two instants (a UK day), newest first. */
export async function loadDayLogs(householdId: string, fromIso: string, toIso: string): Promise<DayLogs> {
  const q = (table: LogTable) =>
    db().from(table).select('*').eq('household_id', householdId).gte('logged_at', fromIso).lt('logged_at', toIso).order('logged_at', { ascending: false })
  const [feeds, nappies, given, notes, tubeChanges, obs, exercises, tummy] = await Promise.all([
    q('feeds'),
    q('nappies'),
    q('medicine_given'),
    q('notes'),
    q('tube_changes'),
    q('obs'),
    q('exercise_logs'),
    q('tummy_time'),
  ])
  return {
    feeds: check<FeedLog[]>(feeds).map((f) => num(f, ['oral_ml', 'tube_ml'])),
    nappies: check<NappyLog[]>(nappies),
    given: check<GivenLog[]>(given).map((g) => num(g, ['dose_given'])),
    notes: check<NoteLog[]>(notes),
    tubeChanges: check<TubeChange[]>(tubeChanges),
    obs: check<ObsLog[]>(obs).map((o) => num(o, ['temperature_c'])),
    exercises: check<ExerciseLog[]>(exercises),
    tummy: check<TummyLog[]>(tummy),
  }
}

/** The most recent obs ever (for "obs due"). */
export async function loadLatestObs(householdId: string): Promise<ObsLog | null> {
  const row = check<ObsLog | null>(
    await db().from('obs').select('*').eq('household_id', householdId).order('logged_at', { ascending: false }).limit(1).maybeSingle(),
  )
  return row ? num(row, ['temperature_c']) : null
}

/** Every weigh-in, oldest first. */
export async function loadWeights(householdId: string): Promise<WeightLog[]> {
  return check<WeightLog[]>(await db().from('weights').select('*').eq('household_id', householdId).order('measured_on')).map((w) =>
    num(w, ['weight_g', 'length_cm', 'head_cm']),
  )
}

/** The tube currently in (latest change). */
export async function loadLatestTube(householdId: string): Promise<TubeChange | null> {
  return check<TubeChange | null>(
    await db().from('tube_changes').select('*').eq('household_id', householdId).order('inserted_at', { ascending: false }).limit(1).maybeSingle(),
  )
}

/** Given doses for a range of scheduled times (for the double-dose check across midnight). */
export async function loadGivenBetween(householdId: string, fromIso: string, toIso: string): Promise<GivenLog[]> {
  return check<GivenLog[]>(
    await db().from('medicine_given').select('*').eq('household_id', householdId).gte('scheduled_for', fromIso).lt('scheduled_for', toIso),
  ).map((g) => num(g, ['dose_given']))
}

export async function addLog<T extends object>(table: LogTable, householdId: string, row: T): Promise<string> {
  return check<{ id: string }>(await db().from(table).insert({ household_id: householdId, ...row }).select('id').single()).id
}

export async function updateLog<T extends object>(table: LogTable, id: string, patch: T): Promise<void> {
  check(await db().from(table).update(patch).eq('id', id))
}

export async function deleteLog(table: LogTable, id: string): Promise<void> {
  check(await db().from(table).delete().eq('id', id))
}

export class AlreadyGiven extends Error {
  by: string
  at: string
  constructor(by: string, at: string) {
    super('Already given')
    this.by = by
    this.at = at
  }
}

/** Marks a dose given. Throws AlreadyGiven (with who and when) unless allowRepeat. */
export async function giveMedicine(args: {
  householdId: string
  medicineId: string
  scheduledFor: string | null
  givenAt: string
  dose: number
  allowRepeat: boolean
}): Promise<string> {
  const res = await db().rpc('give_medicine', {
    p_household: args.householdId,
    p_medicine_id: args.medicineId,
    p_scheduled_for: args.scheduledFor,
    p_given_at: args.givenAt,
    p_dose_given: args.dose,
    p_allow_repeat: args.allowRepeat,
  })
  if (res.error?.message === 'ALREADY_GIVEN') {
    const d = JSON.parse(res.error.details ?? '{}') as { by?: string; at?: string }
    throw new AlreadyGiven(d.by ?? 'Someone', d.at ?? '')
  }
  return check<string>(res)
}
