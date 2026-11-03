import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
      })
    : null
