import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as careApi from '../care/api'
import * as planApi from '../plan/api'
import { helperHousehold, renderRoutes } from '../test/fakes'

vi.mock('../plan/api', () => ({
  loadFeedPlans: vi.fn(async () => []),
  loadMedicines: vi.fn(async () => []),
  loadExercises: vi.fn(),
  loadRoutines: vi.fn(),
  loadRecentChanges: vi.fn(async () => []),
}))
vi.mock('../care/api', async (orig) => {
  const real = await orig<typeof import('../care/api')>()
  return {
    AlreadyGiven: real.AlreadyGiven,
    loadDayLogs: vi.fn(),
    loadLatestTube: vi.fn(async () => null),
    loadLatestObs: vi.fn(),
    loadGivenBetween: vi.fn(async () => []),
    loadWeights: vi.fn(),
    addLog: vi.fn(async () => 'new-id'),
    updateLog: vi.fn(async () => {}),
    deleteLog: vi.fn(async () => {}),
    giveMedicine: vi.fn(),
  }
})
const plan = vi.mocked(planApi)
const care = vi.mocked(careApi)

const NOW = new Date('2026-10-31T22:00:00Z') // 22:00 GMT, Bella 7 wks 2 d
const hip: planApi.Exercise = { id: 'hip', type: 'physio', name: 'Hip stretches', per_day: 3, timing_note: null, active: true, sort_order: 1, steps: ['On her back', 'Stop if unhappy'] }
const lips: planApi.Exercise = { id: 'lips', type: 'speech_language', name: 'Cheek and lip strokes', per_day: 2, timing_note: 'before a feed', active: true, sort_order: 1, steps: [] }

let user: ReturnType<typeof userEvent.setup>
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW })
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  vi.clearAllMocks()
  localStorage.clear()
  plan.loadExercises.mockResolvedValue([hip, lips])
  plan.loadRoutines.mockResolvedValue({ obsIntervalMin: 240, tummyGoalMin: 30, tubeChangeDays: null, tempMinC: 36.5, tempMaxC: 37.5, tasks: [] })
  care.loadDayLogs.mockResolvedValue({
    feeds: [],
    nappies: [],
    given: [],
    notes: [],
    tubeChanges: [],
    obs: [],
    exercises: [
      { id: 'e1', logged_by: 'm-dad', logged_at: '2026-10-31T09:00:00Z', exercise_id: 'hip' },
      { id: 'e2', logged_by: 'm-dad', logged_at: '2026-10-31T15:00:00Z', exercise_id: 'hip' },
    ],
    tummy: [{ id: 't1', logged_by: 'm-dad', logged_at: '2026-10-31T19:20:00Z', duration_min: 12 }],
  })
  care.loadLatestObs.mockResolvedValue({ id: 'o1', logged_by: 'm-dad', logged_at: '2026-10-31T20:30:00Z', temperature_c: 36.8, breathing: 'normal', sleep: 'settled', note: null })
  care.loadWeights.mockResolvedValue([
    { id: 'w1', logged_by: 'm-dad', logged_at: '', measured_on: '2026-10-12', weight_g: 2145, length_cm: null, head_cm: null },
    { id: 'w2', logged_by: 'm-dad', logged_at: '', measured_on: '2026-10-19', weight_g: 2310, length_cm: 45.5, head_cm: null },
  ])
})
afterEach(() => vi.useRealTimers())

