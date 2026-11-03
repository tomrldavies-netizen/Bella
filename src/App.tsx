import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/AuthContext'
import { AppShell } from './components/AppShell'
import { useHousehold } from './household/HouseholdContext'
import { HouseholdProvider } from './household/HouseholdProvider'
import { BellasPlan, Care, Feeds, Growth, Meds, Plan, Summary } from './screens/Sections'
import { Setup } from './screens/Setup'
import { SignIn } from './screens/SignIn'
import { LoadError, NotConnected, Splash } from './screens/StatusScreens'
import { Today } from './screens/Today'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Today />} />
        <Route path="feeds" element={<Feeds />} />
        <Route path="meds" element={<Meds />} />
        <Route path="growth" element={<Growth />} />
        <Route path="care" element={<Care />} />
        <Route path="plan" element={<Plan />} />
        <Route path="summary" element={<Summary />} />
        <Route path="bellas-plan" element={<BellasPlan />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

/** Not connected → signed out → no household yet → the app. */
export function Gate() {
  const auth = useAuth()
  const { state, reload } = useHousehold()
  if (!auth.configured) return <NotConnected />
  if (auth.loading) return <Splash />
  if (!auth.session) return <SignIn />
  switch (state.status) {
    case 'loading':
      return <Splash />
    case 'none':
      return <Setup />
    case 'error':
      return <LoadError message={state.message} onRetry={reload} />
    case 'ready':
      return <AppRoutes />
  }
}

/** HashRouter so deep links work on GitHub Pages (no server-side routing). */
export default function App() {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <HashRouter>
          <Gate />
        </HashRouter>
      </HouseholdProvider>
    </AuthProvider>
  )
}
