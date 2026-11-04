import { useReadyHousehold } from '../household/HouseholdContext'
import { useLiveQuery } from '../lib/useLiveQuery'
import { useNow } from '../lib/useNow'
import { addDaysIso, ukNow, ukToIso } from '../lib/ukTime'
import { loadFeedPlans, loadMedicines, loadRoutines } from '../plan/api'
import { loadDayLogs, loadGivenBetween, loadLatestTube } from './api'

const LOG_TABLES = ['feeds', 'nappies', 'medicine_given', 'notes', 'tube_changes'] as const

/**
 * Everything the care screens need for today (UK midnight to midnight),
 * kept live across devices. Rolls over at midnight.
 */
export function useToday() {
  const { household, members, me } = useReadyHousehold()
  const now = useNow(30_000)
  const today = ukNow(now).date
  const from = ukToIso(today, '00:00')
  const to = ukToIso(addDaysIso(today, 1), '00:00')
  const hid = household.id

  const logs = useLiveQuery(hid, LOG_TABLES, (h) => loadDayLogs(h, from, to), today)
  const plans = useLiveQuery(hid, ['feed_plans', 'feed_plan_slots'], loadFeedPlans)
  const medicines = useLiveQuery(hid, ['medicines', 'medicine_doses'], loadMedicines)
  const routines = useLiveQuery(hid, ['settings', 'care_tasks'], loadRoutines)
  // Doses matched on their scheduled time (today and tomorrow), whenever they were logged.
  const scheduledGiven = useLiveQuery(hid, ['medicine_given'], (h) => loadGivenBetween(h, from, ukToIso(addDaysIso(today, 2), '00:00')), today)
  const tube = useLiveQuery(hid, ['tube_changes'], (h) => loadLatestTube(h).then((latest) => ({ latest })))

  const error = logs.error ?? scheduledGiven.error ?? plans.error ?? medicines.error ?? routines.error ?? tube.error
  const ready = !!(logs.data && scheduledGiven.data && plans.data && medicines.data && routines.data && tube.data)
  return {
    householdId: hid,
    me,
    members,
    now,
    today,
    error,
    ready,
    logs: logs.data,
    /** Given doses by scheduled time, for schedule status and the double-dose check. */
    scheduledGiven: scheduledGiven.data ?? [],
    plans: plans.data,
    medicines: medicines.data,
    routines: routines.data,
    tube: tube.data?.latest ?? null,
    reload: () => {
      logs.reload()
      scheduledGiven.reload()
      tube.reload()
    },
  }
}
