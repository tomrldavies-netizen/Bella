import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { InstallHelp } from '../family/InstallHelp'
import { BottomTabs } from './BottomTabs'
import { SideRail } from './SideRail'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/** Bottom tabs on phones, side rail on tablets (SPEC §6). */
export function AppShell() {
  // Plan edit screens have their own bottom bar (Tell everyone + Save) instead of the tabs.
  const { pathname } = useLocation()
  const editing = pathname.startsWith('/bellas-plan/') && !pathname.startsWith('/bellas-plan/family')
  return (
    <div className="min-h-dvh md:flex">
      <ScrollToTop />
      <SideRail className="hidden md:flex" />
      <main className={`min-w-0 flex-1 md:pb-8 ${editing ? '' : 'pb-[calc(92px+env(safe-area-inset-bottom))]'}`}>
        <Outlet />
      </main>
      {!editing && <BottomTabs className="md:hidden" />}
      <InstallHelp />
    </div>
  )
}
