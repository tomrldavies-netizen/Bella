import { useState } from 'react'
import { AmountStepper } from '../../components/AmountStepper'
import { BottomSheet } from '../../components/BottomSheet'
import { ErrorNote } from '../../components/Field'
import { fieldClass } from '../../components/PlanEditLayout'
import type { Member } from '../../data/types'
import { currentTime, ukNow, ukParts, ukToIso } from '../../lib/ukTime'
import { DOSE_FINE_STEP, DOSE_STEP, formatDose } from '../../plan/medicines'

const ROUTE_WORDS = { mouth: 'by mouth', tube: 'via tube', either: 'by mouth or via tube' } as const
import { AlreadyGiven, giveMedicine } from '../api'
import type { DoseSlot } from '../medSchedule'
import type { GivenLog } from '../types'

/**
 * Mark a scheduled dose as given. If it's already been given, says who gave it
 * and when, and asks before logging another (SPEC §4.3). The database checks
 * too, so two phones can't both log it at the same moment.
 */
export function GiveSheet({
  householdId,
  slot,
  already,
  members,
  onDone,
  onClose,
}: {
  householdId: string
  slot: DoseSlot
  already: GivenLog[]
  members: Member[]
  onDone: () => void
  onClose: () => void
}) {
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? 'Someone'
  const first = already[0]
  const [conflict, setConflict] = useState<{ by: string; at: string } | null>(
    first ? { by: nameOf(first.logged_by), at: first.given_at } : null,
  )
  const [confirmed, setConfirmed] = useState(false)
  const [dose, setDose] = useState(slot.dose)
  const [time, setTime] = useState(() => ukNow(currentTime()).time)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const date = ukNow(currentTime()).date
  const givenAt = ukToIso(date, time)
  const future = Date.parse(givenAt) > currentTime().getTime() + 5 * 60_000

  async function give(allowRepeat: boolean) {
    setBusy(true)
    setError(null)
    try {
      await giveMedicine({ householdId, medicineId: slot.medicineId, scheduledFor: slot.scheduledFor, givenAt, dose, allowRepeat })
      onDone()
    } catch (e) {
      setBusy(false)
      if (e instanceof AlreadyGiven) {
        setConflict({ by: e.by, at: e.at })
        setConfirmed(false)
      } else setError(e instanceof Error ? e.message : String(e))
    }
  }

  const blocked = conflict && !confirmed
  return (
    <BottomSheet title={`${slot.name} · ${slot.time}`} onClose={onClose}>
      <p className="m-0 text-sm text-ink-muted">
        Plan: {formatDose(slot.dose, slot.unit)} · {ROUTE_WORDS[slot.route]}
      </p>

      {conflict && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-meds-accent bg-meds p-3">
          <span className="text-[15px] font-extrabold">
            Already given by {conflict.by}
            {conflict.at ? ` at ${ukParts(conflict.at).time}` : ''}
          </span>
          {!confirmed ? (
            <>
              <span className="text-sm">Only log another dose if one was really given again.</span>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="h-11 flex-1 rounded-full bg-primary text-sm font-extrabold text-white">
                  Don't log
                </button>
                <button type="button" onClick={() => setConfirmed(true)} className="h-11 flex-1 rounded-full border-[1.5px] border-alert bg-card text-sm font-extrabold text-alert">
                  Log another dose
                </button>
              </div>
            </>
          ) : (
            <span className="text-sm font-bold text-alert">Logging another dose for this time.</span>
          )}
        </div>
      )}

      {!blocked && (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="flex flex-col">
              <span className="text-[13px] font-extrabold">Dose given</span>
              <span className="text-xs text-ink-muted">Tap for 1 ml, hold for 0.1 ml</span>
            </span>
            <AmountStepper label="Dose given" value={dose} onChange={setDose} step={DOSE_STEP} fineStep={DOSE_FINE_STEP} max={100} unit={slot.unit} />
          </div>
          {dose !== slot.dose && <p className="m-0 text-xs font-bold text-alert">Different from the plan ({formatDose(slot.dose, slot.unit)}).</p>}
          <label className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-extrabold whitespace-nowrap">Given at</span>
            <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className={`${fieldClass} !w-32`} />
          </label>
          {future && <ErrorNote>That time is in the future.</ErrorNote>}
          {error && <ErrorNote>{error}</ErrorNote>}
          <button
            type="button"
            disabled={busy || future || dose <= 0}
            onClick={() => give(confirmed)}
            className="h-12 w-full rounded-full bg-primary text-base font-extrabold text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Mark given'}
          </button>
        </>
      )}
    </BottomSheet>
  )
}
