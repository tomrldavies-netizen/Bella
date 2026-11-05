import { Link, useLocation } from 'react-router-dom'
import { NAV_ITEMS, activeNavPath } from '../navigation'
import { useOverdue } from '../care/useOverdue'

/** Phone navigation (< 768 px): five tabs fixed to the bottom, clear of the iPhone home bar. */
export function BottomTabs({ className = '' }: { className?: string }) {
  const { pathname } = useLocation()
  const active = activeNavPath(pathname, 'tabs')
  const { lateByTab } = useOverdue()
  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-line bg-card pb-[env(safe-area-inset-bottom)] ${className}`}
    >
      <ul className="flex h-[76px] items-center justify-around px-1.5">
        {NAV_ITEMS.filter((i) => i.inTabs).map(({ path, label, Icon }) => {
          const current = path === active
          return (
            <li key={path}>
              <Link
                to={path}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-[52px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] no-underline ${
                  current
                    ? 'bg-primary-tint font-extrabold text-primary hover:text-primary'
                    : 'font-bold text-ink-soft hover:text-ink'
                }`}
              >
                <span className="relative">
                  <Icon size={22} />
                  {lateByTab[path] ? <span aria-hidden="true" className="absolute -top-0.5 -right-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-alert" /> : null}
                </span>
                {label}
                {lateByTab[path] ? <span className="sr-only">, {lateByTab[path]} overdue</span> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
