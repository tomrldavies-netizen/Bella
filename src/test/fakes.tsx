import type { Session } from '@supabase/supabase-js'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthContext, type AuthApi } from '../auth/AuthContext'
import type { Baby, Member } from '../data/types'
import { HouseholdContext, type HouseholdApi, type HouseholdState } from '../household/HouseholdContext'

export const dad: Member = {
  id: 'm-dad',
  household_id: 'h1',
  user_id: 'u-dad',
  display_name: 'Dad',
  colour: '#DCEBF2',
  role: 'parent',
  active: true,
}

export const baby: Baby = {
  id: 'b1',
  household_id: 'h1',
  name: 'Bella',
  birth_date: '2026-09-10',
  gestation_weeks: 31,
  gestation_days: 2,
  due_date: '2026-11-10',
}

export const readyState: HouseholdState = {
  status: 'ready',
  household: { id: 'h1', name: 'Our family' },
  me: dad,
  members: [dad],
  baby,
}

export function fakeAuth(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    configured: true,
    loading: false,
    session: { user: { id: 'u-dad', email: 'dad@example.com' } } as Session,
    sendCode: vi.fn(async () => null),
    verifyCode: vi.fn(async () => null),
    signOut: vi.fn(async () => {}),
    ...overrides,
  }
}

export function fakeHousehold(overrides: Partial<HouseholdApi> = {}): HouseholdApi {
  return {
    state: readyState,
    sync: 'live',
    createHousehold: vi.fn(async () => null),
    reload: vi.fn(),
    ...overrides,
  }
}

export function renderWith(
  ui: ReactNode,
  { path = '/', auth = fakeAuth(), household = fakeHousehold() }: { path?: string; auth?: AuthApi; household?: HouseholdApi } = {},
) {
  return render(
    <AuthContext.Provider value={auth}>
      <HouseholdContext.Provider value={household}>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </HouseholdContext.Provider>
    </AuthContext.Provider>,
  )
}