describe('Care', () => {
  it('shows when obs are due and who did the last', async () => {
    renderRoutes('/care')
    expect(await screen.findByText('Obs due 00:30 · last by Dad 20:30')).toBeInTheDocument()
  })

  it('saves obs, starting from the last temperature', async () => {
    renderRoutes('/care')
    const temp = await screen.findByRole('group', { name: 'Temperature' })
    expect(within(temp).getByText('36.8 °C')).toBeInTheDocument()
    await user.click(within(temp).getByRole('button', { name: /0.1 °C more/ }))
    await user.click(screen.getByRole('radio', { name: 'Noisy' }))
    expect(screen.getByText('This will be highlighted: noisy breathing.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save obs' }))
    await waitFor(() => expect(care.addLog).toHaveBeenCalledWith('obs', 'h1', { temperature_c: 36.9, breathing: 'noisy', sleep: 'settled', note: null }))
  })

  it('warns when a temperature is outside the range the parents set', async () => {
    renderRoutes('/care')
    const temp = await screen.findByRole('group', { name: 'Temperature' })
    for (let i = 0; i < 8; i++) await user.click(within(temp).getByRole('button', { name: /0.1 °C more/ }))
    expect(screen.getByText('This will be highlighted: temperature above the normal range.')).toBeInTheDocument()
  })

  it('ticks off exercises with progress for today', async () => {
    renderRoutes('/care')
    expect(await screen.findByText('2 of 3 today')).toBeInTheDocument()
    expect(screen.getByText('0 of 2 today · before a feed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hip stretches done' }))
    await waitFor(() => expect(care.addLog).toHaveBeenCalledWith('exercise_logs', 'h1', { exercise_id: 'hip' }))
  })

  it('helpers can tick off exercises too', async () => {
    renderRoutes('/care', { household: helperHousehold() })
    await user.click(await screen.findByRole('button', { name: 'Cheek and lip strokes done' }))
    await waitFor(() => expect(care.addLog).toHaveBeenCalledWith('exercise_logs', 'h1', { exercise_id: 'lips' }))
  })

  it('adds tummy time towards the goal', async () => {
    renderRoutes('/care')
    expect(await screen.findByText('12 / 30 min')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Add minutes' }))
    await user.click(screen.getByRole('button', { name: 'Add 5 min' }))
    await waitFor(() => expect(care.addLog).toHaveBeenCalledWith('tummy_time', 'h1', { duration_min: 5 }))
  })

  it('times tummy time on this phone', async () => {
    renderRoutes('/care')
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    vi.advanceTimersByTime(4 * 60_000 + 10_000)
    await user.click(await screen.findByRole('button', { name: 'Finish' }))
    await waitFor(() => expect(care.addLog).toHaveBeenCalledWith('tummy_time', 'h1', { duration_min: 4 }))
  })
})

describe('Today with care', () => {
  it('shows obs due in Up next and the exercises in the timeline', async () => {
    renderRoutes('/')
    expect(await screen.findByText('00:30 · temp, breathing, sleep')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '15:00 Hip stretches done, Dad. Tap to edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '19:20 Tummy time 12 min, Dad. Tap to edit' })).toBeInTheDocument()
  })
})

describe('Growth', () => {
  it('shows ages, weight gain and weigh-ins', async () => {
    renderRoutes('/growth')
    expect(await screen.findByText('7 wks 2 d')).toBeInTheDocument()
    expect(screen.getByText('38+4 wks')).toBeInTheDocument()
    expect(screen.getByText('in 10 days')).toBeInTheDocument()
    expect(screen.getByText('2.31 kg')).toBeInTheDocument()
    expect(screen.getByText('+165 g this week')).toBeInTheDocument()
    expect(screen.getByText('about 24 g a day')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /2 weigh-ins, latest 2.31 kg/ })).toBeInTheDocument()
  })

  it('adds a weigh-in', async () => {
    renderRoutes('/growth')
    await user.click(await screen.findByRole('button', { name: 'Add weigh-in' }))
    await user.type(screen.getByLabelText('Weight (grams)'), '2405')
    expect(screen.getByText('2.41 kg · +95 g since last')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save weigh-in' }))
    await waitFor(() =>
      expect(care.addLog).toHaveBeenCalledWith('weights', 'h1', { measured_on: '2026-10-31', weight_g: 2405, length_cm: null, head_cm: null }),
    )
  })

  it('refuses a weight that is not in grams', async () => {
    renderRoutes('/growth')
    await user.click(await screen.findByRole('button', { name: 'Add weigh-in' }))
    await user.type(screen.getByLabelText('Weight (grams)'), '2')
    expect(screen.getByRole('button', { name: 'Save weigh-in' })).toBeDisabled()
  })
})
