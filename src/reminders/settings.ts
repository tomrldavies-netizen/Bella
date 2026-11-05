import type { Role } from '../data/types'

export const REMINDER_TYPES = ['feed', 'medicine', 'obs', 'tube', 'appointment', 'supplies', 'prescription', 'plan_change'] as const
export type ReminderType = (typeof REMINDER_TYPES)[number]

export const REMINDER_LABEL: Record<ReminderType, string> = {
  feed: 'Feeds due',
  medicine: 'Medicines due',
  obs: 'Obs due',
  tube: 'NG tube change due',
  appointment: 'Appointments (evening before and 1 hour before)',
  supplies: 'Supplies running low',
  prescription: 'Prescriptions to reorder',
  plan_change: "Bella's plan has changed",
}

/** Types with a "how long before" setting. */
export const LEAD_TYPES = ['feed', 'medicine', 'obs'] as const
export type LeadType = (typeof LEAD_TYPES)[number]

/** Types that can be set to alarm (agreed: feeds and medicines). */
export const ALARM_TYPES = ['feed', 'medicine'] as const
export type AlarmType = (typeof ALARM_TYPES)[number]

export type ReminderSettings = {
  types?: Partial<Record<ReminderType, boolean>>
  lead?: Partial<Record<LeadType, number>>
  quiet?: { start: string; end: string } | null
  /** Alarm mode: repeats every 2 min for up to 20 min after the due time. */
  alarm?: Partial<Record<AlarmType, boolean>>
  /** Work hours (1 = Monday): alarms become ordinary notifications. */
  work?: { days: number[]; start: string; end: string } | null
}

export const isAlarm = (s: ReminderSettings, role: Parameters<typeof isOn>[1], type: AlarmType) => isOn(s, role, type) && !!s.alarm?.[type]

/** Same defaults as the database (app.reminder_on): all on for parents; helpers only plan changes. */
export function isOn(s: ReminderSettings, role: Role, type: ReminderType): boolean {
  return s.types?.[type] ?? (type === 'plan_change' || role === 'parent')
}

export const leadOf = (s: ReminderSettings, type: LeadType) => s.lead?.[type] ?? 10
