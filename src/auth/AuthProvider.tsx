import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthApi } from './AuthContext'
import { friendly } from './friendly'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const api = useMemo<AuthApi>(
    () => ({
      configured: supabase !== null,
      loading,
      session,
      async sendCode(email, opts) {
        if (!supabase) return 'Not connected'
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            // Only people with an invite can create an account; joining is checked in the database.
            shouldCreateUser: opts?.newAccount ?? false,
            emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
          },
        })
        return error ? friendly(error.message, 'send') : null
      },
      async verifyCode(email, code) {
        if (!supabase) return 'Not connected'
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
        return error ? friendly(error.message, 'verify') : null
      },
      async signOut() {
        await supabase?.auth.signOut()
      },
    }),
    [loading, session],
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}
