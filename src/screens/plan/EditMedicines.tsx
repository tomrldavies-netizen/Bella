import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LionCub } from '../../animals'
import { AmountStepper } from '../../components/AmountStepper'
import { Card, EmptyNote } from '../../components/Card'
import { CloseIcon } from '../../components/Icons'
import { PlanEditLayout, fieldClass } from '../../components/PlanEditLayout'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Segmented } from '../../components/Segmented'
import { useReadyHousehold } from '../../household/HouseholdContext'
import { useLiveQuery } from '../../lib/useLiveQuery'
import { useNow } from '../../lib/useNow'
import { addDaysIso, currentTime, friendlyDateTime, listWords, nextDailyTime, shortDate, ukNow, ukParts, ukToIso } from '../../lib/ukTime'
import { loadMedicines, saveMedicine, type Medicine } from '../../plan/api'
import {
  DOSE_FINE_STEP,
  DOSE_STEP,
  ROUTE_LABEL,
  doseChanged,
  formatDose,
  latestVersion,
  previousVersion,
  summariseMedicineChange,
  type MedRoute,
  type MedicineState,
} from '../../plan/medicines'

const guide = <LionCub size={56} smile />

export function EditMedicines() {
  const { household, me } = useReadyHousehold()
  const q = useLiveQuery(household.id, ['medicines', 'medicine_doses'], loadMedicines)
  const [params, setParams] = useSearchParams()
  const readOnly = me.role !== 'parent'

  if (q.error) return <p className="p-4 text-alert">{q.error}</p>
  if (!q.data) {
    return (
      <>
        <ScreenHeader title="Medicines" tint="bg-meds" guide={guide} back={{ to: '/bellas-plan', label: "Bella's plan" }} />
        <div className="px-4 pt-3 md:px-7">
          <EmptyNote>Loading…</EmptyNote>
        </div>
      </>
    )
  }

  const active = q.data.filter((m) => m.active)
  const stopped = q.data.filter((m) => !m.active)
  const wanted = params.get('id')
  const selected: Medicine | null | 'new' =
    wanted === 'new' && !readOnly ? 'new' : (q.data.find((m) => m.id === wanted) ?? active[0] ?? (readOnly ? null : 'new'))
  const select = (id: string) => setParams({ id }, { replace: true })

  const tabs = (
    <>
      <div role="tablist" aria-label="Medicines" className="flex flex-wrap gap-1.5">
        {active.map((m) => {
          const on = selected !== 'new' && selected?.id === m.id
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(m.id)}
              className={`h-10 rounded-full border-[1.5px] px-3.5 text-[13px] ${on ? 'border-meds-accent bg-meds font-extrabold' : 'border-line bg-card font-bold text-ink-deep'}`}
            >
              {m.name}
            </button>
          )
        })}
        {!readOnly && (
          <button
            type="button"
            onClick={() => select('new')}
            className={`h-10 rounded-full border-[1.5px] border-dashed px-3.5 text-[13px] font-extrabold ${selected === 'new' ? 'border-meds-accent bg-meds' : 'border-line text-primary'}`}
          >
            + New
          </button>
        )}
      </div>
      {stopped.length > 0 && (
        <details className="rounded-[18px] border-[1.5px] border-line bg-card px-4 py-1">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-extrabold">Stopped medicines ({stopped.length})</summary>
          <div className="flex flex-wrap gap-1.5 pb-3">
            {stopped.map((m) => (
              <button key={m.id} type="button" onClick={() => select(m.id)} className="h-10 rounded-full border-[1.5px] border-line px-3.5 text-[13px] font-bold text-ink-deep">
                {m.name}
              </button>
            ))}
          </div>
        </details>
      )}
    </>
  )

  if (selected === null) {
    return (
      <PlanEditLayout title="Medicines" tint="bg-meds" guide={guide} readOnly dirty={false} saving={false} error={null} saveLabel="" onSave={() => {}} notify onNotifyChange={() => {}}>
        <EmptyNote>No medicines in the plan.</EmptyNote>
      </PlanEditLayout>
    )
  }

  const med = selected === 'new' ? null : selected
  const latest = med ? latestVersion(med.versions) : null
  return (
    <MedicineEditor
      key={med ? `${med.id}:${latest?.id}:${med.name}:${med.active}:${med.notes}:${latest?.effective_to}` : 'new'}
      medicine={med}
      householdId={household.id}
      readOnly={readOnly}
      tabs={tabs}
      onSaved={(id) => {
        select(id)
        q.reload()
      }}
    />
  )
}

function stateOf(med: Medicine): MedicineState {
  const v = latestVersion(med.versions)
  return {
    name: med.name,
    active: med.active,
    dose: v?.dose ?? 0,
    unit: v?.unit ?? 'ml',
    route: v?.route ?? 'either',
    times: v?.times ?? [],
    // effective_to is the start of the day after the last day.
    endDate: v?.effective_to ? ukParts(new Date(Date.parse(v.effective_to) - 60_000).toISOString()).date : null,
  }
}

