import { createContext, createElement, useContext, type ReactNode } from 'react'
import { useReadyHousehold } from '../household/HouseholdContext'
import { useLiveQuery } from '../lib/useLiveQuery'
import { useNow } from '../lib/useNow'
import { addDaysIso, ukNow, ukToIso } from '../lib/ukTime'
import { loadExercises, loadFeedPlans, loadMedicines, loadRoutines } from '../plan/api'
import { loadDayLogs, loadGivenBetween, loadLatestObs, loadLatestTube } from './api'
import { useOutbox } from '../offline/outbox'
import { pendingGiven, withPending } from '../offline/pending'
import { loadAppointments, loadCareTaskLogs, loadPrescriptions, loadSupplies } from '../organise/api'

const LOG_TABLES = ['feeds', 'nappies', 'medicine_given', 'notes', 'tube_changes', 'obs', 'exercise_logs', 'tummy_time'] as const

/**
 * Everything the care screens need for today (UK midnight to midnight),
 * kept live across devices. Rolls over at midnight.
 */
function useTodayData() {
  const { household, members, me } = useReadyHousehold()
  const now = useNow(30_000)
  const today = ukNow(now).date
  const from = ukToIso(today, '00:00')
  const to = ukToIso(addDaysIso(today, 1), '00:00')
  const hid = household.id

  const logs = useLiveQuery(hid, LOG_TABLES, (h) => loadDayLogs(h, from, to), today, 'day-logs')
  const plans = useLiveQuery(hid, ['feed_plans', 'feed_plan_slots'], loadFeedPlans, '', 'feed-plans')
  const medicines = useLiveQuery(hid, ['medicines', 'medicine_doses'], loadMedicines, '', 'medicines')
  const routines = useLiveQuery(hid, ['settings', 'care_tasks'], loadRoutines, '', 'routines')
  // Doses matched on their scheduled time (today and tomorrow), whenever they were logged.
  const scheduledGiven = useLiveQuery(hid, ['medicine_given'], (h) => loadGivenBetween(h, from, ukToIso(addDaysIso(today, 2), '00:00')), today, 'given')
  const exercises = useLiveQuery(hid, ['exercises', 'exercise_steps'], loadExercises, '', 'exercises')
  const lastObs = useLiveQuery(hid, ['obs'], (h) => loadLatestObs(h).then((latest) => ({ latest })), '', 'last-obs')
  const appointments = useLiveQuery(hid, ['appointments'], loadAppointments, '', 'appointments')
  const supplies = useLiveQuery(hid, ['supplies'], loadSupplies, '', 'supplies')
  const prescriptions = useLiveQuery(hid, ['prescriptions'], loadPrescriptions, '', 'prescriptions')
  const careTaskLogs = useLiveQuery(hid, ['care_task_logs'], loadCareTaskLogs, '', 'care-task-logs')
  const tube = useLiveQuery(hid, ['tube_changes'], (h) => loadLatestTube(h).then((latest) => ({ latest })), '', 'tube')

  // Changes still waiting to sync on this phone are shown straight away.
  const { ops } = useOutbox()
  const error = logs.error ?? scheduledGiven.error ?? plans.error ?? medicines.error ?? routines.error ?? tube.error ?? exercises.error ?? lastObs.error
  const ready = !!(logs.data && scheduledGiven.data && plans.data && medicines.data && routines.data && tube.data && exercises.data && lastObs.data)
  return {
    householdId: hid,
    me,
    members,
    now,
    today,
    error,
    ready,
    logs: logs.data ? withPending(logs.data, ops, me.id, from, to) : null,
    /** Given doses by scheduled time, for schedule status and the double-dose check. */
    scheduledGiven: [...(scheduledGiven.data ?? []), ...pendingGiven(ops, me.id)],
    plans: plans.data,
    medicines: medicines.data,
    routines: routines.data,
    tube: tube.data?.latest ?? null,
    exercises: exercises.data,
    lastObs: lastObs.data?.latest ?? null,
    // Extras for Up next and the tablet side panel; empty until loaded.
    appointments: appointments.data ?? [],
    supplies: supplies.data ?? [],
    prescriptions: prescriptions.data ?? [],
    careTaskLogs: careTaskLogs.data ?? [],
    reload: () => {
      logs.reload()
      scheduledGiven.reload()
      tube.reload()
      lastObs.reload()
      supplies.reload()
      prescriptions.reload()
      careTaskLogs.reload()
    },
  }
}

export type TodayData = ReturnType<typeof useTodayData>

const TodayContext = createContext<TodayData | null>(null)

/** Loads today once for the whole app (screens, overdue dots, alarm screen share it). */
export function TodayProvider({ children }: { children: ReactNode }) {
  const data = useTodayData()
  return createElement(TodayContext.Provider, { value: data }, children)
}

export function useToday(): TodayData {
  const ctx = useContext(TodayContext)
  if (!ctx) throw new Error('useToday must be used inside <TodayProvider>')
  return ctx
}
