import { useState } from 'react'
import { Hippo } from '../../animals'
import { AmountStepper } from '../../components/AmountStepper'
import { BottomSheet, ChoiceButton } from '../../components/BottomSheet'
import { ErrorNote } from '../../components/Field'
import { fieldClass } from '../../components/PlanEditLayout'
import { Segmented } from '../../components/Segmented'
import { Toggle } from '../../components/Toggle'
import { DOSE_FINE_STEP, DOSE_STEP } from '../../plan/medicines'
import { currentTime, ukParts, ukToIso } from '../../lib/ukTime'
import { deleteLog, updateLog, type LogTable } from '../api'
import { FeedForm } from '../FeedForm'
import { draftFromPlanned, feedRow, type FeedDraft } from '../feedDraft'
import type { FeedPlanVersion } from '../../plan/api'
import { plannedFeedsAround } from '../feedLog'
import type { TimelineEntry } from '../timeline'
import { ObsForm } from '../ObsForm'
import { obsRow, type ObsDraft } from '../obsDraft'
import type { TempRange } from '../obs'

const label = 'text-[13px] font-extrabold'
const saveBtn = 'h-12 w-full rounded-full bg-primary text-base font-extrabold text-white disabled:opacity-50'

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** One tap: Wet / Dirty / Both (SPEC §4.1). */
export function NappySheet({ onLog, onClose }: { onLog: (wet: boolean, dirty: boolean) => void; onClose: () => void }) {
  return (
    <BottomSheet title="Nappy" onClose={onClose}>
      <div className="flex gap-2.5">
        <ChoiceButton label="Wet" onClick={() => onLog(true, false)} className="bg-nappies" icon={<Hippo size={30} />} />
        <ChoiceButton label="Dirty" onClick={() => onLog(false, true)} className="bg-nappies" icon={<Hippo size={30} />} />
        <ChoiceButton label="Both" onClick={() => onLog(true, true)} className="bg-nappies" icon={<Hippo size={30} />} />
      </div>
      <p className="m-0 text-xs text-ink-muted">Logged as now. Tap it in Today's list to change the time or add a note.</p>
    </BottomSheet>
  )
}

export function NoteSheet({ onSave, onClose }: { onSave: (text: string) => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <BottomSheet title="Note" onClose={onClose}>
      <textarea
        aria-label="Note"
        value={text}
        maxLength={4000}
        rows={4}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-xl border-[1.5px] border-line bg-field p-3 text-[15px] focus:border-primary focus:outline-none"
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      <button
        type="button"
        disabled={!text.trim() || busy}
        className={saveBtn}
        onClick={async () => {
          setBusy(true)
          try {
            await onSave(text.trim())
          } catch (e) {
            setError(errorText(e))
            setBusy(false)
          }
        }}
      >
        Save note
      </button>
    </BottomSheet>
  )
}

const TABLE: Record<TimelineEntry['kind'], LogTable> = {
  feed: 'feeds',
  nappy: 'nappies',
  given: 'medicine_given',
  note: 'notes',
  tube: 'tube_changes',
  obs: 'obs',
  exercise: 'exercise_logs',
  tummy: 'tummy_time',
}
const TITLE: Record<TimelineEntry['kind'], string> = {
  feed: 'Edit feed',
  nappy: 'Edit nappy',
  given: 'Edit dose given',
  note: 'Edit note',
  tube: 'Edit tube change',
  obs: 'Edit obs',
  exercise: 'Edit exercise',
  tummy: 'Edit tummy time',
}

