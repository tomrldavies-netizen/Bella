import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as careApi from '../care/api'
import * as planApi from '../plan/api'
import { renderRoutes } from '../test/fakes'

vi.mock('../plan/api', () => ({
  loadFeedPlans: vi.fn(),
  loadMedicines: vi.fn(),
  loadExercises: vi.fn(async () => []),
  loadRoutines: vi.fn(),
  loadRecentChanges: vi.fn(async () => []),
}))
vi.mock('../care/api', async (orig) => {
  const real = await orig<typeof import('../care/api')>()
  return {
    AlreadyGiven: real.AlreadyGiven,
    loadDayLogs: vi.fn(),
    loadLatestTube: vi.fn(),
    loadGivenBetween: vi.fn(),
    addLog: vi.fn(async () => 'new-id'),
    updateLog: vi.fn(async () => {}),
    deleteLog: vi.fn(async () => {}),
    giveMedicine: vi.fn(async () => 'g-new'),
  }
})
const plan = vi.mocked(planApi)
const care = vi.mocked(careApi)

// 20:35 UK time on 4 Dec 2026 (GMT).
const NOW = new Date('2026-12-04T20:35:00Z')
const slots = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'].map((time, i) => ({ id: `s${i}`, time, milk: 'breast' as const, ml: 50 }))
const iron: planApi.Medicine = {
  id: 'iron',
  name: 'Iron',
  notes: null,
  active: true,
  sort_order: 1,
  versions: [{ id: 'v', dose: 1.2, unit: 'ml', route: 'either', times: ['11:00', '23:00'], effective_from: '2026-11-01T00:00:00Z', effective_to: null, reason: null }],
}
const ironGiven11 = { id: 'g1', logged_by: 'm-dad', logged_at: '2026-12-04T11:02:00Z', medicine_id: 'iron', scheduled_for: '2026-12-04T11:00:00.000Z', given_at: '2026-12-04T11:02:00Z', dose_given: 1.2 }

let user: ReturnType<typeof userEvent.setup>
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW })
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  vi.clearAllMocks()
  plan.loadFeedPlans.mockResolvedValue([{ id: 'p', effective_from: '2026-11-01T00:00:00Z', note: null, created_by: 'm-dad', slots }])
  plan.loadMedicines.mockResolvedValue([iron])
  plan.loadRoutines.mockResolvedValue({ obsIntervalMin: null, tummyGoalMin: 30, tubeChangeDays: 7, tasks: [] })
  care.loadDayLogs.mockResolvedValue({
    feeds: [{ id: 'f1', logged_by: 'm-dad', logged_at: '2026-12-04T18:05:00Z', feed_plan_slot_id: 's6', started_at: null, ended_at: null, method: 'bottle_tube', oral_ml: 15, tube_ml: 35, milk_type: 'breast', fortified: false, sick_level: 'none', note: null }],
    nappies: [{ id: 'n1', logged_by: 'm-dad', logged_at: '2026-12-04T19:40:00Z', wet: true, dirty: false, note: null }],
    given: [ironGiven11],
    notes: [],
    tubeChanges: [],
  })
  care.loadGivenBetween.mockResolvedValue([ironGiven11])
  care.loadLatestTube.mockResolvedValue({ id: 't1', logged_by: 'm-dad', logged_at: '', nostril: 'left', inserted_at: '2026-11-28T09:00:00Z', retaped_at: null, note: null })
})
afterEach(() => vi.useRealTimers())

