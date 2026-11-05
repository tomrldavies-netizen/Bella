import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Gate } from './App'
import { fakeAuth, fakeHousehold, renderBare, renderRoutes } from './test/fakes'

function renderAt(path: string) {
  return renderRoutes(path)
}

describe('app shell', () => {
  it('shows Today with its sections', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Bella' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Up next' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quick log' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: "Bella's plan" }).length).toBeGreaterThan(0)
  })

  it('renders both the phone tabs and the tablet rail (CSS picks one)', () => {
    renderAt('/')
    const navs = screen.getAllByRole('navigation', { name: 'Main' })
    expect(navs).toHaveLength(2)
  })

  it('navigates between tabs and marks the current one', async () => {
    renderAt('/')
    const [rail] = screen.getAllByRole('navigation', { name: 'Main' })
    await userEvent.click(within(rail).getByRole('link', { name: 'Feeds' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Feeds' })).toBeInTheDocument()
    expect(within(rail).getByRole('link', { name: 'Feeds' })).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    ['/meds', 'Medicines'],
    ['/growth', 'Growth'],
    ['/care', 'Care'],
    ['/plan', 'Plan'],
    ['/summary', 'Daily summary'],
    ['/bellas-plan', "Bella's plan"],
  ])('opens %s', async (path, title) => {
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('sends unknown routes to Today', () => {
    renderAt('/nowhere')
    expect(screen.getByRole('heading', { level: 1, name: 'Bella' })).toBeInTheDocument()
  })

  it('never shows mockup sample data', () => {
    renderAt('/')
    expect(screen.queryByText(/50 ml/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Iron/)).not.toBeInTheDocument()
  })
})

describe('gate', () => {
  it('explains when Supabase is not configured', () => {
    renderBare(<Gate />, { auth: fakeAuth({ configured: false }) })
    expect(screen.getByRole('heading', { name: 'Not connected yet' })).toBeInTheDocument()
  })

  it('asks a signed-out visitor to sign in', () => {
    renderBare(<Gate />, { auth: fakeAuth({ session: null }) })
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows setup when signed in without a household', () => {
    renderBare(<Gate />, { household: fakeHousehold({ state: { status: 'none' } }) })
    expect(screen.getByRole('heading', { name: 'About Bella' })).toBeInTheDocument()
  })

  it('shows a retry when loading fails', async () => {
    const household = fakeHousehold({ state: { status: 'error', message: 'Network down' } })
    renderBare(<Gate />, { household })
    expect(screen.getByText('Network down')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(household.reload).toHaveBeenCalled()
  })

  it('opens the app once the household is ready', () => {
    renderBare(<Gate />)
    expect(screen.getByRole('heading', { level: 1, name: 'Bella' })).toBeInTheDocument()
  })
})

describe('household details', () => {
  it('shows real age pills on Today', () => {
    renderAt('/')
    expect(screen.getAllByText(/ old$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/corrected$/).length).toBeGreaterThan(0)
  })

  it('shows members and sync status in the tablet rail', () => {
    renderAt('/')
    expect(screen.getAllByText('Dad').length).toBeGreaterThan(0)
    expect(screen.getByRole('status')).toHaveTextContent('synced')
  })

  it('signs out from Bella\'s plan', async () => {
    const auth = fakeAuth()
    renderRoutes('/bellas-plan', { auth })
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(auth.signOut).toHaveBeenCalled()
  })
})

describe('getting to Plan on a phone', () => {
  it('Today always links to Plan & appointments', async () => {
    renderAt('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Plan & appointments' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Plan' })).toBeInTheDocument()
  })
})
