import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthApi } from './AuthContext'

function friendly(message: string): string {
  if (/signups? not allowed|not allowed for otp|user not found/i.test(message)) {
    return "That email isn't on Bella's list yet. Ask a parent to add you."
  }
  if (/expired|invalid/i.test(message)) return "That code didn't work. Check it, or send a new one."
  if (/rate limit|too many|security purposes/i.test(message)) {
    return 'Too many tries. Please wait a minute and try again.'
  }
  return message
}

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
      async sendCode(email) {
        if (!supabase) return 'Not connected'
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            // Only people a parent has added can sign in.
            shouldCreateUser: false,
            emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
          },
        })
        return error ? friendly(error.message) : null
      },
      async verifyCode(email, code) {
        if (!supabase) return 'Not connected'
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
        return error ? friendly(error.message) : null
      },
      async signOut() {
        await supabase?.auth.signOut()
      },
    }),
    [loading, session],
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}
