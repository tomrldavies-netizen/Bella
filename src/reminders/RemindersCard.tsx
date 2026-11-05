import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { AmountStepper } from '../components/AmountStepper'
import { fieldClass } from '../components/PlanEditLayout'
import { Toggle } from '../components/Toggle'
import { useHousehold, useReadyHousehold } from '../household/HouseholdContext'
import { pushConfigured, pushState, saveReminderSettings, sendTest, turnOffPush, turnOnPush, type PushState } from './push'
import { LEAD_TYPES, REMINDER_LABEL, REMINDER_TYPES, isOn, leadOf, type ReminderSettings } from './settings'

const STATE_TEXT: Record<PushState, string> = {
  unsupported: "This browser can't show reminders.",
  'needs-install': 'On iPhone, reminders only work once the app is on your Home Screen. Add it (Share → Add to Home Screen), open it from there, then come back here.',
  blocked: 'Reminders are blocked for this app in your phone settings. Allow notifications for it, then come back here.',
  off: 'Reminders are off on this phone.',
  on: 'Reminders are on for this phone.',
}

/** Per-person reminder settings and this phone's on/off (Family & sharing). */
export function RemindersCard() {
  const { household, me } = useReadyHousehold()
  const { reload } = useHousehold()
  const saved = (me.reminder_settings ?? {}) as ReminderSettings
  const [draft, setDraft] = useState<ReminderSettings>(saved)
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const configured = pushConfigured()

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'))
  }, [])

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const m = await fn()
      if (m) setMsg(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const setType = (type: (typeof REMINDER_TYPES)[number], on: boolean) => setDraft((d) => ({ ...d, types: { ...d.types, [type]: on } }))
  const quiet = draft.quiet ?? null

  return (
    <Card className="flex flex-col gap-3 px-4 py-3.5">
      <div className="flex flex-col">
        <h2 className="m-0 text-xl font-bold">Reminders</h2>
        <span className="text-xs text-ink-muted">Your own settings. Everyone chooses their own.</span>
      </div>

      {!configured ? (
        <p className="m-0 rounded-xl bg-banner px-3 py-2 text-sm">
          Reminders aren't set up yet.{' '}
          {me.role === 'parent' ? (
            <>
              Follow the reminders setup guide, starting with{' '}
              <Link to="/bellas-plan/family/reminder-keys" className="font-bold">
                making the reminder keys
              </Link>
              .
            </>
          ) : (
            'A parent needs to finish setting them up.'
          )}
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl bg-tabs px-3 py-2.5">
          <span className={`text-sm font-bold ${state === 'blocked' ? 'text-alert' : ''}`}>{state ? STATE_TEXT[state] : 'Checking this phone…'}</span>
          <div className="flex flex-wrap gap-2">
            {(state === 'off' || state === 'blocked') && (
              <button type="button" disabled={busy} onClick={() => run(async () => setState(await turnOnPush(household.id, me.id)))} className="h-11 rounded-full bg-primary px-4 text-sm font-extrabold text-white disabled:opacity-50">
                Turn on reminders
              </button>
            )}
            {state === 'on' && (
              <>
                <button type="button" disabled={busy} onClick={() => run(sendTest)} className="h-11 rounded-full bg-primary px-4 text-sm font-extrabold text-white disabled:opacity-50">
                  Send a test
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await turnOffPush()
                      setState('off')
                    })
                  }
                  className="h-11 rounded-full border-[1.5px] border-line bg-card px-4 text-sm font-extrabold"
                >
                  Turn off on this phone
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col">
        {REMINDER_TYPES.map((type) => (
          <div key={type} className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line-soft py-1.5 last:border-b-0">
            <Toggle on={isOn(draft, me.role, type)} onChange={(on) => setType(type, on)} label={REMINDER_LABEL[type]} />
            {(LEAD_TYPES as readonly string[]).includes(type) && isOn(draft, me.role, type) && (
              <AmountStepper
                label={`${REMINDER_LABEL[type]}: minutes before`}
                value={leadOf(draft, type as (typeof LEAD_TYPES)[number])}
                onChange={(n) => setDraft((d) => ({ ...d, lead: { ...d.lead, [type]: n } }))}
                step={5}
                min={0}
                max={120}
                unit="min before"
                size="sm"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-line px-3 py-2.5">
        <Toggle on={!!quiet} onChange={(on) => setDraft((d) => ({ ...d, quiet: on ? { start: '22:00', end: '07:00' } : null }))} label="Quiet hours" />
        {quiet && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span>From</span>
              <input type="time" aria-label="Quiet hours start" value={quiet.start} onChange={(e) => e.target.value && setDraft((d) => ({ ...d, quiet: { ...quiet, start: e.target.value } }))} className={`${fieldClass} !w-28`} />
              <span>to</span>
              <input type="time" aria-label="Quiet hours end" value={quiet.end} onChange={(e) => e.target.value && setDraft((d) => ({ ...d, quiet: { ...quiet, end: e.target.value } }))} className={`${fieldClass} !w-28`} />
            </div>
            <span className="text-xs text-ink-muted">Medicines still come through. Whoever is on nights can leave quiet hours off.</span>
          </>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {msg && <p className="m-0 text-sm font-bold text-primary">{msg}</p>}
      <button
        type="button"
        disabled={!dirty || busy}
        onClick={() =>
          run(async () => {
            await saveReminderSettings(household.id, draft)
            reload()
            return 'Reminder settings saved'
          })
        }
        className="h-12 rounded-full bg-primary font-extrabold text-white disabled:opacity-50"
      >
        Save reminder settings
      </button>
    </Card>
  )
}
