import { useEffect, useState } from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/AuthContext'
import { useHousehold } from './household/HouseholdContext'
import { HouseholdProvider } from './household/HouseholdProvider'
import { useInviteToken } from './family/inviteToken'
import { appRoutes } from './routes'
import { JoinInvite } from './screens/JoinInvite'
import { Setup } from './screens/Setup'
import { SignIn } from './screens/SignIn'
import { LoadError, NotConnected, Splash } from './screens/StatusScreens'

/** Hash routes (#/feeds) so deep links work on GitHub Pages, which has no server-side routing. */
function AppRouter() {
  const [router] = useState(() => createHashRouter(appRoutes))
  return <RouterProvider router={router} />
}

/** Not connected → signed out → no household yet → the app. */
export function Gate() {
  const auth = useAuth()
  const { state, reload } = useHousehold()
  const [inviteToken, clearInvite] = useInviteToken()
  const ready = state.status === 'ready'
  useEffect(() => {
    // Already in the household: an invite link has nothing more to do.
    if (ready && inviteToken) clearInvite()
  }, [ready, inviteToken, clearInvite])
  if (!auth.configured) return <NotConnected />
  if (auth.loading) return <Splash />
  if (!auth.session) return <SignIn inviteToken={inviteToken} />
  switch (state.status) {
    case 'loading':
      return <Splash />
    case 'none':
      return inviteToken ? <JoinInvite token={inviteToken} onDone={clearInvite} /> : <Setup />
    case 'error':
      return <LoadError message={state.message} onRetry={reload} />
    case 'ready':
      return <AppRouter />
  }
}

export default function App() {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <Gate />
      </HouseholdProvider>
    </AuthProvider>
  )
}
