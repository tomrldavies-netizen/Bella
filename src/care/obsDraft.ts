import type { Breathing, ObsLog, Sleep } from './types'

export type ObsDraft = { temp: number; breathing: Breathing; sleep: Sleep; note: string }

/** Start from the last reading so the stepper is close (no suggested value). */
export function obsDraftFrom(last: Pick<ObsLog, 'temperature_c'> | null): ObsDraft {
  return { temp: last?.temperature_c ?? 37, breathing: 'normal', sleep: 'settled', note: '' }
}

export const obsRow = (d: ObsDraft) => ({ temperature_c: d.temp, breathing: d.breathing, sleep: d.sleep, note: d.note.trim() || null })
