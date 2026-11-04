import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { BellasPlan } from './screens/plan/BellasPlan'
import { EditExercises } from './screens/plan/EditExercises'
import { EditFeedPlan } from './screens/plan/EditFeedPlan'
import { EditMedicines } from './screens/plan/EditMedicines'
import { EditRoutines } from './screens/plan/EditRoutines'
import { Expressing } from './screens/Expressing'
import { Family } from './screens/Family'
import { Feeds } from './screens/Feeds'
import { Meds } from './screens/Meds'
import { Care } from './screens/Care'
import { Growth } from './screens/Growth'
import { PlanScreen } from './screens/PlanScreen'
import { Summary } from './screens/Summary'
import { Today } from './screens/Today'

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Today /> },
      { path: 'feeds', element: <Feeds /> },
      { path: 'feeds/expressing', element: <Expressing /> },
      { path: 'meds', element: <Meds /> },
      { path: 'growth', element: <Growth /> },
      { path: 'care', element: <Care /> },
      { path: 'plan', element: <PlanScreen /> },
      { path: 'summary', element: <Summary /> },
      { path: 'bellas-plan', element: <BellasPlan /> },
      { path: 'bellas-plan/feeds', element: <EditFeedPlan /> },
      { path: 'bellas-plan/medicines', element: <EditMedicines /> },
      { path: 'bellas-plan/exercises', element: <EditExercises /> },
      { path: 'bellas-plan/routines', element: <EditRoutines /> },
      { path: 'bellas-plan/family', element: <Family /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]
