import type { MilkType } from '../plan/feedPlan'

export type FeedMethod = 'tube' | 'bottle_tube' | 'breast_tube'
export type SickLevel = 'none' | 'posset' | 'small' | 'large'

export type FeedLog = {
  id: string
  logged_by: string
  logged_at: string
  feed_plan_slot_id: string | null
  started_at: string | null
  ended_at: string | null
  method: FeedMethod
  oral_ml: number
  tube_ml: number
  milk_type: MilkType | null
  fortified: boolean
  sick_level: SickLevel
  note: string | null
}

export type NappyLog = { id: string; logged_by: string; logged_at: string; wet: boolean; dirty: boolean; note: string | null }

export type GivenLog = {
  id: string
  logged_by: string
  logged_at: string
  medicine_id: string
  scheduled_for: string | null
  given_at: string
  dose_given: number | null
}

export type TubeChange = {
  id: string
  logged_by: string
  logged_at: string
  nostril: 'left' | 'right'
  inserted_at: string
  retaped_at: string | null
  note: string | null
}

export type NoteLog = { id: string; logged_by: string; logged_at: string; text: string }

export type Breathing = 'normal' | 'noisy' | 'pauses' | 'colour_change'
export type Sleep = 'settled' | 'unsettled' | 'very_sleepy'

export type ObsLog = {
  id: string
  logged_by: string
  logged_at: string
  temperature_c: number | null
  breathing: Breathing | null
  sleep: Sleep | null
  note: string | null
}

export type ExerciseLog = { id: string; logged_by: string; logged_at: string; exercise_id: string }
export type TummyLog = { id: string; logged_by: string; logged_at: string; duration_min: number }
export type WeightLog = {
  id: string
  logged_by: string
  logged_at: string
  measured_on: string
  weight_g: number
  length_cm: number | null
  head_cm: number | null
}
