import { Link, useLocation } from 'react-router-dom'
import { Elephant } from '../animals'
import { NAV_ITEMS, activeNavPath } from '../navigation'

/**
 * Tablet navigation (≥ 768 px). Compact (icon over label) on portrait
 * tablets, full width with Bella's name from 1024 px, as in Tablet.dc.html.
 */
export function SideRail({ className = '' }: { className?: string }) {
  const { pathname } = useLocation()
  const active = activeNavPath(pathname, 'rail')
  return (
    <nav
      aria-label="Main"
      className={`sticky top-0 h-dvh w-24 shrink-0 flex-col gap-1.5 overflow-y-auto bg-rail px-2 pt-[max(24px,env(safe-area-inset-top))] pb-6 lg:w-[228px] lg:px-4 ${className}`}
    >
      <Link
        to="/"
        className="flex items-center justify-center gap-2.5 px-1.5 pb-[18px] text-ink no-underline hover:text-ink lg:justify-start"
      >
        <Elephant size={48} bg="#DCEBF2" />
        <span className="hidden font-display text-[28px] leading-none font-extrabold lg:inline">Bella</span>
      </Link>
      <ul className="flex flex-col gap-1.5">
        {NAV_ITEMS.map(({ path, railLabel, Icon }) => {
          const current = path === active
          return (
            <li key={path}>
              <Link
                to={path}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[14px] px-1 py-2 text-center text-[11px] leading-tight no-underline lg:flex-row lg:justify-start lg:gap-3 lg:px-3.5 lg:py-0 lg:text-left lg:text-[15px] ${
                  current
                    ? 'bg-card font-extrabold text-primary-dark hover:text-primary-dark'
                    : 'font-bold text-ink-deep hover:bg-card/50 hover:text-ink'
                }`}
              >
                <Icon size={22} className="shrink-0" />
                {railLabel}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
