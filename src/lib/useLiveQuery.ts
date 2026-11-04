import { useCallback, useEffect, useRef, useState } from 'react'
import { useRealtime } from './useRealtime'

export type LiveQuery<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void }

/**
 * Loads data for the household and reloads it whenever one of `tables`
 * changes on any device.
 */
export function useLiveQuery<T>(
  householdId: string,
  tables: readonly string[],
  load: (householdId: string) => Promise<T>,
  /** Reload when this changes too (e.g. the date). */
  key = '',
): LiveQuery<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  const reload = useCallback(() => {
    loadRef
      .current(householdId)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key is a deliberate reload trigger
  }, [householdId, key])

  useEffect(() => {
    reload()
  }, [reload])
  useRealtime(householdId, tables, reload)

  return { data, error, loading: data === null && error === null, reload }
}
