import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

/** Each hook gets its own channel: Supabase reuses a channel with the same name, even one already subscribed. */
let channelSeq = 0

export type SyncStatus = 'connecting' | 'live' | 'offline'

/**
 * Calls `onChange` whenever a row in any of `tables` changes for this household,
 * on any device. Returns the connection status for the "synced" indicator.
 * Realtime respects RLS, so only rows this member may read come through.
 */
export function useRealtime(
  householdId: string | null,
  tables: readonly string[],
  onChange: (table: string) => void,
): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>('connecting')
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })
  const key = tables.join(',')

  useEffect(() => {
    if (!supabase || !householdId) return
    const client = supabase
    const channel = client.channel(`household:${householdId}:${key}:${++channelSeq}`)
    for (const table of key.split(',')) {
      const filter = table === 'households' ? `id=eq.${householdId}` : `household_id=eq.${householdId}`
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, () =>
        onChangeRef.current(table),
      )
    }
    channel.subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        setStatus('live')
        // Catch up on anything missed while disconnected.
        onChangeRef.current('*')
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        setStatus('offline')
      }
    })
    const offline = () => setStatus('offline')
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('offline', offline)
      client.removeChannel(channel)
    }
  }, [householdId, key])

  return status
}
