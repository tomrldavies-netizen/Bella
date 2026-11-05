import { useCallback, useEffect, useRef, useState } from 'react'
import { isNetworkError } from '../offline/network'
import { readCache, writeCache } from '../offline/cache'
import { useRealtime } from './useRealtime'

export type LiveQuery<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void }

/**
 * Loads data for the household and reloads it whenever one of `tables`
 * changes on any device. With `cacheName`, the last result is kept on the
 * phone and shown when there's no signal. A lost connection keeps whatever
 * is already showing rather than replacing it with an error.
 */
export function useLiveQuery<T>(
  householdId: string,
  tables: readonly string[],
  load: (householdId: string) => Promise<T>,
  /** Reload when this changes too (e.g. the date). */
  key = '',
  cacheName?: string,
): LiveQuery<T> {
  const cacheKey = cacheName ? `${householdId}.${cacheName}.${key}` : null
  const [data, setData] = useState<T | null>(() => (cacheKey ? readCache<T>(cacheKey) : null))
  const [error, setError] = useState<string | null>(null)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  const hasData = useRef(data !== null)
  hasData.current = data !== null

  const reload = useCallback(() => {
    loadRef
      .current(householdId)
      .then((d) => {
        setData(d)
        setError(null)
        if (cacheKey) writeCache(cacheKey, d)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        // Offline with something already on screen: keep it, quietly.
        if (isNetworkError(e) && hasData.current) return
        setError(isNetworkError(e) ? "You're offline and this hasn't been loaded on this phone yet." : msg)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key is a deliberate reload trigger
  }, [householdId, key, cacheKey])

  useEffect(() => {
    if (cacheKey) {
      const cached = readCache<T>(cacheKey)
      if (cached !== null) setData(cached)
    }
    reload()
  }, [reload, cacheKey])
  useRealtime(householdId, tables, reload)

  return { data, error, loading: data === null && error === null, reload }
}
