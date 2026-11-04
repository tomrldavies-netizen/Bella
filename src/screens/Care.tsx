import { useCallback, useState } from 'react'
import { Hornbill, Meerkat, Monkey } from '../animals'
import { addLog } from '../care/api'
import { obsDueAt, tempRangeOf } from '../care/obs'
import { ObsForm } from '../care/ObsForm'
import { obsDraftFrom, obsRow, type ObsDraft } from '../care/obsDraft'
import { formatElapsed, useTimer } from '../care/useTimer'
import { useToday } from '../care/useToday'
import { AmountStepper } from '../components/AmountStepper'
import { BottomSheet, Toast } from '../components/BottomSheet'
import { Card, EmptyNote } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { ScreenHeader } from '../components/ScreenHeader'
import { ukParts } from '../lib/ukTime'
import type { Exercise } from '../plan/api'
import { EXERCISE_TYPE_LABEL, type ExerciseType } from '../plan/exercises'

const btn = 'h-11 rounded-full px-5 text-sm font-extrabold'

function Dots({ done, of, colour }: { done: number; of: number; colour: string }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: Math.max(of, done) }, (_, i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-full border-[1.5px]" style={{ borderColor: colour, background: i < done ? colour : 'transparent' }} />
      ))}
    </span>
  )
}

