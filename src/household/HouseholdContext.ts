import { createContext, useContext } from 'react'
import type { Baby, Household, Member, NewHousehold } from '../data/types'
import type { SyncStatus } from '../lib/useRealtime'

export type HouseholdData = {
  household: Household
  me: Member
  members: Member[]
  baby: Baby
}

export type HouseholdState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'error'; message: string }
  | ({ status: 'ready' } & HouseholdData)

export type HouseholdApi = {
  state: HouseholdState
  sync: SyncStatus
  /** Starts a household with the signed-in user as its first parent. Resolves to an error message, or null. */
  createHousehold: (input: NewHousehold) => Promise<string | null>
  reload: () => void
}

export const HouseholdContext = createContext<HouseholdApi | null>(null)

export function useHousehold(): HouseholdApi {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used inside <HouseholdProvider>')
  return ctx
}

/** For screens that only render once the household is loaded. */
export function useReadyHousehold(): HouseholdData & { sync: SyncStatus } {
  const { state, sync } = useHousehold()
  if (state.status !== 'ready') throw new Error('Household not loaded')
  return { ...state, sync }
}
