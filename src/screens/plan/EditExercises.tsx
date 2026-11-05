import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Hornbill, Monkey } from '../../animals'
import { Card, EmptyNote } from '../../components/Card'
import { CloseIcon, DownIcon, UpIcon } from '../../components/Icons'
import { PlanEditLayout, fieldClass } from '../../components/PlanEditLayout'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useReadyHousehold } from '../../household/HouseholdContext'
import { useLiveQuery } from '../../lib/useLiveQuery'
import { loadExercises, loadRoutines, saveExercise, type Exercise } from '../../plan/api'
import { EXERCISE_TYPE_LABEL, howOften, summariseExerciseChange, type ExerciseState, type ExerciseType } from '../../plan/exercises'

const LOOK: Record<ExerciseType, { tint: string; badge: string; tab: string; guide: React.ReactNode }> = {
  physio: { tint: 'bg-physio', badge: 'bg-physio', tab: 'bg-physio border-physio-accent', guide: <Monkey size={56} /> },
  speech_language: { tint: 'bg-speech', badge: 'bg-speech', tab: 'bg-speech border-speech-accent', guide: <Hornbill size={56} /> },
}

export function EditExercises() {
  const { household, me } = useReadyHousehold()
  const q = useLiveQuery(household.id, ['exercises', 'exercise_steps'], loadExercises)
  const routines = useLiveQuery(household.id, ['settings'], loadRoutines)
  const [params, setParams] = useSearchParams()
  const type: ExerciseType = params.get('type') === 'speech_language' ? 'speech_language' : 'physio'
  const readOnly = me.role !== 'parent'
  const look = LOOK[type]

  if (q.error) return <p className="p-4 text-alert">{q.error}</p>
  if (!q.data) {
    return (
      <>
        <ScreenHeader title="Exercises" tint={look.tint} guide={look.guide} back={{ to: '/bellas-plan', label: "Bella's plan" }} />
        <div className="px-4 pt-3 md:px-7">
          <EmptyNote>Loading…</EmptyNote>
        </div>
      </>
    )
  }

  const ofType = q.data.filter((e) => e.type === type)
  const active = ofType.filter((e) => e.active)
  const retired = ofType.filter((e) => !e.active)
  const wanted = params.get('id')
  const selected: Exercise | 'new' | null =
    wanted === 'new' && !readOnly ? 'new' : (ofType.find((e) => e.id === wanted) ?? active[0] ?? (readOnly ? null : 'new'))
  const go = (next: { type?: ExerciseType; id?: string }) => {
    const p: Record<string, string> = { type: next.type ?? type }
    if (next.id) p.id = next.id
    setParams(p, { replace: true })
  }
  const others = active.filter((e) => selected === 'new' || e.id !== selected?.id)

  const tabs = (
    <div role="tablist" aria-label="Exercise type" className="flex gap-1.5 rounded-[14px] bg-tabs p-1">
      {(['physio', 'speech_language'] as const).map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={t === type}
          onClick={() => go({ type: t })}
          className={`h-[42px] flex-1 rounded-[10px] text-sm ${t === type ? `border-[1.5px] font-extrabold ${LOOK[t].tab}` : 'font-bold text-ink-deep'}`}
        >
          {EXERCISE_TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  )

  const list = (
    <>
      {others.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {others.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => go({ id: e.id })}
              className="flex min-h-[52px] items-center justify-between gap-2 rounded-2xl border-[1.5px] border-line bg-card px-3 py-1.5 text-left"
            >
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-extrabold">{e.name}</span>
                <span className="text-xs text-ink-muted">{howOften(e.per_day, e.timing_note)}</span>
              </span>
              <span className="text-[13px] font-extrabold text-primary">{readOnly ? 'View' : 'Edit'}</span>
            </button>
          ))}
        </div>
      )}
      {type === 'physio' && routines.data && (
        <Link
          to="/bellas-plan/routines"
          className="flex min-h-[52px] items-center justify-between gap-2 rounded-2xl border-[1.5px] border-line bg-card px-3 py-1.5 text-ink no-underline hover:text-ink"
        >
          <span className="flex flex-col">
            <span className="text-sm font-extrabold">Tummy time</span>
            <span className="text-xs text-ink-muted">Goal {routines.data.tummyGoalMin} min a day</span>
          </span>
          <span className="text-[13px] font-extrabold text-primary">{readOnly ? 'View' : 'Edit'}</span>
        </Link>
      )}
      {!readOnly && selected !== 'new' && (
        <button type="button" onClick={() => go({ id: 'new' })} className="min-h-11 self-start text-[13px] font-extrabold text-primary">
          + Add {EXERCISE_TYPE_LABEL[type].toLowerCase()} exercise
        </button>
      )}
      {retired.length > 0 && (
        <details className="rounded-[18px] border-[1.5px] border-line bg-card px-4 py-1">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-extrabold">Retired ({retired.length})</summary>
          <div className="flex flex-wrap gap-1.5 pb-3">
            {retired.map((e) => (
              <button key={e.id} type="button" onClick={() => go({ id: e.id })} className="h-11 rounded-full border-[1.5px] border-line px-3.5 text-[13px] font-bold text-ink-deep">
                {e.name}
              </button>
            ))}
          </div>
        </details>
      )}
    </>
  )

  if (selected === null) {
    return (
      <PlanEditLayout title="Exercises" tint={look.tint} guide={look.guide} readOnly dirty={false} saving={false} error={null} saveLabel="" onSave={() => {}} notify onNotifyChange={() => {}}>
        {tabs}
        <EmptyNote>No {EXERCISE_TYPE_LABEL[type].toLowerCase()} exercises in the plan.</EmptyNote>
        {list}
      </PlanEditLayout>
    )
  }

  const ex = selected === 'new' ? null : selected
  return (
    <ExerciseEditor
      key={ex ? `${ex.id}:${JSON.stringify(ex)}` : `new:${type}`}
      exercise={ex}
      type={type}
      householdId={household.id}
      readOnly={readOnly}
      tabs={tabs}
      list={list}
      onSaved={(id) => {
        go({ id })
        q.reload()
      }}
    />
  )
}

