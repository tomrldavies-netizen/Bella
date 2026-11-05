import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as careApi from '../care/api'
import * as planApi from '../plan/api'
import * as alarmApi from '../reminders/alarmApi'
import * as push from '../reminders/push'
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
    loadLatestTube: vi.fn(async () => null),
    loadLatestObs: vi.fn(async () => null),
    loadGivenBetween: vi.fn(async () => []),
    loadWeights: vi.fn(async () => []),
    addLog: vi.fn(async () => 'id'),
    updateLog: vi.fn(),
    deleteLog: vi.fn(),
    giveMedicine: vi.fn(),
  }
})
vi.mock('../reminders/alarmApi', () => ({ loadMyAlarms: vi.fn(async () => []), alarmAction: vi.fn(async () => {}) }))
vi.mock('../reminders/alarmSound', () => ({ startAlarmSound: vi.fn(), stopAlarmSound: vi.fn(), unlockAlarmSound: vi.fn() }))
vi.mock('../reminders/push', () => ({
  pushConfigured: vi.fn(() => true),
  pushState: vi.fn(async () => 'on'),
  turnOnPush: vi.fn(),
  turnOffPush: vi.fn(),
  sendTest: vi.fn(),
  saveReminderSettings: vi.fn(async () => {}),
  clearNotificationsOnOpen: vi.fn(),
}))
vi.mock('../family/api', async (orig) => ({ ...(await orig<typeof import('../family/api')>()), loadPendingInvites: vi.fn(async () => []) }))
const plan = vi.mocked(planApi)
const care = vi.mocked(careApi)
const alarms = vi.mocked(alarmApi)
const p = vi.mocked(push)

// 12:40 on Friday 4 Dec (UK = UTC in winter).
const NOW = new Date('2026-12-04T12:40:00Z')
let user: ReturnType<typeof userEvent.setup>
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW })
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  vi.clearAllMocks()
  plan.loadFeedPlans.mockResolvedValue([{ id: 'p', effective_from: '2026-11-01T00:00:00Z', note: null, created_by: 'm-dad', slots: [{ id: 's1', time: '12:00', milk: 'formula', ml: 55 }, { id: 's2', time: '15:00', milk: 'formula', ml: 55 }] }])
  plan.loadMedicines.mockResolvedValue([{ id: 'iron', name: 'Iron', notes: null, active: true, sort_order: 1, versions: [{ id: 'v', dose: 1.2, unit: 'ml', route: 'either', times: ['12:30', '18:00'], effective_from: '2026-11-01T00:00:00Z', effective_to: null, reason: null }] }])
  plan.loadRoutines.mockResolvedValue({ obsIntervalMin: null, tummyGoalMin: 30, tubeChangeDays: null, tempMinC: null, tempMaxC: null, tasks: [] })
  care.loadDayLogs.mockResolvedValue({ feeds: [], nappies: [], given: [], notes: [], tubeChanges: [], obs: [], exercises: [], tummy: [] })
  alarms.loadMyAlarms.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('Overdue on Today', () => {
  it('shows what is late at the top, with how long ago and a button to log it', async () => {
    renderRoutes('/')
    const panel = await screen.findByRole('region', { name: 'Overdue (2)' })
    const rows = within(panel).getAllByRole('listitem').map((li) => li.textContent)
    expect(rows[0]).toContain('Feed 40 min late')
    expect(rows[0]).toContain('due 12:00 · 55 ml formula')
    expect(rows[1]).toContain('Iron')
    expect(rows[1]).toContain('10 min late')
    expect(within(panel).getByRole('link', { name: 'Log feed' })).toHaveAttribute('href', '/feeds')
    expect(within(panel).getByRole('link', { name: 'Mark given' })).toHaveAttribute('href', '/meds')
  })

  it('is amber "Due now" when nothing is 15 minutes late yet', async () => {
    plan.loadFeedPlans.mockResolvedValue([])
    renderRoutes('/')
    const panel = await screen.findByRole('region', { name: 'Due now (1)' })
    expect(within(panel).getByText('10 min late')).toBeInTheDocument()
  })

  it('Up next only shows what is coming', async () => {
    renderRoutes('/')
    await screen.findByRole('region', { name: 'Overdue (2)' })
    expect(screen.getByText('15:00 · 55 ml formula')).toBeInTheDocument()
    expect(screen.getByText('18:00 · 1.2 ml')).toBeInTheDocument()
  })

  it('puts a red dot on the Feeds tab', async () => {
    renderRoutes('/')
    await screen.findByRole('region', { name: 'Overdue (2)' })
    const tabs = screen.getAllByRole('navigation', { name: 'Main' })[1]
    expect(within(tabs).getByRole('link', { name: /Feeds, 1 overdue/ })).toBeInTheDocument()
  })
})

describe('Alarm screen', () => {
  it('rings full screen for an alarm and stops or snoozes it', async () => {
    alarms.loadMyAlarms.mockResolvedValue([{ token: 'tok', type: 'medicine', title: 'Iron due at 12:30', body: '1.2 ml · by mouth or via tube', url: '#/meds', due_at: '2026-12-04T12:30:00Z', ref_id: 'iron', snoozed: false }])
    renderRoutes('/')
    const alarm = await screen.findByRole('alertdialog', { name: 'Iron due at 12:30' })
    expect(within(alarm).getByText('10 min late')).toBeInTheDocument()
    await user.click(within(alarm).getByRole('button', { name: 'Snooze 5 min' }))
    await waitFor(() => expect(alarms.alarmAction).toHaveBeenCalledWith('tok', 'snooze'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('stays quiet once the dose is marked given on this phone', async () => {
    alarms.loadMyAlarms.mockResolvedValue([{ token: 'tok', type: 'medicine', title: 'Iron due at 12:30', body: '', url: '#/meds', due_at: '2026-12-04T12:30:00.000Z', ref_id: 'iron', snoozed: false }])
    care.loadGivenBetween.mockResolvedValue([{ id: 'g', logged_by: 'm-dad', logged_at: '', medicine_id: 'iron', scheduled_for: '2026-12-04T12:30:00.000Z', given_at: '2026-12-04T12:31:00Z', dose_given: 1.2 }])
    renderRoutes('/')
    await screen.findByRole('heading', { name: 'Up next' })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('Alarm and work hours settings', () => {
  it('saves alarm mode and work hours', async () => {
    renderRoutes('/bellas-plan/family')
    await user.click(await screen.findAllByRole('switch', { name: /Alarm: repeat every 2 min/ }).then((s) => s[1]))
    await user.click(screen.getByRole('switch', { name: 'Work hours' }))
    await user.click(screen.getByRole('button', { name: 'Fri' }))
    expect(screen.getByText(/alarms become ordinary notifications/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save reminder settings' }))
    await waitFor(() =>
      expect(p.saveReminderSettings).toHaveBeenCalledWith('h1', { alarm: { medicine: true }, work: { days: [1, 2, 3, 4], start: '09:00', end: '17:30' } }),
    )
  })
})