const EMPTY: MedicineState = { name: '', active: true, dose: 0, unit: 'ml', route: 'either', times: [], endDate: null }

function MedicineEditor({
  medicine,
  householdId,
  readOnly,
  tabs,
  onSaved,
}: {
  medicine: Medicine | null
  householdId: string
  readOnly: boolean
  tabs: React.ReactNode
  onSaved: (id: string) => void
}) {
  const now = useNow()
  const before = medicine ? stateOf(medicine) : null
  const latest = medicine ? latestVersion(medicine.versions) : null
  const prev = medicine && latest ? previousVersion(medicine.versions, latest) : null

  const [draft, setDraft] = useState<MedicineState>(before ?? EMPTY)
  const [notes, setNotes] = useState(medicine?.notes ?? '')
  const [newTime, setNewTime] = useState('')
  const [fromMode, setFromMode] = useState<'next' | 'now' | 'custom'>(medicine ? 'next' : 'now')
  const today = ukNow(now)
  const [customDate, setCustomDate] = useState(today.date)
  const [customTime, setCustomTime] = useState(today.time)
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<MedicineState>) => setDraft((d) => ({ ...d, ...patch }))
  const after: MedicineState = { ...draft, name: draft.name.trim() }
  const summary = summariseMedicineChange(before, after, shortDate)
  const notesChanged = (medicine?.notes ?? '') !== notes.trim()
  const versionNeeded = !before || doseChanged(before, after)
  const doseMode = versionNeeded ? 'new_version' : before.endDate !== after.endDate ? 'set_end' : 'none'

  const nextDose = nextDailyTime(before?.times.length ? before.times : after.times, now)
  const resolveFrom = (at: Date) =>
    fromMode === 'custom' ? ukToIso(customDate, customTime) : fromMode === 'next' && nextDose ? nextDose : at.toISOString()
  const effectiveFrom = resolveFrom(now)
  const effectiveTo = after.endDate ? ukToIso(addDaysIso(after.endDate, 1), '00:00') : null

  const problems = [
    !after.name ? 'Give the medicine a name.' : null,
    after.dose <= 0 ? 'Set the dose.' : null,
    versionNeeded && effectiveTo && Date.parse(effectiveTo) <= Date.parse(effectiveFrom) ? 'The end date must be after the new dose starts.' : null,
    versionNeeded && fromMode === 'custom' && Date.parse(effectiveFrom) < now.getTime() - 60_000 ? 'Choose a start time from now on.' : null,
  ].filter((p): p is string => p !== null)
  const dirty = summary !== '' || notesChanged

  async function save() {
    if (problems.length) return setError(problems[0])
    setSaving(true)
    setError(null)
    try {
      const id = await saveMedicine({
        householdId,
        medicineId: medicine?.id ?? null,
        name: after.name,
        notes: notes.trim(),
        active: after.active,
        doseMode,
        dose:
          doseMode === 'none'
            ? null
            : {
                dose: after.dose,
                unit: after.unit,
                route: after.route,
                times: after.times,
                effective_from: doseMode === 'new_version' ? resolveFrom(currentTime()) : undefined,
                effective_to: effectiveTo,
                reason: reason.trim(),
              },
        // Notes-only edits aren't worth a "Recent changes" entry.
        summary,
        before,
        after,
        notify,
      })
      onSaved(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const label = 'text-[13px] font-extrabold'
  const sortedTimes = [...draft.times].sort()

  return (
    <PlanEditLayout
      title="Medicines"
      subtitle={readOnly ? 'Doses and times in the plan' : 'Change a dose, time, or add a new one'}
      tint="bg-meds"
      guide={guide}
      readOnly={readOnly}
      dirty={dirty}
      saving={saving}
      error={error ?? (dirty ? (problems[0] ?? null) : null)}
      saveLabel={medicine ? 'Save medicine' : 'Add medicine'}
      canSave={problems.length === 0}
      onSave={save}
      notify={notify}
      onNotifyChange={setNotify}
      status={summary && !problems.length ? <>Change: {summary}</> : undefined}
    >
      {tabs}
      <Card className="flex flex-col gap-3.5 px-4 py-3.5">
        {!draft.active && <p className="m-0 rounded-xl bg-meds px-3 py-2 text-[13px] font-bold">This medicine is stopped. It isn't in today's schedule.</p>}

        <label className="flex flex-col gap-1">
          <span className={label}>Name</span>
          {readOnly ? (
            <span className="text-[15px] font-bold">{draft.name}</span>
          ) : (
            <input value={draft.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} className={fieldClass} />
          )}
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className={label}>Dose</span>
            {prev && latest && prev.dose !== latest.dose && (
              <span className="text-xs font-bold text-alert">
                was {formatDose(prev.dose, prev.unit)} until {shortDate(ukParts(latest.effective_from).date)}
              </span>
            )}
            {!readOnly && <span className="text-xs text-ink-muted">Tap for 1 ml, hold for 0.1 ml</span>}
          </div>
          <AmountStepper label="Dose" value={draft.dose} onChange={(dose) => set({ dose })} step={DOSE_STEP} fineStep={DOSE_FINE_STEP} max={100} unit={draft.unit} readOnly={readOnly} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Given</span>
          {readOnly ? (
            <span className="text-[15px]">{ROUTE_LABEL[draft.route]}</span>
          ) : (
            <Segmented<MedRoute>
              label="Given"
              value={draft.route}
              onChange={(route) => set({ route })}
              accent="border-meds-accent"
              options={[
                { value: 'mouth', label: ROUTE_LABEL.mouth },
                { value: 'tube', label: ROUTE_LABEL.tube },
                { value: 'either', label: ROUTE_LABEL.either },
              ]}
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Times each day</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {sortedTimes.length === 0 && <span className="text-[13px] text-ink-muted">No set times</span>}
            {sortedTimes.map((t) => (
              <span key={t} className="flex h-[38px] items-center gap-0.5 rounded-full bg-meds pr-0.5 pl-3 text-sm font-extrabold">
                {t}
                {!readOnly && (
                  <button type="button" aria-label={`Remove ${t}`} onClick={() => set({ times: draft.times.filter((x) => x !== t) })} className="flex h-[34px] w-[34px] items-center justify-center rounded-full">
                    <CloseIcon size={16} />
                  </button>
                )}
                {readOnly && <span className="w-2.5" />}
              </span>
            ))}
            {!readOnly && (
              <span className="flex items-center gap-1.5">
                <input type="time" aria-label="New dose time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className={`${fieldClass} h-[38px] w-28`} />
                <button
                  type="button"
                  disabled={!newTime || draft.times.includes(newTime)}
                  onClick={() => {
                    set({ times: [...draft.times, newTime] })
                    setNewTime('')
                  }}
                  className="h-[38px] rounded-full border-[1.5px] border-dashed border-meds-accent px-3 text-[13px] font-extrabold whitespace-nowrap text-ink disabled:opacity-50"
                >
                  + Time
                </button>
              </span>
            )}
          </div>
        </div>

        {!readOnly && versionNeeded && (
          <div className="flex flex-col gap-1.5">
            <span className={label}>{medicine ? 'New dose from' : 'Starts'}</span>
            <Segmented
              label={medicine ? 'New dose from' : 'Starts'}
              value={fromMode}
              onChange={setFromMode}
              accent="border-meds-accent"
              options={[
                ...(nextDose ? [{ value: 'next' as const, label: `Next dose (${friendlyDateTime(nextDose)})` }] : []),
                { value: 'now' as const, label: 'Now' },
                { value: 'custom' as const, label: 'Choose' },
              ]}
            />
            {fromMode === 'custom' && (
              <div className="flex gap-2">
                <input type="date" aria-label="Start date" min={today.date} value={customDate} onChange={(e) => setCustomDate(e.target.value)} className={fieldClass} />
                <input type="time" aria-label="Start time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className={`${fieldClass} w-32`} />
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className={label}>Ends</span>
          {readOnly ? (
            <span className="text-[15px]">{draft.endDate ? shortDate(draft.endDate) : 'No end date'}</span>
          ) : (
            <div className="flex items-center gap-2">
              <input type="date" aria-label="End date" min={today.date} value={draft.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value || null })} className={fieldClass} />
              {draft.endDate && (
                <button type="button" onClick={() => set({ endDate: null })} className="min-h-11 shrink-0 px-2 text-[13px] font-extrabold text-primary">
                  No end date
                </button>
              )}
            </div>
          )}
        </div>

        {!readOnly && medicine && versionNeeded && (
          <label className="flex flex-col gap-1">
            <span className={label}>Why it changed</span>
            <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="e.g. new weight, agreed with nurse" className={fieldClass} />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className={label}>Notes</span>
          {readOnly ? (
            <span className="text-[15px]">{notes || '—'}</span>
          ) : (
            <input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Optional, e.g. give with a feed" className={fieldClass} />
          )}
        </label>

        {!readOnly && medicine && (
          <button
            type="button"
            onClick={() => set({ active: !draft.active })}
            className={`min-h-11 self-start text-[13px] font-extrabold ${draft.active ? 'text-alert' : 'text-primary'}`}
          >
            {draft.active ? 'Stop this medicine' : 'Restart this medicine'}
          </button>
        )}
      </Card>

      {medicine && medicine.versions.length > 0 && (
        <details className="rounded-[18px] border-[1.5px] border-line bg-card px-4 py-2">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-extrabold">Dose history</summary>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 pb-2">
            {[...medicine.versions]
              .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
              .map((v) => (
                <li key={v.id} className="text-[13px]">
                  <span className="font-bold">
                    {formatDose(v.dose, v.unit)} · {ROUTE_LABEL[v.route].toLowerCase()}
                    {v.times.length ? ` · ${listWords(v.times)}` : ''}
                  </span>
                  <br />
                  <span className="text-ink-muted">
                    From {friendlyDateTime(v.effective_from)}
                    {v.effective_to ? ` until ${friendlyDateTime(v.effective_to)}` : ''}
                    {v.reason ? ` · ${v.reason}` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </PlanEditLayout>
  )
}
