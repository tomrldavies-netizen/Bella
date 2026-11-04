import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as careApi from '../care/api'
import * as orgApi from '../organise/api'
import * as planApi from '../plan/api'
import { dad, fakeHousehold, helper, helperHousehold, readyState, renderRoutes } from '../test/fakes'

vi.mock('../plan/api', () => ({
  loadFeedPlans: vi.fn(),
  loadMedicines: vi.fn(),
  loadExercises: vi.fn(async () => []),
  loadRoutines: vi.fn(),
  loadRecentChanges: vi.fn(),
}))
vi.mock('../care/api', async (orig) => {
  const real = await orig<typeof import('../care/api')>()
  return {
    AlreadyGiven: real.AlreadyGiven,
    loadDayLogs: vi.fn(),
    loadLatestTube: vi.fn(async () => null),
    loadLatestObs: vi.fn(async () => null),
    loadGivenBetween: vi.fn(),
    loadWeights: vi.fn(async () => []),
    addLog: vi.fn(async () => 'id'),
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    giveMedicine: vi.fn(),
  }
})
vi.mock('../organise/api', async (orig) => {
  const real = await orig<typeof import('../organise/api')>()
  const fns = Object.fromEntries(Object.keys(real).filter((k) => typeof (real as Record<string, unknown>)[k] === 'function').map((k) => [k, vi.fn(async () => [])]))
  return { ...fns, DEFAULT_SUPPLIES: real.DEFAULT_SUPPLIES }
})
const plan = vi.mocked(planApi)
const care = vi.mocked(careApi)
const org = vi.mocked(orgApi)

const NOW = new Date('2026-12-03T20:00:00Z') // Thursday 3 Dec, 20:00 GMT
const vit: planApi.Medicine = {
  id: 'vit', name: 'Vitamin drops', notes: null, active: true, sort_order: 1,
  versions: [{ id: 'v', dose: 0.5, unit: 'ml', route: 'mouth', times: ['09:00'], effective_from: '2026-10-01T00:00:00Z', effective_to: null, reason: null }],
}
const emptyDay = { feeds: [], nappies: [], given: [], notes: [], tubeChanges: [], obs: [], exercises: [], tummy: [] }

