import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
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
  return (
    <div className="min-h-dvh md:flex">
      <ScrollToTop />
      <SideRail className="hidden md:flex" />
      <main className="min-w-0 flex-1 pb-[calc(92px+env(safe-area-inset-bottom))] md:pb-8">
        <Outlet />
      </main>
      <BottomTabs className="md:hidden" />
    </div>
  )
}
