import type { ComponentType } from 'react'
import {
  BarsIcon,
  BottleIcon,
  CalendarIcon,
  ChartIcon,
  HeartIcon,
  HomeIcon,
  PillIcon,
} from './components/Icons'

export type NavItem = {
  path: string
  /** Label in the phone tab bar. */
  label: string
  /** Label in the tablet rail (may be longer). */
  railLabel: string
  Icon: ComponentType<{ size?: number; className?: string }>
  /** Shown in the phone bottom tab bar. All items show in the tablet rail. */
  inTabs: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Today', railLabel: 'Today', Icon: HomeIcon, inTabs: true },
  { path: '/feeds', label: 'Feeds', railLabel: 'Feeds', Icon: BottleIcon, inTabs: true },
  { path: '/meds', label: 'Meds', railLabel: 'Medicines', Icon: PillIcon, inTabs: true },
  { path: '/growth', label: 'Growth', railLabel: 'Growth', Icon: ChartIcon, inTabs: true },
  { path: '/care', label: 'Care', railLabel: 'Care', Icon: HeartIcon, inTabs: true },
  { path: '/plan', label: 'Plan', railLabel: 'Plan', Icon: CalendarIcon, inTabs: false },
  { path: '/summary', label: 'Summary', railLabel: 'Daily summary', Icon: BarsIcon, inTabs: false },
]

/**
 * Which nav item is highlighted for a route. Screens opened from Today
 * (Bella's plan, and on phones Plan and Summary) keep Today highlighted.
 */
export function activeNavPath(pathname: string, layout: 'tabs' | 'rail'): string {
  const match = NAV_ITEMS.find((i) => i.path !== '/' && (pathname === i.path || pathname.startsWith(i.path + '/')))
  if (!match) return '/'
  if (layout === 'tabs' && !match.inTabs) return '/'
  return match.path
}
