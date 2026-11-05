import { useState, type ReactNode } from 'react'
import { Meerkat } from '../../animals'
import { AmountStepper } from '../../components/AmountStepper'
import { Card, EmptyNote } from '../../components/Card'
import { CloseIcon } from '../../components/Icons'
import { PlanEditLayout, fieldClass } from '../../components/PlanEditLayout'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Segmented } from '../../components/Segmented'
import { useReadyHousehold } from '../../household/HouseholdContext'
import { useLiveQuery } from '../../lib/useLiveQuery'
import { loadRoutines, saveRoutines, type Routines } from '../../plan/api'
import { WEEKDAYS, describeRecurrence, formatInterval, formatTempRange, summariseRoutineChange, type CareTaskDraft } from '../../plan/routines'

const guide = <Meerkat size={56} />

export function EditRoutines() {
  const { household, me } = useReadyHousehold()
  const q = useLiveQuery(household.id, ['settings', 'care_tasks'], loadRoutines)
  if (q.error) return <p className="p-4 text-alert">{q.error}</p>
  if (!q.data) {
    return (
      <>
        <ScreenHeader title="Obs & routines" tint="bg-obs" guide={guide} back={{ to: '/bellas-plan', label: "Bella's plan" }} />
        <div className="px-4 pt-3 md:px-7">
          <EmptyNote>Loading…</EmptyNote>
        </div>
      </>
    )
  }
  return <RoutinesEditor key={JSON.stringify(q.data)} initial={q.data} householdId={household.id} readOnly={me.role !== 'parent'} onSaved={q.reload} />
}

/** A setting the parents may leave unset: "Not set" with a button, or a stepper with "Clear". */
function OptionalSetting({
  label,
  hint,
  value,
  onChange,
  readOnly,
  text,
  stepper,
  startAt,
}: {
  label: string
  hint: string
  value: number | null
  onChange: (v: number | null) => void
  readOnly: boolean
  text: (v: number) => string
  stepper: ReactNode
  startAt: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-col">
          <span className="text-[13px] font-extrabold">{label}</span>
          <span className="text-xs text-ink-muted">{hint}</span>
        </span>
        {readOnly ? (
          <span className="font-display text-lg font-extrabold">{value === null ? 'Not set' : text(value)}</span>
        ) : value === null ? (
          <button type="button" onClick={() => onChange(startAt)} className="h-11 rounded-full border-[1.5px] border-primary px-4 text-[13px] font-extrabold text-primary">
            Set
          </button>
        ) : (
          stepper
        )}
      </div>
      {!readOnly && value !== null && (
        <button type="button" onClick={() => onChange(null)} className="min-h-11 self-end px-2 text-xs font-extrabold text-ink-muted">
          Clear
        </button>
      )}
    </div>
  )
}

