import { supabase } from '../lib/supabase'
import { hhmm } from '../lib/ukTime'
import type { ExerciseType } from './exercises'
import type { FeedSlot, MilkType } from './feedPlan'
import type { DoseVersion, MedRoute } from './medicines'
import type { CareTaskDraft, Recurrence } from './routines'

function db() {
  if (!supabase) throw new Error('Not connected')
  return supabase
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// ------------------------------------------------------------------ feed plan
export type FeedPlanVersion = {
  id: string
  effective_from: string
  note: string | null
  created_by: string
  slots: FeedSlot[]
}

type FeedPlanRow = Omit<FeedPlanVersion, 'slots'> & {
  feed_plan_slots: { time_of_day: string; milk_type: MilkType; volume_ml: number }[]
}

/** All versions, newest first. */
export async function loadFeedPlans(householdId: string): Promise<FeedPlanVersion[]> {
  const rows = check<FeedPlanRow[]>(
    await db()
      .from('feed_plans')
      .select('id, effective_from, note, created_by, feed_plan_slots(time_of_day, milk_type, volume_ml)')
      .eq('household_id', householdId)
      .order('effective_from', { ascending: false }),
  )
  return rows.map(({ feed_plan_slots, ...p }) => ({
    ...p,
    slots: feed_plan_slots
      .map((s) => ({ time: hhmm(s.time_of_day), milk: s.milk_type, ml: Number(s.volume_ml) }))
      .sort((a, b) => a.time.localeCompare(b.time)),
  }))
}

export async function saveFeedPlan(args: {
  householdId: string
  effectiveFrom: string
  slots: FeedSlot[]
  note: string
  summary: string
  before: FeedSlot[] | null
  notify: boolean
}) {
  check(
    await db().rpc('save_feed_plan', {
      p_household: args.householdId,
      p_effective_from: args.effectiveFrom,
      p_slots: args.slots.map((s) => ({ time_of_day: s.time, milk_type: s.milk, volume_ml: s.ml })),
      p_note: args.note,
      p_summary: args.summary,
      p_before: args.before,
      p_after: args.slots,
      p_notify: args.notify,
    }),
  )
}

// ------------------------------------------------------------------ medicines
export type Medicine = {
  id: string
  name: string
  notes: string | null
  active: boolean
  sort_order: number
  versions: DoseVersion[]
}

type MedicineRow = Omit<Medicine, 'versions'> & {
  medicine_doses: (Omit<DoseVersion, 'times' | 'dose'> & { times: string[]; dose: number })[]
}

export async function loadMedicines(householdId: string): Promise<Medicine[]> {
  const rows = check<MedicineRow[]>(
    await db()
      .from('medicines')
      .select('id, name, notes, active, sort_order, medicine_doses(id, dose, unit, route, times, effective_from, effective_to, reason)')
      .eq('household_id', householdId)
      .order('sort_order'),
  )
  return rows.map(({ medicine_doses, ...m }) => ({
    ...m,
    versions: medicine_doses.map((d) => ({ ...d, dose: Number(d.dose), times: d.times.map(hhmm).sort() })),
  }))
}

export type DoseInput = {
  dose: number
  unit: string
  route: MedRoute
  times: string[]
  effective_from?: string
  effective_to: string | null
  reason?: string
}

export async function saveMedicine(args: {
  householdId: string
  medicineId: string | null
  name: string
  notes: string
  active: boolean
  doseMode: 'none' | 'new_version' | 'set_end'
  dose: DoseInput | null
  summary: string
  before: unknown
  after: unknown
  notify: boolean
}): Promise<string> {
  return check<string>(
    await db().rpc('save_medicine', {
      p_household: args.householdId,
      p_medicine_id: args.medicineId,
      p_name: args.name,
      p_notes: args.notes,
      p_active: args.active,
      p_dose_mode: args.doseMode,
      p_dose: args.dose,
      p_summary: args.summary,
      p_before: args.before ?? null,
      p_after: args.after ?? null,
      p_notify: args.notify,
    }),
  )
}

// ------------------------------------------------------------------ exercises
export type Exercise = {
  id: string
  type: ExerciseType
  name: string
  per_day: number
  timing_note: string | null
  active: boolean
  sort_order: number
  steps: string[]
}

type ExerciseRow = Omit<Exercise, 'steps'> & { exercise_steps: { position: number; text: string }[] }

export async function loadExercises(householdId: string): Promise<Exercise[]> {
  const rows = check<ExerciseRow[]>(
    await db()
      .from('exercises')
      .select('id, type, name, per_day, timing_note, active, sort_order, exercise_steps(position, text)')
      .eq('household_id', householdId)
      .order('sort_order'),
  )
  return rows.map(({ exercise_steps, ...e }) => ({
    ...e,
    steps: [...exercise_steps].sort((a, b) => a.position - b.position).map((s) => s.text),
  }))
}

export async function saveExercise(args: {
  householdId: string
  exerciseId: string | null
  type: ExerciseType
  name: string
  perDay: number
  timingNote: string
  active: boolean
  steps: string[]
  summary: string
  before: unknown
  after: unknown
  notify: boolean
}): Promise<string> {
  return check<string>(
    await db().rpc('save_exercise', {
      p_household: args.householdId,
      p_exercise_id: args.exerciseId,
      p_type: args.type,
      p_name: args.name,
      p_per_day: args.perDay,
      p_timing_note: args.timingNote,
      p_active: args.active,
      p_steps: args.steps,
      p_summary: args.summary,
      p_before: args.before ?? null,
      p_after: args.after ?? null,
      p_notify: args.notify,
    }),
  )
}

// ------------------------------------------------------------------ routines
export type Routines = {
  obsIntervalMin: number | null
  tummyGoalMin: number
  tubeChangeDays: number | null
  tasks: CareTaskDraft[]
}

type TaskRow = { id: string; name: string; recurrence: string; every_days: number | null; weekdays: number[] }

export async function loadRoutines(householdId: string): Promise<Routines> {
  const [settings, tasks] = await Promise.all([
    db().from('settings').select('obs_interval_min, tummy_goal_min, tube_change_days').eq('household_id', householdId).single(),
    db()
      .from('care_tasks')
      .select('id, name, recurrence, every_days, weekdays')
      .eq('household_id', householdId)
      .eq('active', true)
      .order('sort_order'),
  ])
  const s = check<{ obs_interval_min: number | null; tummy_goal_min: number; tube_change_days: number | null }>(settings)
  const t = check<TaskRow[]>(tasks)
  return {
    obsIntervalMin: s.obs_interval_min,
    tummyGoalMin: s.tummy_goal_min,
    tubeChangeDays: s.tube_change_days,
    tasks: t.map((r) => ({
      id: r.id,
      name: r.name,
      recurrence: (r.recurrence === 'weekly'
        ? { kind: 'weekly', days: r.weekdays }
        : { kind: 'every_n_days', every: r.every_days ?? 1 }) as Recurrence,
    })),
  }
}

export async function saveRoutines(args: { householdId: string; after: Routines; before: Routines; summary: string; notify: boolean }) {
  const a = args.after
  check(
    await db().rpc('save_routines', {
      p_household: args.householdId,
      p_obs_interval_min: a.obsIntervalMin,
      p_tummy_goal_min: a.tummyGoalMin,
      p_tube_change_days: a.tubeChangeDays,
      p_tasks: a.tasks.map((t) => ({
        id: t.id,
        name: t.name,
        recurrence: t.recurrence.kind,
        every_days: t.recurrence.kind === 'every_n_days' ? t.recurrence.every : null,
        weekdays: t.recurrence.kind === 'weekly' ? t.recurrence.days : [],
      })),
      p_summary: args.summary,
      p_before: args.before,
      p_after: a,
      p_notify: args.notify,
    }),
  )
}

// ------------------------------------------------------------------ recent changes
export type PlanChange = { id: string; area: string; summary: string; changed_by: string; created_at: string }

export async function loadRecentChanges(householdId: string): Promise<PlanChange[]> {
  return check<PlanChange[]>(
    await db()
      .from('plan_changes')
      .select('id, area, summary, changed_by, created_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false })
      .limit(15),
  )
}
