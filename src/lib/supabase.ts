import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { offlineAwareFetch } from '../offline/network'

/**
 * Just the project address (https://abcd.supabase.co), even if the secret was
 * pasted with a path such as /rest/v1/ or a trailing slash, or with spaces.
 */
export function projectUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim()
  if (!trimmed) return undefined
  try {
    return new URL(trimmed).origin
  } catch {
    return trimmed
  }
}

const url = projectUrl(import.meta.env.VITE_SUPABASE_URL)
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/**
 * The Supabase client, or null when the URL and anon key aren't set
 * (the app then shows a "not connected yet" screen instead of crashing).
 * Both values are public by design; the data is protected by RLS.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          // PKCE puts ?code= in the query string, which doesn't clash with HashRouter's #/ routes.
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
        // A lost connection reads "You're offline…" rather than "Failed to fetch".
        global: { fetch: offlineAwareFetch },
      })
    : null
