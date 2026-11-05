import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Elephant, LionCub } from '../animals'
import { countdown } from '../care/countdown'
import { useToday } from '../care/useToday'
import { useLiveQuery } from '../lib/useLiveQuery'
import { useReadyHousehold } from '../household/HouseholdContext'
import { alarmAction, loadMyAlarms, type RingingAlarm } from './alarmApi'
import { startAlarmSound, stopAlarmSound, unlockAlarmSound } from './alarmSound'

/** Has this been logged on this phone already (so the alarm can stop at once)? */
function loggedHere(a: RingingAlarm, t: ReturnType<typeof useToday>) {
  const due = Date.parse(a.due_at)
  if (a.type === 'medicine') {
    return t.scheduledGiven.some((g) => g.medicine_id === a.ref_id && g.scheduled_for && Date.parse(g.scheduled_for) === due)
  }
  return (t.logs?.feeds ?? []).some((f) => Date.parse(f.logged_at) >= due - 60 * 60_000 && Date.parse(f.logged_at) <= due + 3 * 60 * 60_000)
}

/**
 * Full-screen alarm when the app is open and one of this person's feed or
 * medicine alarms is ringing: looping tone and vibration, Log it / Snooze / Stop.
 */
export function AlarmScreen() {
  const { household } = useReadyHousehold()
  const t = useToday()
  const navigate = useNavigate()
  const q = useLiveQuery(household.id, ['reminders_sent'], () => loadMyAlarms(), String(Math.floor(t.now.getTime() / 60_000)))
  const [dismissed, setDismissed] = useState<string[]>([])
  const ringing = (q.data ?? []).find((a) => !a.snoozed && !dismissed.includes(a.token) && !loggedHere(a, t)) ?? null

  useEffect(() => {
    if (!ringing) return
    startAlarmSound()
    return () => stopAlarmSound()
  }, [ringing?.token]) // eslint-disable-line react-hooks/exhaustive-deps -- restart only for a different alarm

  if (!ringing) return null
  const close = () => setDismissed((d) => [...d, ringing.token])
  const act = async (action: 'stop' | 'snooze') => {
    close()
    try {
      await alarmAction(ringing.token, action)
    } finally {
      q.reload()
    }
  }
  const late = Date.parse(ringing.due_at) < t.now.getTime()

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="alarm-title" aria-describedby="alarm-body" onPointerDown={unlockAlarmSound} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-alert px-6 text-center text-white">
      <span className="rounded-full bg-white p-3 motion-safe:animate-pulse">{ringing.type === 'feed' ? <Elephant size={96} bg="#DCEBF2" cheeks /> : <LionCub size={96} bg="#FBE3D3" smile />}</span>
      <div className="flex flex-col gap-1">
        <h2 id="alarm-title" className="m-0 font-display text-[34px] leading-tight font-extrabold">
          {ringing.title}
        </h2>
        <p id="alarm-body" className="m-0 text-lg font-bold">
          {ringing.body}
        </p>
        <p className="m-0 text-base">{late ? `${countdown(ringing.due_at, t.now).replace(' ago', '')} late` : `due in ${countdown(ringing.due_at, t.now)}`}</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2.5">
        <button
          type="button"
          onClick={() => {
            close()
            navigate(ringing.type === 'feed' ? '/feeds' : '/meds')
          }}
          className="h-14 rounded-full bg-white font-display text-xl font-extrabold text-alert"
        >
          {ringing.type === 'feed' ? 'Log the feed' : 'Mark it given'}
        </button>
        <button type="button" onClick={() => act('snooze')} className="h-12 rounded-full border-2 border-white text-base font-extrabold">
          Snooze 5 min
        </button>
        <button type="button" onClick={() => act('stop')} className="h-12 rounded-full text-base font-extrabold underline">
          Stop alarm
        </button>
      </div>
    </div>
  )
}
