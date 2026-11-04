export type Appointment = { id: string; starts_at: string; with_whom: string | null; location: string | null; notes: string | null }
export type Question = { id: string; logged_by: string; logged_at: string; text: string; appointment_id: string | null; answered: boolean; answer: string | null }
export type Supply = { id: string; name: string; quantity: number; low_threshold: number; to_order: boolean }
export type CareTaskLog = { id: string; logged_by: string; logged_at: string; care_task_id: string }
export type Prescription = { id: string; medicine_id: string; bottle_volume: number; opened_at: string; reorder_threshold_days: number; reordered_at: string | null }
export type ExpressingSession = {
  id: string
  logged_by: string
  logged_at: string
  duration_min: number | null
  left_ml: number
  right_ml: number
  storage: 'fridge' | 'freezer' | 'used' | null
  used_at: string | null
}
export type Milestone = { id: string; logged_by: string; title: string; date: string; photo_url: string | null }
export type PlanChangeSeen = { plan_change_id: string; member_id: string; seen_at: string }
