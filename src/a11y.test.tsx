import axe from 'axe-core'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Gate } from './App'
import { fakeAuth, fakeHousehold, helperHousehold, renderBare, renderRoutes } from './test/fakes'

/**
 * Structural accessibility checks (names, roles, labels, headings) on every
 * deploy. Colour contrast and tap-target size need a real browser and were
 * checked separately with axe in Chromium (no issues).
 */
async function violations() {
  const r = await axe.run(document.body, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  })
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
}

describe('accessibility', () => {
  it.each([
    ['/', 'Bella'],
    ['/feeds', 'Feeds'],
    ['/meds', 'Medicines'],
    ['/care', 'Care'],
    ['/growth', 'Growth'],
    ['/plan', 'Plan'],
    ['/summary', 'Daily summary'],
    ['/bellas-plan', "Bella's plan"],
    ['/bellas-plan/feeds', 'Feed plan'],
    ['/bellas-plan/medicines', 'Medicines'],
    ['/bellas-plan/routines', 'Obs & routines'],
    ['/bellas-plan/family', 'Family & sharing'],
  ])('%s has no structural problems', async (path, title) => {
    renderRoutes(path)
    await screen.findByRole('heading', { level: 1, name: title })
    expect(await violations()).toEqual([])
  })

  it('the read-only plan for helpers has no structural problems', async () => {
    renderRoutes('/bellas-plan/feeds', { household: helperHousehold() })
    await screen.findByRole('heading', { level: 1, name: 'Feed plan' })
    expect(await violations()).toEqual([])
  })

  it('sign-in and setup have no structural problems', async () => {
    const { unmount } = renderBare(<Gate />, { auth: fakeAuth({ session: null }) })
    await screen.findByRole('heading', { name: 'Sign in' })
    expect(await violations()).toEqual([])
    unmount()
    renderBare(<Gate />, { household: fakeHousehold({ state: { status: 'none' } }) })
    await screen.findByRole('heading', { name: 'About Bella' })
    expect(await violations()).toEqual([])
  })
})