function RoutinesEditor({ initial, householdId, readOnly, onSaved }: { initial: Routines; householdId: string; readOnly: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState<Routines>(initial)
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<Routines>) => setDraft((d) => ({ ...d, ...patch }))
  const setTask = (i: number, patch: Partial<CareTaskDraft>) => set({ tasks: draft.tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  const after: Routines = { ...draft, tasks: draft.tasks.map((t) => ({ ...t, name: t.name.trim() })) }
  const summary = summariseRoutineChange(initial, after)
  const problems = [
    after.tasks.some((t) => !t.name) ? 'Give every care task a name.' : null,
    after.tasks.some((t) => t.recurrence.kind === 'weekly' && t.recurrence.days.length === 0) ? 'Pick at least one day for each weekly task.' : null,
    after.tempMinC !== null && after.tempMaxC !== null && after.tempMinC >= after.tempMaxC ? 'The lowest normal temperature must be below the highest.' : null,
  ].filter((p): p is string => p !== null)

  async function save() {
    if (problems.length) return setError(problems[0])
    setSaving(true)
    setError(null)
    try {
      await saveRoutines({ householdId, before: initial, after, summary, notify })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <PlanEditLayout
      title="Obs & routines"
      subtitle={readOnly ? 'Obs, tummy time, tube changes and care tasks' : 'Enter what the team has agreed'}
      tint="bg-obs"
      guide={guide}
      readOnly={readOnly}
      dirty={summary !== ''}
      saving={saving}
      error={error ?? (summary ? (problems[0] ?? null) : null)}
      saveLabel="Save routines"
      canSave={problems.length === 0}
      onSave={save}
      notify={notify}
      onNotifyChange={setNotify}
      status={summary && !problems.length ? <>Change: {summary}</> : undefined}
    >
      <Card className="flex flex-col gap-4 px-4 py-3.5">
        <OptionalSetting
          label="Obs"
          hint="How often to check temperature, breathing and sleep"
          value={draft.obsIntervalMin}
          onChange={(obsIntervalMin) => set({ obsIntervalMin })}
          readOnly={readOnly}
          text={(v) => `Every ${formatInterval(v)}`}
          startAt={60}
          stepper={
            <AmountStepper label="Obs interval" value={(draft.obsIntervalMin ?? 60) / 60} onChange={(h) => set({ obsIntervalMin: Math.round(h * 60) })} step={0.5} min={0.5} max={24} unit="hrs" size="sm" />
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-col">
            <span className="text-[13px] font-extrabold">Tummy time goal</span>
            <span className="text-xs text-ink-muted">Minutes a day</span>
          </span>
          <AmountStepper label="Tummy time goal" value={draft.tummyGoalMin} onChange={(tummyGoalMin) => set({ tummyGoalMin })} step={5} fineStep={1} max={240} unit="min" size="sm" readOnly={readOnly} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-col">
              <span className="text-[13px] font-extrabold">Normal temperature range</span>
              <span className="text-xs text-ink-muted">From Bella's team. Obs outside it are highlighted.</span>
            </span>
            {readOnly ? (
              <span className="font-display text-lg font-extrabold">
                {draft.tempMinC !== null && draft.tempMaxC !== null ? formatTempRange(draft.tempMinC, draft.tempMaxC) : 'Not set'}
              </span>
            ) : (
              draft.tempMinC === null && (
                <button type="button" onClick={() => set({ tempMinC: 37, tempMaxC: 37 })} className="h-11 rounded-full border-[1.5px] border-primary px-4 text-[13px] font-extrabold text-primary">
                  Set
                </button>
              )
            )}
          </div>
          {!readOnly && draft.tempMinC !== null && draft.tempMaxC !== null && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold">From</span>
                <AmountStepper label="Lowest normal temperature" value={draft.tempMinC} onChange={(tempMinC) => set({ tempMinC })} step={0.1} min={30} max={45} unit="°C" size="sm" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold">To</span>
                <AmountStepper label="Highest normal temperature" value={draft.tempMaxC} onChange={(tempMaxC) => set({ tempMaxC })} step={0.1} min={30} max={45} unit="°C" size="sm" />
              </div>
              <button type="button" onClick={() => set({ tempMinC: null, tempMaxC: null })} className="min-h-11 self-end px-2 text-xs font-extrabold text-ink-muted">
                Clear
              </button>
            </>
          )}
        </div>
        <OptionalSetting
          label="NG tube change"
          hint="Days between tube changes"
          value={draft.tubeChangeDays}
          onChange={(tubeChangeDays) => set({ tubeChangeDays })}
          readOnly={readOnly}
          text={(v) => `Every ${v} day${v === 1 ? '' : 's'}`}
          startAt={1}
          stepper={
            <AmountStepper label="Days between tube changes" value={draft.tubeChangeDays ?? 1} onChange={(tubeChangeDays) => set({ tubeChangeDays })} step={1} min={1} max={60} unit="days" size="sm" />
          }
        />
      </Card>

      <section aria-labelledby="care-tasks" className="flex flex-col gap-2">
        <h2 id="care-tasks" className="m-0 text-xl font-bold">
          Bath &amp; care tasks
        </h2>
        {draft.tasks.length === 0 && <EmptyNote>No care tasks yet, e.g. bath day or skin check.</EmptyNote>}
        {draft.tasks.map((t, i) => (
          <Card key={t.id ?? `new-${i}`} className="flex flex-col gap-2.5 px-4 py-3">
            {readOnly ? (
              <div className="flex flex-col">
                <span className="text-sm font-extrabold">{t.name}</span>
                <span className="text-xs text-ink-muted">{describeRecurrence(t.recurrence)}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <input aria-label="Care task name" value={t.name} maxLength={80} placeholder="e.g. Bath" onChange={(e) => setTask(i, { name: e.target.value })} className={fieldClass} />
                  <button type="button" aria-label={`Remove ${t.name || 'task'}`} onClick={() => set({ tasks: draft.tasks.filter((_, j) => j !== i) })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-alert">
                    <CloseIcon size={20} />
                  </button>
                </div>
                <Segmented
                  label={`How ${t.name || 'this task'} repeats`}
                  value={t.recurrence.kind}
                  onChange={(kind) => setTask(i, { recurrence: kind === 'weekly' ? { kind, days: [] } : { kind, every: 1 } })}
                  options={[
                    { value: 'every_n_days', label: 'Every few days' },
                    { value: 'weekly', label: 'On set days' },
                  ]}
                />
                {t.recurrence.kind === 'every_n_days' ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-extrabold">{describeRecurrence(t.recurrence)}</span>
                    <AmountStepper label="Days between" value={t.recurrence.every} onChange={(every) => setTask(i, { recurrence: { kind: 'every_n_days', every } })} step={1} min={1} max={60} unit="days" size="sm" />
                  </div>
                ) : (
                  <div role="group" aria-label="Days of the week" className="grid grid-cols-7 gap-1">
                    {WEEKDAYS.map((d, k) => {
                      const day = k + 1
                      const days = t.recurrence.kind === 'weekly' ? t.recurrence.days : []
                      const on = days.includes(day)
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setTask(i, { recurrence: { kind: 'weekly', days: on ? days.filter((x) => x !== day) : [...days, day].sort() } })}
                          className={`h-11 rounded-xl border-[1.5px] text-xs font-extrabold ${on ? 'border-obs-accent bg-obs' : 'border-line bg-card text-ink-deep'}`}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </Card>
        ))}
        {!readOnly && (
          <button
            type="button"
            onClick={() => set({ tasks: [...draft.tasks, { id: null, name: '', recurrence: { kind: 'every_n_days', every: 1 } }] })}
            className="min-h-11 self-start text-[13px] font-extrabold text-primary"
          >
            + Add a care task
          </button>
        )}
      </section>
    </PlanEditLayout>
  )
}