/** Tap a timeline entry to edit or delete it (SPEC §4.1). */
export function EditEntrySheet({
  entry,
  plans,
  medicineName,
  unit,
  range = null,
  onDone,
  onClose,
}: {
  entry: TimelineEntry
  /** Feed plan versions, to offer the planned feeds around this entry's time. */
  plans: FeedPlanVersion[]
  medicineName?: string
  unit?: string
  /** Normal temperature range, for highlighting obs. */
  range?: TempRange
  onDone: () => void
  onClose: () => void
}) {
  const row = entry.row
  const when = ukParts(row.logged_at)
  const plannedOptions = plannedFeedsAround(plans, row.logged_at)
  const [time, setTime] = useState(when.time)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Per-kind drafts
  const [nappy, setNappy] = useState(entry.kind === 'nappy' ? { wet: entry.row.wet, dirty: entry.row.dirty } : { wet: true, dirty: false })
  const [text, setText] = useState(entry.kind === 'note' ? entry.row.text : '')
  const [dose, setDose] = useState(entry.kind === 'given' ? (entry.row.dose_given ?? 0) : 0)
  const [obs, setObs] = useState<ObsDraft>(() =>
    entry.kind === 'obs'
      ? { temp: entry.row.temperature_c ?? 37, breathing: entry.row.breathing ?? 'normal', sleep: entry.row.sleep ?? 'settled', note: entry.row.note ?? '' }
      : { temp: 37, breathing: 'normal', sleep: 'settled', note: '' },
  )
  const [minutes, setMinutes] = useState(entry.kind === 'tummy' ? entry.row.duration_min : 0)
  const [nostril, setNostril] = useState<'left' | 'right'>(entry.kind === 'tube' ? entry.row.nostril : 'left')
  const [feed, setFeed] = useState<FeedDraft>(() => {
    if (entry.kind !== 'feed') return draftFromPlanned(null, when.time)
    const f = entry.row
    return {
      planned: plannedOptions.find((p) => p.id && p.id === f.feed_plan_slot_id) ?? null,
      method: f.method,
      oral: Number(f.oral_ml),
      tube: Number(f.tube_ml),
      milk: f.milk_type,
      fortified: f.fortified,
      sick: f.sick_level,
      note: f.note ?? '',
      time: when.time,
    }
  })

  const loggedAt = ukToIso(when.date, entry.kind === 'feed' ? feed.time : time)
  const future = Date.parse(loggedAt) > currentTime().getTime() + 5 * 60_000

  function patch(): object {
    // Every kind is handled below.
    switch (entry.kind) {
      case 'feed':
        return feedRow(feed, loggedAt)
      case 'nappy':
        return { logged_at: loggedAt, ...nappy }
      case 'note':
        return { logged_at: loggedAt, text: text.trim() }
      case 'given':
        return { logged_at: loggedAt, given_at: loggedAt, dose_given: dose }
      case 'tube':
        return { logged_at: loggedAt, inserted_at: loggedAt, nostril }
      case 'obs':
        return { logged_at: loggedAt, ...obsRow(obs) }
      case 'exercise':
        return { logged_at: loggedAt }
      case 'tummy':
        return { logged_at: loggedAt, duration_min: minutes }
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onDone()
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  const invalid =
    (entry.kind === 'nappy' && !nappy.wet && !nappy.dirty) || (entry.kind === 'note' && !text.trim()) || (entry.kind === 'tummy' && minutes <= 0) || future

  return (
    <BottomSheet title={TITLE[entry.kind]} onClose={onClose}>
      {entry.kind === 'feed' && <FeedForm draft={feed} onChange={setFeed} plannedOptions={plannedOptions} />}
      {entry.kind === 'nappy' && (
        <div className="flex gap-3">
          <Toggle on={nappy.wet} onChange={(wet) => setNappy({ ...nappy, wet })} label="Wet" />
          <Toggle on={nappy.dirty} onChange={(dirty) => setNappy({ ...nappy, dirty })} label="Dirty" />
        </div>
      )}
      {entry.kind === 'note' && (
        <textarea aria-label="Note" value={text} rows={4} maxLength={4000} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border-[1.5px] border-line bg-field p-3 text-[15px]" />
      )}
      {entry.kind === 'given' && (
        <div className="flex items-center justify-between gap-2">
          <span className={label}>{medicineName} given</span>
          <AmountStepper label="Dose given" value={dose} onChange={setDose} step={DOSE_STEP} fineStep={DOSE_FINE_STEP} max={100} unit={unit ?? 'ml'} />
        </div>
      )}
      {entry.kind === 'obs' && <ObsForm draft={obs} onChange={setObs} range={range} />}
      {entry.kind === 'tummy' && (
        <div className="flex items-center justify-between gap-2">
          <span className={label}>Tummy time</span>
          <AmountStepper label="Minutes" value={minutes} onChange={setMinutes} step={1} min={0} max={240} unit="min" />
        </div>
      )}
      {entry.kind === 'tube' && (
        <Segmented
          label="Nostril"
          value={nostril}
          onChange={setNostril}
          options={[
            { value: 'left', label: 'Left nostril' },
            { value: 'right', label: 'Right nostril' },
          ]}
        />
      )}
      {entry.kind !== 'feed' && (
        <label className="flex items-center justify-between gap-2">
          <span className={label}>Time</span>
          <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className={`${fieldClass} w-32`} />
        </label>
      )}
      {future && <ErrorNote>That time is in the future.</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <button type="button" disabled={busy || invalid} className={saveBtn} onClick={() => run(() => updateLog(TABLE[entry.kind], row.id, patch()))}>
        Save changes
      </button>
      {confirmDelete ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-meds p-3">
          <span className="text-sm font-bold">Delete this entry? This can't be undone.</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className="h-11 flex-1 rounded-full border-[1.5px] border-line bg-card text-sm font-extrabold">
              Keep it
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => deleteLog(TABLE[entry.kind], row.id))} className="h-11 flex-1 rounded-full bg-alert text-sm font-extrabold text-white">
              Delete
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 text-sm font-extrabold text-alert">
          Delete entry
        </button>
      )}
    </BottomSheet>
  )
}