function ExerciseEditor({
  exercise,
  type,
  householdId,
  readOnly,
  tabs,
  list,
  onSaved,
}: {
  exercise: Exercise | null
  type: ExerciseType
  householdId: string
  readOnly: boolean
  tabs: React.ReactNode
  list: React.ReactNode
  onSaved: (id: string) => void
}) {
  const look = LOOK[type]
  const before: ExerciseState | null = exercise
    ? { name: exercise.name, perDay: exercise.per_day, timingNote: exercise.timing_note ?? '', active: exercise.active, steps: exercise.steps }
    : null
  const [draft, setDraft] = useState<ExerciseState>(before ?? { name: '', perDay: 1, timingNote: '', active: true, steps: [''] })
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<ExerciseState>) => setDraft((d) => ({ ...d, ...patch }))
  const setStep = (i: number, text: string) => set({ steps: draft.steps.map((s, j) => (j === i ? text : s)) })
  const moveStep = (i: number, by: -1 | 1) => {
    const steps = [...draft.steps]
    ;[steps[i], steps[i + by]] = [steps[i + by], steps[i]]
    set({ steps })
  }

  const after = { ...draft, name: draft.name.trim() }
  const summary = summariseExerciseChange(before, after)
  const problems = [!after.name ? 'Give the exercise a name.' : null].filter((p): p is string => p !== null)

  async function save() {
    if (problems.length) return setError(problems[0])
    setSaving(true)
    setError(null)
    try {
      const id = await saveExercise({
        householdId,
        exerciseId: exercise?.id ?? null,
        type,
        name: after.name,
        perDay: after.perDay,
        timingNote: after.timingNote,
        active: after.active,
        steps: after.steps,
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
  const steps = readOnly ? draft.steps.filter((s) => s.trim()) : draft.steps

  return (
    <PlanEditLayout
      title="Exercises"
      subtitle={readOnly ? 'From the therapist’s sheet' : 'Copy them from the therapist’s sheet'}
      tint={look.tint}
      guide={look.guide}
      readOnly={readOnly}
      dirty={summary !== ''}
      saving={saving}
      error={error ?? (summary ? (problems[0] ?? null) : null)}
      saveLabel={exercise ? 'Save exercise' : 'Add exercise'}
      canSave={problems.length === 0}
      onSave={save}
      notify={notify}
      onNotifyChange={setNotify}
      status={summary && !problems.length ? <>Change: {summary}</> : undefined}
    >
      {tabs}
      <Card className="flex flex-col gap-3.5 px-4 py-3.5">
        {!draft.active && <p className="m-0 rounded-xl bg-tabs px-3 py-2 text-[13px] font-bold">This exercise is retired.</p>}
        <label className="flex flex-col gap-1">
          <span className={label}>Exercise</span>
          {readOnly ? (
            <span className="text-[15px] font-bold">{draft.name}</span>
          ) : (
            <input value={draft.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="Name from the therapist's sheet" className={fieldClass} />
          )}
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={label}>How to do it</span>
          {steps.length === 0 && <span className="text-[13px] text-ink-muted">No steps written down.</span>}
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${look.badge}`}>{i + 1}</span>
              {readOnly ? (
                <span className="text-sm">{s}</span>
              ) : (
                <>
                  <input aria-label={`Step ${i + 1}`} value={s} maxLength={500} onChange={(e) => setStep(i, e.target.value)} className={`${fieldClass} h-10 text-sm`} />
                  <button type="button" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => moveStep(i, -1)} className="flex h-10 w-8 shrink-0 items-center justify-center text-ink-soft disabled:opacity-30">
                    <UpIcon size={18} />
                  </button>
                  <button type="button" aria-label={`Move step ${i + 1} down`} disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} className="flex h-10 w-8 shrink-0 items-center justify-center text-ink-soft disabled:opacity-30">
                    <DownIcon size={18} />
                  </button>
                  <button type="button" aria-label={`Delete step ${i + 1}`} onClick={() => set({ steps: draft.steps.filter((_, j) => j !== i) })} className="flex h-10 w-8 shrink-0 items-center justify-center text-alert">
                    <CloseIcon size={18} />
                  </button>
                </>
              )}
            </div>
          ))}
          {!readOnly && (
            <button type="button" onClick={() => set({ steps: [...draft.steps, ''] })} className="min-h-11 self-start text-[13px] font-extrabold text-primary">
              + Add a step
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={label}>How often</span>
          {readOnly ? (
            <span className="font-display text-lg font-extrabold">{howOften(draft.perDay)}</span>
          ) : (
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Fewer times a day" disabled={draft.perDay <= 1} onClick={() => set({ perDay: draft.perDay - 1 })} className="h-10 w-10 rounded-full bg-line-soft text-xl font-extrabold disabled:opacity-40">
                −
              </button>
              <span className="min-w-[110px] text-center font-display text-lg font-extrabold">{howOften(draft.perDay)}</span>
              <button type="button" aria-label="More times a day" disabled={draft.perDay >= 24} onClick={() => set({ perDay: draft.perDay + 1 })} className="h-10 w-10 rounded-full bg-line-soft text-xl font-extrabold disabled:opacity-40">
                +
              </button>
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className={label}>When</span>
          {readOnly ? (
            <span className="text-[15px]">{draft.timingNote || '—'}</span>
          ) : (
            <input value={draft.timingNote} maxLength={200} onChange={(e) => set({ timingNote: e.target.value })} placeholder="Optional, e.g. during each tube feed" className={fieldClass} />
          )}
        </label>

        {!readOnly && exercise && (
          <button type="button" onClick={() => set({ active: !draft.active })} className={`min-h-11 self-start text-[13px] font-extrabold ${draft.active ? 'text-alert' : 'text-primary'}`}>
            {draft.active ? 'Retire this exercise' : 'Bring this exercise back'}
          </button>
        )}
      </Card>
      {list}
    </PlanEditLayout>
  )
}
