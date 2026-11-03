import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { BellasPlan, Care, Feeds, Growth, Meds, Plan, Summary } from './screens/Sections'
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

/** HashRouter so deep links work on GitHub Pages (no server-side routing). */
export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