function ExerciseGroup({
  type,
  exercises,
  doneToday,
  onDone,
}: {
  type: ExerciseType
  exercises: Exercise[]
  doneToday: (id: string) => number
  onDone: (e: Exercise) => void
}) {
  const colour = type === 'physio' ? '#B5677D' : '#6FA89F'
  if (exercises.length === 0) return null
  return (
    <Card className="flex flex-col gap-2 px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        {type === 'physio' ? <Monkey size={34} bg="#F8E1E4" /> : <Hornbill size={34} bg="#DDF0EE" />}
        <span className="flex flex-col">
          <h2 className="m-0 text-xl leading-tight font-bold">{EXERCISE_TYPE_LABEL[type]}</h2>
          <span className="text-xs text-ink-muted">from the {type === 'physio' ? 'physio' : 'speech & language'} plan</span>
        </span>
      </div>
      {exercises.map((e) => {
        const done = doneToday(e.id)
        return (
          <div key={e.id} className="flex flex-col gap-1 border-t border-line-soft pt-2">
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm font-extrabold">{e.name}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <Dots done={done} of={e.per_day} colour={colour} />
                  {done} of {e.per_day} today{e.timing_note ? ` · ${e.timing_note}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onDone(e)}
                aria-label={`${e.name} done`}
                className={`${btn} shrink-0 border-[1.5px] px-4 ${type === 'physio' ? 'border-physio-accent bg-physio' : 'border-speech-accent bg-speech'}`}
              >
                Done
              </button>
            </div>
            {e.steps.length > 0 && (
              <details>
                <summary className="min-h-9 cursor-pointer content-center text-xs font-extrabold text-primary">How to do it</summary>
                <ol className="m-0 flex list-decimal flex-col gap-1 pb-1 pl-5 text-sm">
                  {e.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        )
      })}
    </Card>
  )
}

function AddMinutesSheet({ onSave, onClose }: { onSave: (min: number) => Promise<void>; onClose: () => void }) {
  const [min, setMin] = useState(5)
  const [busy, setBusy] = useState(false)
  return (
    <BottomSheet title="Add tummy time" onClose={onClose}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold">Minutes</span>
        <AmountStepper label="Minutes" value={min} onChange={setMin} step={1} min={1} max={240} unit="min" />
      </div>
      <button
        type="button"
        disabled={busy || min <= 0}
        onClick={async () => {
          setBusy(true)
          await onSave(min)
        }}
        className="h-12 rounded-full bg-primary font-extrabold text-white disabled:opacity-50"
      >
        Add {min} min
      </button>
    </BottomSheet>
  )
}

export function Care() {
  const t = useToday()
  const tummyTimer = useTimer('bella.tummyTimer')
  const range = tempRangeOf(t.routines)
  const [obs, setObs] = useState<ObsDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addMinutes, setAddMinutes] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [setToast])

  const draft = obs ?? obsDraftFrom(t.lastObs)
  const due = obsDueAt(t.lastObs, t.routines?.obsIntervalMin ?? null, t.now)
  const lastBy = t.lastObs ? t.members.find((m) => m.id === t.lastObs!.logged_by)?.display_name : null
  const subtitle = !t.ready
    ? 'Loading…'
    : [
        due ? (Date.parse(due) <= t.now.getTime() ? 'Obs due now' : `Obs due ${ukParts(due).time}`) : null,
        t.lastObs ? `last by ${lastBy ?? 'someone'} ${ukParts(t.lastObs.logged_at).time}` : 'no obs logged yet',
      ]
        .filter(Boolean)
        .join(' · ')
        .replace(/^./, (c) => c.toUpperCase())

  const active = (t.exercises ?? []).filter((e) => e.active)
  const doneToday = (id: string) => (t.logs?.exercises ?? []).filter((l) => l.exercise_id === id).length
  const tummyMin = (t.logs?.tummy ?? []).reduce((s, x) => s + x.duration_min, 0)
  const goal = t.routines?.tummyGoalMin ?? 0
  const timerMin = Math.floor(tummyTimer.elapsed / 60000)

  async function saveObs() {
    setSaving(true)
    setError(null)
    try {
      await addLog('obs', t.householdId, obsRow(draft))
      setObs(null)
      setToast('Obs saved')
      t.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function logTummy(minutes: number) {
    await addLog('tummy_time', t.householdId, { duration_min: minutes })
    t.reload()
    setToast(`Tummy time ${minutes} min logged`)
  }

  return (
    <>
      <ScreenHeader title="Care" subtitle={subtitle} tint="bg-obs" guide={<Meerkat size={56} />} />
      <div className="flex flex-col gap-3 px-4 pt-3.5 md:max-w-3xl md:px-7">
        {t.error && <ErrorNote>Couldn't load care: {t.error}</ErrorNote>}

        <Card className="flex flex-col gap-3.5 px-4 py-3.5">
          <h2 className="m-0 text-xl font-bold">Obs checklist</h2>
          <ObsForm draft={draft} onChange={setObs} range={range} />
          {error && <ErrorNote>{error}</ErrorNote>}
          <button
            type="button"
            onClick={saveObs}
            disabled={saving || !t.ready}
            className="h-[52px] rounded-2xl bg-primary font-display text-lg font-extrabold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save obs'}
          </button>
        </Card>

        {t.ready && active.length === 0 && (
          <Card className="px-4 py-3.5">
            <EmptyNote>No exercises in Bella's plan yet.</EmptyNote>
          </Card>
        )}
        {(['physio', 'speech_language'] as const).map((type) => (
          <ExerciseGroup
            key={type}
            type={type}
            exercises={active.filter((e) => e.type === type)}
            doneToday={doneToday}
            onDone={async (e) => {
              await addLog('exercise_logs', t.householdId, { exercise_id: e.id })
              t.reload()
              setToast(`${e.name} done`)
            }}
          />
        ))}

        <Card className="flex flex-col gap-2.5 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <Monkey size={34} bg="#F8E1E4" />
            <h2 className="m-0 flex-1 text-xl font-bold">Tummy time</h2>
            <span className="text-sm font-extrabold">
              {tummyMin}
              {goal ? ` / ${goal}` : ''} min
            </span>
          </div>
          {goal > 0 && (
            <div className="h-2 rounded-full bg-line" role="progressbar" aria-label="Tummy time today" aria-valuenow={tummyMin} aria-valuemax={goal}>
              <div className="h-2 rounded-full bg-physio-accent" style={{ width: `${Math.min(100, Math.round((tummyMin / goal) * 100))}%` }} />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-[28px] leading-none font-extrabold tabular-nums">{formatElapsed(tummyTimer.elapsed)}</span>
            <div className="flex flex-wrap gap-2">
              {!tummyTimer.startedAt && (
                <button type="button" onClick={tummyTimer.start} className={`${btn} bg-primary text-white`}>
                  Start
                </button>
              )}
              {tummyTimer.running && (
                <button type="button" onClick={tummyTimer.pause} className={`${btn} border-[1.5px] border-line bg-card`}>
                  Pause
                </button>
              )}
              {tummyTimer.paused && (
                <button type="button" onClick={tummyTimer.resume} className={`${btn} border-[1.5px] border-line bg-card`}>
                  Resume
                </button>
              )}
              {tummyTimer.startedAt && (
                <button
                  type="button"
                  disabled={timerMin < 1}
                  onClick={async () => {
                    await logTummy(timerMin)
                    tummyTimer.clear()
                  }}
                  className={`${btn} bg-primary text-white disabled:opacity-50`}
                >
                  Finish
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between gap-2">
            <button type="button" onClick={() => setAddMinutes(true)} className="min-h-11 text-[13px] font-extrabold text-primary">
              + Add minutes
            </button>
            {tummyTimer.startedAt && (
              <button type="button" onClick={tummyTimer.clear} className="min-h-11 text-[13px] font-extrabold text-ink-muted">
                Reset timer
              </button>
            )}
          </div>
        </Card>
      </div>

      {addMinutes && (
        <AddMinutesSheet
          onClose={() => setAddMinutes(false)}
          onSave={async (min) => {
            await logTummy(min)
            setAddMinutes(false)
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}
