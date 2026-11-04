import { supabase } from '../lib/supabase'
import type { Appointment, CareTaskLog, ExpressingSession, Milestone, PlanChangeSeen, Prescription, Question, Supply } from './types'

function db() {
  if (!supabase) throw new Error('Not connected')
  return supabase
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

const list = async <T>(table: string, householdId: string, order: string, ascending = true, extra?: (q: any) => any): Promise<T[]> => {
  let q = db().from(table).select('*').eq('household_id', householdId).order(order, { ascending })
  if (extra) q = extra(q)
  return check<T[]>(await q)
}

const insert = async (table: string, householdId: string, row: object) =>
  check<{ id: string }>(await db().from(table).insert({ household_id: householdId, ...row }).select('id').single()).id
const update = async (table: string, id: string, patch: object) => void check(await db().from(table).update(patch).eq('id', id))
const remove = async (table: string, id: string) => void check(await db().from(table).delete().eq('id', id))

// ------------------------------------------------------------------ appointments & questions
export const loadAppointments = (h: string) => list<Appointment>('appointments', h, 'starts_at')
export const addAppointment = (h: string, row: Omit<Appointment, 'id'>) => insert('appointments', h, row)
export const updateAppointment = (id: string, row: Partial<Omit<Appointment, 'id'>>) => update('appointments', id, row)
export const deleteAppointment = (id: string) => remove('appointments', id)

export const loadQuestions = (h: string) => list<Question>('questions', h, 'logged_at', false)
export const addQuestion = (h: string, text: string, appointmentId: string | null) => insert('questions', h, { text, appointment_id: appointmentId })
export const updateQuestion = (id: string, patch: Partial<Pick<Question, 'text' | 'appointment_id' | 'answered' | 'answer'>>) => update('questions', id, patch)
export const deleteQuestion = (id: string) => remove('questions', id)

// ------------------------------------------------------------------ supplies
export const loadSupplies = async (h: string) => (await list<Supply>('supplies', h, 'name')).map((s) => ({ ...s, quantity: Number(s.quantity) }))
export const addSupply = (h: string, row: Omit<Supply, 'id'>) => insert('supplies', h, row)
export const updateSupply = (id: string, patch: Partial<Omit<Supply, 'id' | 'quantity'>>) => update('supplies', id, patch)
export const deleteSupply = (id: string) => remove('supplies', id)
/** Anyone in the household may change the count (agreed with the parents). */
export async function setSupplyQuantity(id: string, quantity: number) {
  check(await db().rpc('set_supply_quantity', { p_supply_id: id, p_quantity: quantity }))
}
/** Offered the first time: counts start at 0 until the parents enter real ones. */
export const DEFAULT_SUPPLIES = ['NG tubes', 'Syringes', 'Tube tape', 'Fortifier']

// ------------------------------------------------------------------ care tasks
export const loadCareTaskLogs = (h: string) =>
  list<CareTaskLog>('care_task_logs', h, 'logged_at', false, (q) => q.gte('logged_at', new Date(Date.now() - 90 * 86_400_000).toISOString()))
export const tickCareTask = (h: string, taskId: string) => insert('care_task_logs', h, { care_task_id: taskId })
export const untickCareTask = (id: string) => remove('care_task_logs', id)

// ------------------------------------------------------------------ prescriptions
export const loadPrescriptions = async (h: string) =>
  (await list<Prescription>('prescriptions', h, 'opened_at', false)).map((p) => ({ ...p, bottle_volume: Number(p.bottle_volume) }))
/** A new bottle: a new row (history kept) with the bottle size and reorder warning. */
export const openBottle = (h: string, medicineId: string, bottleVolume: number, reorderDays: number, openedAt = new Date().toISOString()) =>
  insert('prescriptions', h, { medicine_id: medicineId, bottle_volume: bottleVolume, reorder_threshold_days: reorderDays, opened_at: openedAt })
export const updatePrescription = (id: string, patch: Partial<Pick<Prescription, 'bottle_volume' | 'reorder_threshold_days' | 'opened_at' | 'reordered_at'>>) =>
  update('prescriptions', id, patch)

// ------------------------------------------------------------------ expressing
export const loadExpressing = async (h: string) =>
  (await list<ExpressingSession>('expressing_sessions', h, 'logged_at', false, (q) => q.limit(200))).map((s) => ({
    ...s,
    left_ml: Number(s.left_ml),
    right_ml: Number(s.right_ml),
  }))
export const addExpressing = (h: string, row: Omit<ExpressingSession, 'id' | 'logged_by' | 'used_at'>) => insert('expressing_sessions', h, row)
export const updateExpressing = (id: string, patch: Partial<Omit<ExpressingSession, 'id' | 'logged_by'>>) => update('expressing_sessions', id, patch)
export const deleteExpressing = (id: string) => remove('expressing_sessions', id)

// ------------------------------------------------------------------ firsts (with private photos)
export const loadMilestones = (h: string) => list<Milestone>('milestones', h, 'date', false)
export const addMilestone = (h: string, row: Pick<Milestone, 'title' | 'date' | 'photo_url'>) => insert('milestones', h, row)
export const updateMilestone = (id: string, row: Partial<Pick<Milestone, 'title' | 'date' | 'photo_url'>>) => update('milestones', id, row)
export const deleteMilestone = (id: string) => remove('milestones', id)

const BUCKET = 'firsts'

/** Shrinks a photo on the phone (longest side 1600 px, JPEG) before upload. */
export async function shrinkPhoto(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the photo'))), 'image/jpeg', 0.82))
}

/** Uploads to the household's private folder; returns the stored path. */
export async function uploadPhoto(householdId: string, file: File): Promise<string> {
  const path = `${householdId}/${crypto.randomUUID()}.jpg`
  const blob = await shrinkPhoto(file)
  check(await db().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
  return path
}

/** A short-lived link to view a private photo. */
export async function photoUrl(path: string): Promise<string> {
  return check<{ signedUrl: string }>(await db().storage.from(BUCKET).createSignedUrl(path, 3600)).signedUrl
}

export async function deletePhoto(path: string) {
  check(await db().storage.from(BUCKET).remove([path]))
}

// ------------------------------------------------------------------ plan changes seen
export const loadPlanChangesFull = (h: string) =>
  list<{ id: string; area: string; summary: string; changed_by: string; created_at: string; notify: boolean }>('plan_changes', h, 'created_at', false, (q) => q.limit(30))
export const loadSeen = (h: string) => list<PlanChangeSeen>('plan_change_seen', h, 'seen_at', false, (q) => q.limit(500))
export async function markSeen(h: string, changeIds: string[]) {
  if (!changeIds.length) return
  // Upsert-style: ignore ones already marked (the unique constraint protects duplicates).
  const res = await db()
    .from('plan_change_seen')
    .upsert(
      changeIds.map((id) => ({ household_id: h, plan_change_id: id })),
      { onConflict: 'plan_change_id,member_id', ignoreDuplicates: true },
    )
  check(res)
}
