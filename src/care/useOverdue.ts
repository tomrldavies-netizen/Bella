import { useEffect } from 'react'
import { OVERDUE_TAB, overdueItems } from './overdue'
import { useToday } from './useToday'

/** Overdue items and how many belong to each tab (for the red dots). */
export function useOverdue() {
  const t = useToday()
  const items = t.ready ? overdueItems(t) : []
  const lateByTab: Record<string, number> = {}
  for (const i of items) if (i.severity === 'late') lateByTab[OVERDUE_TAB[i.kind]] = (lateByTab[OVERDUE_TAB[i.kind]] ?? 0) + 1
  return { items, lateByTab, lateCount: items.filter((i) => i.severity === 'late').length }
}

/** The number on the home-screen icon (Android, and iPhone when installed). */
export function useOverdueBadge() {
  const { lateCount } = useOverdue()
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    try {
      if (lateCount > 0) void nav.setAppBadge?.(lateCount)?.catch(() => {})
      else void nav.clearAppBadge?.()?.catch(() => {})
    } catch {
      // Not supported on this phone.
    }
  }, [lateCount])
}
