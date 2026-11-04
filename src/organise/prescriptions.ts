import { daysBetween } from '../lib/age'
import { ukParts } from '../lib/ukTime'
import type { Medicine } from '../plan/api'
import { latestVersion } from '../plan/medicines'
import type { Prescription } from './types'

/** Planned amount a day from the latest dose version (dose × times a day). */
export function dailyDose(med: Medicine): number {
  const v = latestVersion(med.versions)
  return v ? v.dose * v.times.length : 0
}

export type PrescriptionStatus = { daysLeft: number; low: boolean; reordered: boolean }

/**
 * Rough days left in the bottle: what's in it, less the planned daily dose for
 * each day since it was opened. An estimate from the plan, not a measurement.
 */
export function prescriptionStatus(rx: Prescription, med: Medicine, today: string): PrescriptionStatus | null {
  const perDay = dailyDose(med)
  if (perDay <= 0) return null
  const used = perDay * Math.max(0, daysBetween(ukParts(rx.opened_at).date, today))
  const daysLeft = Math.max(0, Math.floor((rx.bottle_volume - used) / perDay))
  const reordered = rx.reordered_at !== null
  return { daysLeft, reordered, low: !reordered && daysLeft <= rx.reorder_threshold_days }
}

/** The bottle in use: the most recently opened. */
export const currentPrescription = (all: Prescription[], medicineId: string) =>
  all.filter((p) => p.medicine_id === medicineId).sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0] ?? null
