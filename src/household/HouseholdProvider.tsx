import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Baby, Household, Member, NewHousehold } from '../data/types'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../lib/useRealtime'
import { readCache, writeCache } from '../offline/cache'
import { isNetworkError } from '../offline/network'
import { HouseholdContext, type HouseholdApi, type HouseholdState } from './HouseholdContext'

const LIVE_TABLES = ['households', 'members', 'babies'] as const

async function loadHousehold(userId: string): Promise<HouseholdState> {
  if (!supabase) return { status: 'error', message: 'Not connected' }
  const { data: me, error } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle<Member>()
  if (error) return { status: 'error', message: error.message }
  if (!me) return { status: 'none' }

  const [household, members, baby] = await Promise.all([
    supabase.from('households').select('id, name').eq('id', me.household_id).single<Household>(),
    supabase
      .from('members')
      .select('*')
      .eq('household_id', me.household_id)
      .eq('active', true)
      .order('created_at')
      .returns<Member[]>(),
    supabase.from('babies').select('*').eq('household_id', me.household_id).maybeSingle<Baby>(),
  ])
  const failed = household.error ?? members.error ?? baby.error
  if (failed) return { status: 'error', message: failed.message }
  if (!household.data || !baby.data) return { status: 'error', message: "Bella's details are missing." }
  return { status: 'ready', household: household.data, me, members: members.data ?? [], baby: baby.data }
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  // Results are tagged with the user they belong to, so a different sign-in shows "loading", not stale data.
  const [loaded, setLoaded] = useState<{ userId: string; state: HouseholdState } | null>(null)
  const state = useMemo<HouseholdState>(
    () => (loaded && loaded.userId === userId ? loaded.state : { status: 'loading' }),
    [loaded, userId],
  )

  const reload = useCallback(() => {
    if (!userId) return
    loadHousehold(userId)
      .then((s) => {
        // A lost connection: open with the copy kept on this phone, if there is one.
        if (s.status === 'error' && isNetworkError(s.message)) {
          const cached = readCache<HouseholdState>(`household.${userId}`)
          if (cached) return setLoaded((prev) => (prev?.userId === userId && prev.state.status === 'ready' ? prev : { userId, state: cached }))
        }
        if (s.status === 'ready') writeCache(`household.${userId}`, s)
        setLoaded({ userId, state: s })
      })
      .catch((e: unknown) => setLoaded({ userId, state: { status: 'error', message: e instanceof Error ? e.message : String(e) } }))
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  // Refresh when the app comes back to the foreground (phones pause background tabs).
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', reload)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', reload)
    }
  }, [reload])

  const householdId = state.status === 'ready' ? state.household.id : null
  const sync = useRealtime(householdId, LIVE_TABLES, reload)

  const createHousehold = useCallback(
    async (input: NewHousehold) => {
      if (!supabase) return 'Not connected'
      const { error } = await supabase.rpc('create_household', {
        p_display_name: input.displayName,
        p_colour: input.colour,
        p_baby_name: input.babyName,
        p_birth_date: input.birthDate,
        p_gestation_weeks: input.gestationWeeks,
        p_gestation_days: input.gestationDays,
        p_due_date: input.dueDate,
      })
      if (error) return error.message
      reload()
      return null
    },
    [reload],
  )

  const api = useMemo<HouseholdApi>(
    () => ({ state, sync, createHousehold, reload }),
    [state, sync, createHousehold, reload],
  )
  return <HouseholdContext.Provider value={api}>{children}</HouseholdContext.Provider>
}