let user: ReturnType<typeof userEvent.setup>
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW })
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  vi.clearAllMocks()
  plan.loadFeedPlans.mockResolvedValue([
    { id: 'p', effective_from: '2026-11-01T00:00:00Z', note: null, created_by: 'm-dad', slots: ['06:00', '12:00', '18:00'].map((time) => ({ time, milk: 'breast' as const, ml: 60 })) },
  ])
  plan.loadMedicines.mockResolvedValue([vit])
  plan.loadRoutines.mockResolvedValue({
    obsIntervalMin: null, tummyGoalMin: 30, tubeChangeDays: null, tempMinC: 36.5, tempMaxC: 37.5,
    tasks: [{ id: 'bath', name: 'Bath', recurrence: { kind: 'weekly', days: [4] } }],
  })
  plan.loadRecentChanges.mockResolvedValue([])
  care.loadDayLogs.mockResolvedValue(emptyDay)
  care.loadGivenBetween.mockResolvedValue([])
  org.loadAppointments.mockResolvedValue([{ id: 'a1', starts_at: '2026-12-08T10:30:00Z', with_whom: 'Community nurse', location: 'home visit', notes: null }])
  org.loadQuestions.mockResolvedValue([{ id: 'q1', logged_by: 'm-dad', logged_at: '', text: 'How long will she need iron?', appointment_id: 'a1', answered: false, answer: null }])
  org.loadSupplies.mockResolvedValue([{ id: 's1', name: 'NG tubes', quantity: 3, low_threshold: 5, to_order: false }])
  org.loadCareTaskLogs.mockResolvedValue([])
  org.loadPrescriptions.mockResolvedValue([{ id: 'rx', medicine_id: 'vit', bottle_volume: 25, opened_at: '2026-10-20T12:00:00Z', reorder_threshold_days: 7, reordered_at: null }])
  org.loadPlanChangesFull.mockResolvedValue([])
  org.loadSeen.mockResolvedValue([])
  org.loadExpressing.mockResolvedValue([])
  org.loadMilestones.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('Plan screen', () => {
  it('shows appointments with their questions, supplies and care tasks', async () => {
    renderRoutes('/plan')
    expect((await screen.findAllByText('Community nurse')).length).toBe(2)
    expect(screen.getByText('1 Q')).toBeInTheDocument()
    expect(screen.getByText('How long will she need iron?')).toBeInTheDocument()
    expect(screen.getByText('3 left · running low')).toBeInTheDocument()
    expect(await screen.findByText('Due today · every Thu')).toBeInTheDocument()
  })

  it('adds a question tagged to an appointment', async () => {
    renderRoutes('/plan')
    await user.type(await screen.findByRole('textbox', { name: 'New question' }), 'Can we try more bottles?')
    await user.selectOptions(screen.getByRole('combobox', { name: 'For which appointment' }), 'a1')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(org.addQuestion).toHaveBeenCalledWith('h1', 'Can we try more bottles?', 'a1'))
  })

  it('lets a helper change a supply count and tick off a care task', async () => {
    renderRoutes('/plan', { household: helperHousehold() })
    const tubes = await screen.findByRole('group', { name: 'NG tubes count' })
    await user.click(within(tubes).getByRole('button', { name: /1\s+less/ }))
    await waitFor(() => expect(org.setSupplyQuantity).toHaveBeenCalledWith('s1', 2))
    await user.click(screen.getByRole('button', { name: 'Bath done' }))
    await waitFor(() => expect(org.tickCareTask).toHaveBeenCalledWith('h1', 'bath'))
    // Helpers can't add appointments or supply items.
    expect(screen.queryByRole('button', { name: '+ Add' })).not.toBeInTheDocument()
  })
})

