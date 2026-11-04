export type ExerciseType = 'physio' | 'speech_language'
export const EXERCISE_TYPE_LABEL: Record<ExerciseType, string> = { physio: 'Physio', speech_language: 'Speech & language' }

export type ExerciseState = {
  name: string
  perDay: number
  timingNote: string
  active: boolean
  steps: string[]
}

/** "3 times a day · during each tube feed" */
export function howOften(perDay: number, timingNote?: string | null): string {
  const freq = perDay === 1 ? 'Once a day' : `${perDay} times a day`
  const note = timingNote?.trim()
  return note ? `${freq} · ${note}` : freq
}

const cleanSteps = (s: string[]) => s.map((x) => x.trim()).filter(Boolean)

/** e.g. "Added Cheek and lip strokes", "Hip stretches now 2 times a day". "" when unchanged. */
export function summariseExerciseChange(before: ExerciseState | null, after: ExerciseState): string {
  if (!before) return `Added ${after.name}`
  const n = after.name
  const parts: string[] = []
  if (before.name !== after.name) parts.push(`${before.name} renamed to ${after.name}`)
  if (before.active && !after.active) return [...parts, `Retired ${n}`].join('; ')
  if (!before.active && after.active) parts.push(`Brought back ${n}`)
  if (before.perDay !== after.perDay) parts.push(`${n} now ${howOften(after.perDay).toLowerCase()}`)
  if (before.timingNote.trim() !== after.timingNote.trim()) {
    parts.push(after.timingNote.trim() ? `${n}: ${after.timingNote.trim()}` : `${n}: timing note removed`)
  }
  if (cleanSteps(before.steps).join('\n') !== cleanSteps(after.steps).join('\n')) parts.push(`Updated how-to steps for ${n}`)
  return parts.join('; ')
}
