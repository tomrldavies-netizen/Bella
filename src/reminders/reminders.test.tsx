import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as push from './push'
import { fakeHousehold, helper, helperHousehold, readyState, renderRoutes } from '../test/fakes'

vi.mock('./push', () => ({
  pushConfigured: vi.fn(() => true),
  pushState: vi.fn(async () => 'off'),
  turnOnPush: vi.fn(async () => 'on'),
  turnOffPush: vi.fn(async () => {}),
  sendTest: vi.fn(async () => 'Sent to 1 phone'),
  saveReminderSettings: vi.fn(async () => {}),
  clearNotificationsOnOpen: vi.fn(),
}))
vi.mock('../family/api', async (orig) => ({ ...(await orig<typeof import('../family/api')>()), loadPendingInvites: vi.fn(async () => []) }))
const p = vi.mocked(push)

beforeEach(() => vi.clearAllMocks())

describe('Reminders card', () => {
  it('turns reminders on for this phone after a tap, then offers a test', async () => {
    renderRoutes('/bellas-plan/family')
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on reminders' }))
    await waitFor(() => expect(p.turnOnPush).toHaveBeenCalledWith('h1', 'm-dad'))
    await userEvent.click(await screen.findByRole('button', { name: 'Send a test' }))
    expect(await screen.findByText('Sent to 1 phone')).toBeInTheDocument()
  })

  it('parents start with everything on', async () => {
    renderRoutes('/bellas-plan/family')
    expect(await screen.findByRole('switch', { name: 'Medicines due' })).toHaveAttribute('aria-checked', 'true')
  })

  it('helpers start with plan changes only', async () => {
    renderRoutes('/bellas-plan/family', { household: helperHousehold() })
    expect(await screen.findByRole('switch', { name: 'Medicines due' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('switch', { name: "Bella's plan has changed" })).toHaveAttribute('aria-checked', 'true')
  })

  it('saves types, lead time and quiet hours', async () => {
    renderRoutes('/bellas-plan/family')
    await userEvent.click(await screen.findByRole('switch', { name: 'Feeds due' }))
    await userEvent.click(screen.getByRole('switch', { name: 'Quiet hours' }))
    expect(screen.getByText(/Medicines still come through/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save reminder settings' }))
    await waitFor(() =>
      expect(p.saveReminderSettings).toHaveBeenCalledWith('h1', { types: { feed: false }, quiet: { start: '22:00', end: '07:00' } }),
    )
  })

  it('explains when reminders are not set up yet', async () => {
    p.pushConfigured.mockReturnValue(false)
    renderRoutes('/bellas-plan/family', { household: fakeHousehold({ state: { ...readyState, me: helper } as typeof readyState }) })
    expect(await screen.findByText(/A parent needs to finish setting them up/)).toBeInTheDocument()
  })
})

describe('Reminder keys', () => {
  it('makes a VAPID key pair in the browser', async () => {
    renderRoutes('/bellas-plan/family/reminder-keys')
    await userEvent.click(await screen.findByRole('button', { name: 'Make the keys' }))
    const codes = await screen.findAllByText((_, el) => el?.tagName === 'CODE')
    const [pub, priv, cron] = codes.map((c) => c.textContent ?? '')
    // P-256 public key (65 bytes) and private key (32 bytes), base64url.
    expect(pub).toMatch(/^[A-Za-z0-9_-]{87}$/)
    expect(priv).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(cron.length).toBeGreaterThanOrEqual(32)
  })

  it('is for parents only', async () => {
    renderRoutes('/bellas-plan/family/reminder-keys', { household: helperHousehold() })
    expect(await screen.findByText('Only parents set up reminders.')).toBeInTheDocument()
  })
})