describe('Medicines prescriptions', () => {
  it('estimates days left and offers reordering', async () => {
    renderRoutes('/meds')
    // 25 ml bottle, 0.5 ml a day, opened 20 Oct → about 6 days left on 3 Dec.
    expect(await screen.findByText('About 6 days left · time to reorder')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reordered' }))
    await waitFor(() => expect(org.updatePrescription).toHaveBeenCalledWith('rx', expect.objectContaining({ reordered_at: expect.any(String) })))
  })
})

describe('Today extras', () => {
  it('shows the next appointment, care tasks due and running low', async () => {
    renderRoutes('/')
    expect(await screen.findByText('10:30 · home visit')).toBeInTheDocument()
    expect(screen.getByText('tick it off in Plan')).toBeInTheDocument()
    expect(screen.getByText('NG tubes (3)')).toBeInTheDocument()
    expect(screen.getByText('Vitamin drops, about 6 days')).toBeInTheDocument()
  })

  it('shows the plan-changed banner until Got it', async () => {
    org.loadPlanChangesFull.mockResolvedValue([{ id: 'c1', area: 'feeds', summary: '06:00 and 15:00 feeds now formula, 50 ml', changed_by: 'm-dad', created_at: '2026-12-01T10:00:00Z', notify: true }])
    const hh = fakeHousehold({ state: { ...readyState, me: helper, members: [dad, helper] } as typeof readyState })
    renderRoutes('/', { household: hh })
    expect(await screen.findByText("Bella's plan has changed")).toBeInTheDocument()
    expect(screen.getByText('06:00 and 15:00 feeds now formula, 50 ml')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Got it' }))
    await waitFor(() => expect(org.markSeen).toHaveBeenCalledWith('h1', ['c1']))
  })

  it('does not show my own changes as news', async () => {
    org.loadPlanChangesFull.mockResolvedValue([{ id: 'c1', area: 'feeds', summary: 'x', changed_by: 'm-dad', created_at: '2026-12-01T10:00:00Z', notify: true }])
    renderRoutes('/')
    await screen.findByText('10:30 · home visit')
    expect(screen.queryByText("Bella's plan has changed")).not.toBeInTheDocument()
  })
})

describe('Daily summary', () => {
  it('adds up the day', async () => {
    care.loadDayLogs.mockResolvedValue({
      ...emptyDay,
      feeds: [
        { id: 'f1', logged_by: 'm-dad', logged_at: '2026-12-03T06:05:00Z', feed_plan_slot_id: null, started_at: null, ended_at: null, method: 'bottle_tube', oral_ml: 20, tube_ml: 40, milk_type: 'breast', fortified: false, sick_level: 'posset', note: null },
        { id: 'f2', logged_by: 'm-dad', logged_at: '2026-12-03T12:00:00Z', feed_plan_slot_id: null, started_at: null, ended_at: null, method: 'tube', oral_ml: 0, tube_ml: 60, milk_type: 'breast', fortified: false, sick_level: 'none', note: null },
      ],
      nappies: [{ id: 'n', logged_by: 'm-dad', logged_at: '2026-12-03T19:40:00Z', wet: true, dirty: true, note: null }],
      obs: [{ id: 'o', logged_by: 'm-dad', logged_at: '2026-12-03T10:00:00Z', temperature_c: 37.9, breathing: 'normal', sleep: 'settled', note: null }],
      tummy: [{ id: 't', logged_by: 'm-dad', logged_at: '2026-12-03T15:00:00Z', duration_min: 12 }],
      notes: [{ id: 'x', logged_by: 'm-dad', logged_at: '2026-12-03T18:00:00Z', text: 'Best bottle so far' }],
    })
    renderRoutes('/summary')
    expect(await screen.findByText('120 / 180 ml')).toBeInTheDocument()
    expect(screen.getByText('17% of total')).toBeInTheDocument()
    expect(screen.getByText('1 wet · 1 dirty')).toBeInTheDocument()
    expect(screen.getByText('last 19:40')).toBeInTheDocument()
    expect(screen.getByText('0 / 1 given')).toBeInTheDocument()
    expect(screen.getByText('1 posset')).toBeInTheDocument()
    expect(screen.getByText('Obs: 0 of 1 normal · 1 highlighted')).toBeInTheDocument()
    expect(screen.getByText('Best bottle so far')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /2 feeds: 06:05 60 ml \(20 by mouth\)/ })).toBeInTheDocument()
  })

  it('moves between days but not into the future', async () => {
    renderRoutes('/summary')
    expect(await screen.findByRole('button', { name: 'Next day' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(screen.getByText('Wednesday 2 December')).toBeInTheDocument()
  })
})

describe('Expressing', () => {
  it('logs a session and counts freezer stock', async () => {
    org.loadExpressing.mockResolvedValue([
      { id: 'e1', logged_by: 'm-dad', logged_at: '2026-12-02T09:00:00Z', duration_min: 15, left_ml: 40, right_ml: 35, storage: 'freezer', used_at: null },
    ])
    renderRoutes('/feeds/expressing')
    expect(await screen.findByText('Freezer stock 75 ml')).toBeInTheDocument()
    const left = screen.getByRole('group', { name: 'Left side' })
    await user.click(within(left).getByRole('button', { name: /5 ml more/ }))
    await user.click(screen.getByRole('radio', { name: 'Freezer' }))
    await user.click(screen.getByRole('button', { name: 'Save 5 ml' }))
    await waitFor(() => expect(org.addExpressing).toHaveBeenCalledWith('h1', expect.objectContaining({ left_ml: 5, right_ml: 0, storage: 'freezer', duration_min: 15 })))
    await user.click(screen.getByRole('button', { name: 'Used' }))
    await waitFor(() => expect(org.updateExpressing).toHaveBeenCalledWith('e1', { used_at: expect.any(String) }))
  })
})
