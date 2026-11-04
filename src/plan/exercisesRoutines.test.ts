import { describe, expect, it } from 'vitest'
import { howOften, summariseExerciseChange, type ExerciseState } from './exercises'
import { describeRecurrence, describeRoutines, formatInterval, summariseRoutineChange, type RoutinesState } from './routines'

const hip: ExerciseState = { name: 'Hip stretches', perDay: 3, timingNote: '', active: true, steps: ['On her back', 'Stop if unhappy'] }

describe('exercises', () => {
  it('says how often', () => {
    expect(howOften(1)).toBe('Once a day')
    expect(howOften(3, 'during each tube feed')).toBe('3 times a day · during each tube feed')
  })
  it('summarises changes', () => {
    expect(summariseExerciseChange(null, { ...hip, name: 'Cheek and lip strokes' })).toBe('Added Cheek and lip strokes')
    expect(summariseExerciseChange(hip, { ...hip, perDay: 2 })).toBe('Hip stretches now 2 times a day')
    expect(summariseExerciseChange(hip, { ...hip, steps: ['Stop if unhappy', 'On her back'] })).toBe('Updated how-to steps for Hip stretches')
    expect(summariseExerciseChange(hip, { ...hip, steps: [...hip.steps, '  '] })).toBe('')
    expect(summariseExerciseChange(hip, { ...hip, active: false })).toBe('Retired Hip stretches')
  })
})

describe('routines', () => {
  it('formats intervals and repeats', () => {
    expect(formatInterval(240)).toBe('4 hrs')
    expect(formatInterval(90)).toBe('1½ hrs')
    expect(formatInterval(60)).toBe('1 hr')
    expect(describeRecurrence({ kind: 'every_n_days', every: 1 })).toBe('Every day')
    expect(describeRecurrence({ kind: 'every_n_days', every: 2 })).toBe('Every 2 days')
    expect(describeRecurrence({ kind: 'weekly', days: [4, 1] })).toBe('Every Mon and Thu')
    expect(describeRoutines({ obsIntervalMin: 240, tubeChangeDays: 7 })).toBe('Obs every 4 hrs · tube change every 7 days')
  })

  it('summarises changes', () => {
    const before: RoutinesState = {
      obsIntervalMin: 180,
      tummyGoalMin: 30,
      tubeChangeDays: null,
      tasks: [{ id: 't1', name: 'Bath', recurrence: { kind: 'weekly', days: [1] } }, { id: 't2', name: 'Skin check', recurrence: { kind: 'every_n_days', every: 1 } }],
    }
    const after: RoutinesState = {
      obsIntervalMin: 240,
      tummyGoalMin: 40,
      tubeChangeDays: 7,
      tasks: [{ id: 't1', name: 'Bath', recurrence: { kind: 'weekly', days: [1, 4] } }, { id: null, name: 'Nail trim', recurrence: { kind: 'every_n_days', every: 7 } }],
    }
    expect(summariseRoutineChange(before, after)).toBe(
      'Obs every 4 hrs (was 3 hrs); Tummy time goal 30 → 40 min a day; Tube change every 7 days; Bath now every Mon and Thu; Added Nail trim (every 7 days); Removed Skin check',
    )
    expect(summariseRoutineChange(before, before)).toBe('')
  })
})
