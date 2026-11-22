import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as careApi from '../care/api'
import type { SuctionLog } from '../care/types'
import * as planApi from '../plan/api'
import { renderRoutes } from '../test/fakes'

vi.mock('../plan/api', () => ({
  loadFeedPlans: vi.fn(async () => []),
  loadMedicines: vi.fn(async () => []),
  loadExercises: vi.fn(async () => []),
  loadRoutines: vi.fn(),
  loadRecentChanges: vi.fn(async () => []),
}))
vi.mock('../care/api', async (orig) => {
  const real = await orig<typeof import('../care/api')>()
  return {
    AlreadyGiven: real.AlreadyGiven,
    loadDayLogs: vi.fn(),
    loadLatestTube: vi.fn(async () => null),
    loadSuctionsSince: vi.fn(),
    loadLatestObs: vi.fn(async () => null),
    loadGivenBetween: vi.fn(async () => []),
    loadWeights: vi.fn(async () => []),
    addLog: vi.fn(async () => 'new-id'),
    updateLog: vi.fn(async () => {}),
    deleteLog: vi.fn(async () => {}),
    giveMedicine: vi.fn(),
  }
})
vi.mock('../reminders/alarmApi', () => ({ loadMyAlarms: vi.fn(async () => []), alarmAction: vi.fn() }))
vi.mock('../reminders/alarmSound', () => ({ startAlarmSound: vi.fn(), stopAlarmSound: vi.fn(), unlockAlarmSound: vi.fn() }))
const plan = vi.mocked(planApi)
const care = vi.mocked(careApi)

// 10:00 on Sunday 22 Nov (UK = UTC in winter).
const NOW = new Date('2026-11-22T10:00:00Z')
const s = (id: string, logged_at: string, amount: SuctionLog['amount'], site: SuctionLog['site'] = null, note: string | null = null): SuctionLog => ({ id, logged_by: 'm-dad', logged_at, amount, site, note })
const todays = [s('s2', '2026-11-22T09:40:00Z', 'lot', 'nose', 'Thick'), s('s1', '2026-11-22T06:15:00Z', 'little')]
const empty = { feeds: [], nappies: [], given: [], notes: [], tubeChanges: [], obs: [], exercises: [], tummy: [] }

let user: ReturnType<typeof userEvent.setup>
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW })
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  vi.clearAllMocks()
  plan.loadRoutines.mockResolvedValue({ obsIntervalMin: null, tummyGoalMin: 30, tubeChangeDays: null, tempMinC: null, tempMaxC: null, tasks: [] })
  care.loadDayLogs.mockResolvedValue({ ...empty, suctions: todays })
  care.loadSuctionsSince.mockResolvedValue([...todays, s('s0', '2026-11-21T22:05:00Z', 'medium', 'both')])
})
afterEach(() => vi.useRealTimers())

describe('Suction on Today', () => {
  it('logs a suction from Quick log, with where and how much, and can undo it', async () => {
    renderRoutes('/')
    await user.click(await screen.findByRole('button', { name: 'Suction' }))
    const sheet = await screen.findByRole('dialog', { name: 'Suction' })
    await user.click(within(sheet).getByRole('button', { name: 'Nose' }))
    expect(within(sheet).getByRole('button', { name: 'Nose' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(sheet).getByRole('button', { name: 'A lot' }))
    expect(care.addLog).toHaveBeenCalledWith('suctions', 'h1', { amount: 'lot', site: 'nose' })
    expect(await screen.findByText('Suction logged · a lot · nose')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(care.deleteLog).toHaveBeenCalledWith('suctions', 'new-id'))
  })

  it('where is optional', async () => {
    renderRoutes('/')
    await user.click(await screen.findByRole('button', { name: 'Suction' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Suction' })).getByRole('button', { name: 'Medium' }))
    expect(care.addLog).toHaveBeenCalledWith('suctions', 'h1', { amount: 'medium', site: null })
  })

  it('shows in the timeline and can be edited there', async () => {
    renderRoutes('/')
    await user.click(await screen.findByRole('button', { name: /Suction · a lot · nose/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Edit suction' })
    expect(within(sheet).getByRole('textbox', { name: 'Note' })).toHaveValue('Thick')
    await user.click(within(sheet).getByRole('radio', { name: 'Medium' }))
    await user.click(within(sheet).getByRole('button', { name: 'Nose' })) // tap again to clear
    await user.click(within(sheet).getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(care.updateLog).toHaveBeenCalledWith('suctions', 's2', { logged_at: '2026-11-22T09:40:00.000Z', amount: 'medium', site: null, note: 'Thick' }),
    )
  })
})

describe('Suction in the Daily summary', () => {
  it('shows how many and the times', async () => {
    renderRoutes('/summary')
    expect(await screen.findByText('SUCTION')).toBeInTheDocument()
    expect(screen.getByText('2 times')).toBeInTheDocument()
    expect(screen.getByText('1 a little · 1 a lot')).toBeInTheDocument()
    const list = screen.getByRole('region', { name: 'Suction' })
    const rows = within(list).getAllByRole('listitem').map((li) => li.textContent)
    expect(rows[0]).toContain('06:15A little')
    expect(rows[1]).toContain('09:40A lot · noseThick')
  })
})

describe('Suction on Care', () => {
  it('shows today, a 7-day chart and the history by day', async () => {
    renderRoutes('/care')
    expect(await screen.findByRole('heading', { name: 'Suction' })).toBeInTheDocument()
    expect(await screen.findByText('2 today')).toBeInTheDocument()
    expect(screen.getByText('Last 20 min ago · 09:40 by Dad')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Suctions per day, last 7 days: .*Yesterday 1, Today 2$/ })).toBeInTheDocument()
    expect(screen.getByText('3 times in the last 7 days · 1 a little · 1 medium · 1 a lot')).toBeInTheDocument()
    await user.click(screen.getByText('History'))
    const yesterday = screen.getByRole('region', { name: 'Yesterday, 1 time' })
    expect(within(yesterday).getByText('Medium · nose and mouth')).toBeInTheDocument()
    await user.click(within(yesterday).getByRole('button', { name: /22:05/ }))
    expect(await screen.findByRole('dialog', { name: 'Edit suction' })).toBeInTheDocument()
  })

  it('logs from the Care tab too', async () => {
    renderRoutes('/care')
    await user.click(await screen.findByRole('button', { name: 'Log suction' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Suction' })).getByRole('button', { name: 'A little' }))
    expect(care.addLog).toHaveBeenCalledWith('suctions', 'h1', { amount: 'little', site: null })
  })
})
