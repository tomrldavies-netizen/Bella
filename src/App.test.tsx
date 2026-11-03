import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
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
    expect(screen.getByRole('heading', { level: 1, name: 'Feeds' })).toBeInTheDocument()
    expect(within(rail).getByRole('link', { name: 'Feeds' })).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    ['/meds', 'Medicines'],
    ['/growth', 'Growth'],
    ['/care', 'Care'],
    ['/plan', 'Plan'],
    ['/summary', 'Daily summary'],
    ['/bellas-plan', "Bella's plan"],
  ])('opens %s', (path, title) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
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