describe('Today', () => {
  it('shows what is up next from the plan', async () => {
    renderRoutes('/')
    expect(await screen.findByText('21:00 · 50 ml breast milk')).toBeInTheDocument()
    expect(screen.getByText('25 min')).toBeInTheDocument()
    expect(screen.getByText('23:00 · 1.2 ml')).toBeInTheDocument()
    expect(screen.getByText('2 hr 25 min')).toBeInTheDocument()
    // Tube went in on 28 Nov: day 7 of 7, so the change is due tomorrow.
    expect(screen.getByText('NG tube change')).toBeInTheDocument()
  })

  it('lists today newest first with who logged it', async () => {
    renderRoutes('/')
    const rows = await screen.findAllByRole('button', { name: /Tap to edit/ })
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      '19:40 Nappy · wet, Dad. Tap to edit',
      '18:05 Feed 50 ml · bottle 15 ml, tube 35 ml · breast milk, Dad. Tap to edit',
      '11:02 Iron 1.2 ml, Dad. Tap to edit',
    ])
  })

  it('logs a nappy in one tap, with undo', async () => {
    renderRoutes('/')
    await user.click(await screen.findByRole('button', { name: 'Nappy' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Nappy' })).getByRole('button', { name: 'Both' }))
    await waitFor(() => expect(care.addLog).toHaveBeenCalledWith('nappies', 'h1', { wet: true, dirty: true }))
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(care.deleteLog).toHaveBeenCalledWith('nappies', 'new-id'))
  })

  it('edits and deletes an entry', async () => {
    renderRoutes('/')
    await user.click(await screen.findByRole('button', { name: /19:40 Nappy/ }))
    const sheet = screen.getByRole('dialog', { name: 'Edit nappy' })
    await user.click(within(sheet).getByRole('switch', { name: 'Dirty' }))
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(care.updateLog).toHaveBeenCalledWith('nappies', 'n1', expect.objectContaining({ wet: true, dirty: true })))

    await user.click(await screen.findByRole('button', { name: /19:40 Nappy/ }))
    await user.click(screen.getByRole('button', { name: 'Delete entry' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(care.deleteLog).toHaveBeenCalledWith('nappies', 'n1'))
  })

  it('saves a note', async () => {
    renderRoutes('/')
    await user.click(await screen.findByRole('button', { name: 'Note' }))
    await user.type(screen.getByRole('textbox', { name: 'Note' }), 'Lovely cuddles')
    await user.click(screen.getByRole('button', { name: 'Save note' }))
    await waitFor(() => expect(care.addLog).toHaveBeenCalledWith('notes', 'h1', { text: 'Lovely cuddles' }))
  })
})

describe('Medicines', () => {
  it('shows the schedule with given and due doses', async () => {
    renderRoutes('/meds')
    expect(await screen.findByRole('button', { name: '11:00 Iron 1.2 ml: given by Dad' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '23:00 Iron 1.2 ml: Later' })).toBeInTheDocument()
    expect(screen.getByText('DUE IN 2 HR 25 MIN')).toBeInTheDocument()
  })

  it('marks a dose given', async () => {
    renderRoutes('/meds')
    await user.click(await screen.findByRole('button', { name: 'Mark given' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark given' }))
    await waitFor(() => expect(care.giveMedicine).toHaveBeenCalled())
    expect(care.giveMedicine.mock.calls[0][0]).toMatchObject({ medicineId: 'iron', scheduledFor: '2026-12-04T23:00:00.000Z', dose: 1.2, allowRepeat: false })
  })

  it('asks before logging a dose someone else already gave', async () => {
    care.giveMedicine.mockRejectedValueOnce(new careApi.AlreadyGiven('Mum', '2026-12-04T20:30:00Z'))
    renderRoutes('/meds')
    await user.click(await screen.findByRole('button', { name: 'Mark given' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark given' }))
    expect(await screen.findByText('Already given by Mum at 20:30')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Log another dose' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark given' }))
    await waitFor(() => expect(care.giveMedicine).toHaveBeenCalledTimes(2))
    expect(care.giveMedicine.mock.calls[1][0].allowRepeat).toBe(true)
  })
})

describe('Feeds', () => {
  it('pre-fills from the nearest planned feed and saves', async () => {
    renderRoutes('/feeds')
    expect(await screen.findByText('Total 50 ml of 50 ml planned')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Planned feed' })).toHaveDisplayValue('21:00 · 50 ml breast milk')

    await user.click(screen.getByRole('radio', { name: 'Bottle + tube' }))
    const oral = screen.getByRole('group', { name: 'By mouth' })
    await user.click(within(oral).getByRole('button', { name: /5 ml more/ }))
    await user.click(within(oral).getByRole('button', { name: /5 ml more/ }))
    expect(screen.getByText('Total 50 ml of 50 ml planned · 20% by mouth')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save feed' }))
    await waitFor(() => expect(care.addLog).toHaveBeenCalled())
    expect(care.addLog.mock.calls[0]).toEqual([
      'feeds',
      'h1',
      expect.objectContaining({ feed_plan_slot_id: 's7', method: 'bottle_tube', oral_ml: 10, tube_ml: 40, milk_type: 'breast' }),
    ])
  })

  it('shows the NG tube card', async () => {
    renderRoutes('/feeds')
    expect(await screen.findByText('NG tube · left nostril')).toBeInTheDocument()
    expect(screen.getByText('Day 7 of 7')).toBeInTheDocument()
  })
})
