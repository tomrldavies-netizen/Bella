import { Navigate, type RouteObject } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RouteError } from "./components/RouteError";
import { Today } from "./screens/Today";

// Today loads with the app; every other screen loads the first time it's opened
// (and is then cached on the phone by the service worker for offline use).
const screen = (load: () => Promise<{ Component: React.ComponentType }>) => ({
  lazy: load,
});

export const appRoutes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        // Pathless wrapper: a crashing screen shows RouteError inside the shell, keeping the tabs.
        errorElement: <RouteError />,
        children: [
          { index: true, element: <Today /> },
          {
            path: "feeds",
            ...screen(async () => ({
              Component: (await import("./screens/Feeds")).Feeds,
            })),
          },
          {
            path: "feeds/expressing",
            ...screen(async () => ({
              Component: (await import("./screens/Expressing")).Expressing,
            })),
          },
          {
            path: "meds",
            ...screen(async () => ({
              Component: (await import("./screens/Meds")).Meds,
            })),
          },
          {
            path: "growth",
            ...screen(async () => ({
              Component: (await import("./screens/Growth")).Growth,
            })),
          },
          {
            path: "care",
            ...screen(async () => ({
              Component: (await import("./screens/Care")).Care,
            })),
          },
          {
            path: "plan",
            ...screen(async () => ({
              Component: (await import("./screens/PlanScreen")).PlanScreen,
            })),
          },
          {
            path: "summary",
            ...screen(async () => ({
              Component: (await import("./screens/Summary")).Summary,
            })),
          },
          {
            path: "bellas-plan",
            ...screen(async () => ({
              Component: (await import("./screens/plan/BellasPlan")).BellasPlan,
            })),
          },
          {
            path: "bellas-plan/feeds",
            ...screen(async () => ({
              Component: (await import("./screens/plan/EditFeedPlan"))
                .EditFeedPlan,
            })),
          },
          {
            path: "bellas-plan/medicines",
            ...screen(async () => ({
              Component: (await import("./screens/plan/EditMedicines"))
                .EditMedicines,
            })),
          },
          {
            path: "bellas-plan/exercises",
            ...screen(async () => ({
              Component: (await import("./screens/plan/EditExercises"))
                .EditExercises,
            })),
          },
          {
            path: "bellas-plan/routines",
            ...screen(async () => ({
              Component: (await import("./screens/plan/EditRoutines"))
                .EditRoutines,
            })),
          },
          {
            path: "bellas-plan/family",
            ...screen(async () => ({
              Component: (await import("./screens/Family")).Family,
            })),
          },
          {
            path: "bellas-plan/family/reminder-keys",
            ...screen(async () => ({
              Component: (await import("./screens/ReminderKeys")).ReminderKeys,
            })),
          },
          { path: "*", element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];
