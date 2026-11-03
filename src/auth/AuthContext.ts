import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthApi = {
  /** False when the Supabase URL/key aren't configured. */
  configured: boolean
  loading: boolean
  session: Session | null
  /** Emails a sign-in code (and link). Resolves to an error message, or null. */
  sendCode: (email: string) => Promise<string | null>
  /** Checks the emailed code. Resolves to an error message, or null. */
  verifyCode: (email: string, code: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthApi | null>(null)

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
