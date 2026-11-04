import { addDaysIso, ukToIso } from '../lib/ukTime'
import type { Medicine } from '../plan/api'
import type { MedRoute } from '../plan/medicines'
import type { GivenLog } from './types'

/** A dose counts as missed this long after its time (agreed with the parents). */
export const MISSED_AFTER_MIN = 60
/** And shows as "due" from this long before its time. */
export const DUE_FROM_MIN = 60

export type DoseSlot = {
  medicineId: string
  name: string
  dose: number
  unit: string
  route: MedRoute
  /** HH:MM UK time */
  time: string
  /** ISO instant */
  scheduledFor: string
}

/**
 * Every scheduled dose on a UK date, using the dose version that was in force
 * at each time (so a mid-day dose change shows correctly).
 */
export function dosesForDay(medicines: Medicine[], date: string): DoseSlot[] {
  const slots: DoseSlot[] = []
  for (const m of medicines) {
    if (!m.active) continue
    for (const v of m.versions) {
      for (const time of v.times) {
        const at = ukToIso(date, time)
        const t = Date.parse(at)
        if (t < Date.parse(v.effective_from)) continue
        if (v.effective_to && t >= Date.parse(v.effective_to)) continue
        slots.push({ medicineId: m.id, name: m.name, dose: v.dose, unit: v.unit, route: v.route, time, scheduledFor: at })
      }
    }
  }
  return slots.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor) || a.name.localeCompare(b.name))
}

export type DoseStatus = 'given' | 'due' | 'missed' | 'later'

const sameInstant = (a: string | null, b: string) => a !== null && Date.parse(a) === Date.parse(b)

export function givenFor(slot: DoseSlot, given: GivenLog[]): GivenLog[] {
  return given
    .filter((g) => g.medicine_id === slot.medicineId && sameInstant(g.scheduled_for, slot.scheduledFor))
    .sort((a, b) => a.given_at.localeCompare(b.given_at))
}

export function doseStatus(slot: DoseSlot, given: GivenLog[], now: Date): DoseStatus {
  if (givenFor(slot, given).length) return 'given'
  const mins = (now.getTime() - Date.parse(slot.scheduledFor)) / 60000
  if (mins > MISSED_AFTER_MIN) return 'missed'
  if (mins >= -DUE_FROM_MIN) return 'due'
  return 'later'
}

/** The next dose still to give (due now, or later today/tomorrow). */
export function nextDose(medicines: Medicine[], given: GivenLog[], today: string, now: Date): DoseSlot | null {
  const slots = [...dosesForDay(medicines, today), ...dosesForDay(medicines, addDaysIso(today, 1))]
  return slots.find((s) => ['due', 'later'].includes(doseStatus(s, given, now))) ?? null
}
