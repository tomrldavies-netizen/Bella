import { useState } from 'react'
import { Elephant } from '../../animals'
import { AmountStepper } from '../../components/AmountStepper'
import { Card, EmptyNote } from '../../components/Card'
import { CloseIcon, CycleIcon } from '../../components/Icons'
import { PlanEditLayout, fieldClass } from '../../components/PlanEditLayout'
import { ScreenHeader } from '../../components/ScreenHeader'
import { Segmented } from '../../components/Segmented'
import { useReadyHousehold } from '../../household/HouseholdContext'
import { useLiveQuery } from '../../lib/useLiveQuery'
import { useNow } from '../../lib/useNow'
import { addDaysIso, currentTime, friendlyDateTime, formatNumber, ukNow, ukToIso } from '../../lib/ukTime'
import { loadFeedPlans, saveFeedPlan, type FeedPlanVersion } from '../../plan/api'
import {
  MILK_LABEL,
  cycleMilk,
  describePlan,
  evenInterval,
  fillEvery,
  nextSlot,
  planTotals,
  sortSlots,
  summariseFeedChange,
  type FeedSlot,
  type MilkType,
} from '../../plan/feedPlan'

const FEED_STEP = 5
const FEED_FINE_STEP = 1

const MILK_STYLE: Record<MilkType, string> = {
  breast: 'bg-feeds border-feeds-accent',
  formula: 'bg-growth border-growth-accent',
  mix: 'bg-nappies border-nappies-accent',
}

function Loading() {
  return (
    <>
      <ScreenHeader title="Feed plan" tint="bg-feeds" guide={<Elephant size={56} cheeks />} back={{ to: '/bellas-plan', label: "Bella's plan" }} />
      <div className="px-4 pt-3 md:px-7">
        <EmptyNote>Loading…</EmptyNote>
      </div>
    </>
  )
}

export function EditFeedPlan() {
  const { household, me } = useReadyHousehold()
  const q = useLiveQuery(household.id, ['feed_plans', 'feed_plan_slots'], loadFeedPlans)
  if (q.error) return <p className="p-4 text-alert">{q.error}</p>
  if (!q.data) return <Loading />
  // Remount the editor whenever a new version arrives (ours or another parent's).
  return (
    <FeedPlanEditor
      key={q.data[0]?.id ?? 'none'}
      versions={q.data}
      householdId={household.id}
      readOnly={me.role !== 'parent'}
      onSaved={q.reload}
    />
  )
}

function FillHelper({ onFill }: { onFill: (slots: FeedSlot[]) => void }) {
  const [hours, setHours] = useState(3)
  const [first, setFirst] = useState('00:00')
  const [ml, setMl] = useState(0)
  const [milk, setMilk] = useState<MilkType>('breast')
  const preview = fillEvery(hours, first, ml, milk)
  return (
    <Card className="flex flex-col gap-3 px-4 py-3.5">
      <h2 className="m-0 text-lg font-bold">Fill in feeds every few hours</h2>
      <p className="m-0 text-[13px] text-ink-muted">Enter what the team has agreed. You can change any feed afterwards.</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-extrabold">Every</span>
        <AmountStepper label="Hours between feeds" value={hours} onChange={setHours} step={0.5} min={1} max={12} unit="hrs" size="sm" />
      </div>
      <label className="flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold">First feed</span>
        <input type="time" value={first} onChange={(e) => e.target.value && setFirst(e.target.value)} className={`${fieldClass} !w-32`} />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-extrabold">Each feed</span>
        <AmountStepper label="Amount for each feed" value={ml} onChange={setMl} step={FEED_STEP} fineStep={FEED_FINE_STEP} max={500} size="sm" />
      </div>
      <Segmented
        label="Milk"
        value={milk}
        onChange={setMilk}
        options={[
          { value: 'breast', label: 'Breast milk' },
          { value: 'formula', label: 'Formula' },
          { value: 'mix', label: 'Mix' },
        ]}
      />
      <button
        type="button"
        disabled={ml <= 0}
        onClick={() => onFill(preview)}
        className="h-11 rounded-full border-[1.5px] border-primary bg-card text-sm font-extrabold text-primary disabled:opacity-50"
      >
        {ml > 0 ? `Fill in ${preview.length} feeds (${preview[0].time} to ${preview[preview.length - 1].time})` : 'Set an amount first'}
      </button>
    </Card>
  )
}

function FeedPlanEditor({
  versions,
  householdId,
  readOnly,
  onSaved,
}: {
  versions: FeedPlanVersion[]
  householdId: string
  readOnly: boolean
  onSaved: () => void
}) {
  const now = useNow()
  const latest = versions[0] ?? null
  const inForce = versions.find((v) => Date.parse(v.effective_from) <= now.getTime()) ?? null
  const upcoming = latest && Date.parse(latest.effective_from) > now.getTime() ? latest : null
  const base = latest?.slots ?? []

  const [slots, setSlots] = useState<FeedSlot[]>(base)
  const [editingTimes, setEditingTimes] = useState(false)
  const [showFill, setShowFill] = useState(base.length === 0)
  const [newTime, setNewTime] = useState('')
  const [startMode, setStartMode] = useState<'next' | 'custom'>('next')
  const today = ukNow(now)
  const [customDate, setCustomDate] = useState(today.date)
  const [customTime, setCustomTime] = useState(today.time)
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sorted = sortSlots(slots)
  const summary = summariseFeedChange(base.length ? base : null, sorted)
  const totals = planTotals(sorted)
  const interval = evenInterval(sorted)

  // "Starts from": the next feed of the plan in force, or now if there's no plan yet.
  const next = inForce ? nextSlot(inForce.slots, today.time) : null
  const nextIso = next ? ukToIso(next.tomorrow ? addDaysIso(today.date, 1) : today.date, next.time) : null
  const resolveFrom = (at: Date) => (startMode === 'custom' ? ukToIso(customDate, customTime) : (nextIso ?? at.toISOString()))
  const effectiveFrom = resolveFrom(now)
  const startLabel = startMode === 'custom' ? friendlyDateTime(effectiveFrom) : next ? `the next feed (${next.time})` : 'now'

  const dupes = sorted.filter((s, i) => i > 0 && s.time === sorted[i - 1].time).map((s) => s.time)
  const problems = [
    dupes.length ? `Two feeds are set for ${dupes[0]}. Move or remove one.` : null,
    sorted.some((s) => s.ml <= 0) ? 'Every feed needs an amount.' : null,
    startMode === 'custom' && Date.parse(effectiveFrom) < now.getTime() - 60_000 ? 'Choose a start time from now on.' : null,
  ].filter((p): p is string => p !== null)

  const update = (i: number, patch: Partial<FeedSlot>) => setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  // Edit in sorted order so rows don't jump while you tap.
  const indexed = slots.map((s, i) => ({ s, i })).sort((a, b) => a.s.time.localeCompare(b.s.time))

  function addFeed() {
    if (!newTime) return
    const last = sorted[sorted.length - 1]
    setSlots((all) => [...all, { time: newTime, milk: last?.milk ?? 'breast', ml: last?.ml ?? 0 }])
    setNewTime('')
  }

  async function save() {
    if (problems.length) return setError(problems[0])
    setSaving(true)
    setError(null)
    try {
      await saveFeedPlan({ householdId, effectiveFrom: resolveFrom(currentTime()), slots: sorted, note, summary, before: base.length ? base : null, notify })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  const subtitle = readOnly
    ? inForce
      ? `In use since ${friendlyDateTime(inForce.effective_from)}`
      : 'No feed plan yet'
    : `Starts from ${startLabel}`

  return (
    <PlanEditLayout
      title="Feed plan"
      subtitle={subtitle}
      tint="bg-feeds"
      guide={<Elephant size={56} cheeks />}
      readOnly={readOnly}
      dirty={summary !== ''}
      saving={saving}
      error={error ?? (summary ? (problems[0] ?? null) : null)}
      saveLabel="Save feed plan"
      canSave={problems.length === 0}
      onSave={save}
      notify={notify}
      onNotifyChange={setNotify}
      status={summary && !problems.length ? <>Change: {summary}</> : undefined}
    >
      {upcoming && (
        <p className="m-0 rounded-[14px] bg-banner px-3 py-2 text-[13px] font-bold">
          This plan starts {friendlyDateTime(upcoming.effective_from)}. Until then the earlier plan is used.
        </p>
      )}

      <div className="flex items-center justify-between gap-2 rounded-[14px] border-[1.5px] border-line bg-card px-3 py-2">
        <span className="text-[13px] font-bold text-ink-deep">Day total</span>
        <span className="font-display text-xl font-extrabold">{formatNumber(totals.totalMl)} ml</span>
        <span className="text-xs font-bold text-ink-deep">
          {totals.counts.breast} breast · {totals.counts.formula} formula · {totals.counts.mix} mix
        </span>
      </div>

      {!readOnly && sorted.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-extrabold">Set all to</span>
          <button type="button" onClick={() => setSlots((all) => all.map((s) => ({ ...s, milk: 'breast' })))} className={`h-10 rounded-full border-[1.5px] px-3 text-[13px] font-extrabold ${MILK_STYLE.breast}`}>
            Breast milk
          </button>
          <button type="button" onClick={() => setSlots((all) => all.map((s) => ({ ...s, milk: 'formula' })))} className={`h-10 rounded-full border-[1.5px] px-3 text-[13px] font-extrabold ${MILK_STYLE.formula}`}>
            Formula
          </button>
          {interval && <span className="ml-auto text-xs font-bold text-ink-deep">{interval}</span>}
        </div>
      )}

      {(sorted.length > 0 || readOnly) && (
        <Card className="flex flex-col px-3 py-0.5">
          {sorted.length === 0 && (
            <div className="py-3">
              <EmptyNote>No feed plan yet.</EmptyNote>
            </div>
          )}
          {indexed.map(({ s, i }) => (
            <div key={i} className="flex min-h-[52px] items-center gap-2.5 border-b border-line-soft py-1.5 last:border-b-0">
              {editingTimes ? (
                <>
                  <input
                    type="time"
                    aria-label={`Time of feed ${s.time}`}
                    value={s.time}
                    onChange={(e) => e.target.value && update(i, { time: e.target.value })}
                    className={`${fieldClass} !w-32`}
                  />
                  <span className="flex-1 truncate text-[13px] text-ink-muted">
                    {MILK_LABEL[s.milk]} · {formatNumber(s.ml)} ml
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${s.time} feed`}
                    onClick={() => setSlots((all) => all.filter((_, j) => j !== i))}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-alert"
                  >
                    <CloseIcon size={20} />
                  </button>
                </>
              ) : (
                <>
                  <span className="w-[46px] shrink-0 text-sm font-extrabold">{s.time}</span>
                  {readOnly ? (
                    <span className={`flex h-[38px] flex-1 items-center rounded-xl border-[1.5px] px-2.5 text-[13px] font-extrabold ${MILK_STYLE[s.milk]}`}>
                      {MILK_LABEL[s.milk]}
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`${s.time} milk: ${MILK_LABEL[s.milk]}. Tap to change`}
                      onClick={() => update(i, { milk: cycleMilk(s.milk) })}
                      className={`flex h-[38px] min-w-0 flex-1 items-center justify-between gap-1 rounded-xl border-[1.5px] px-2.5 text-[13px] font-extrabold ${MILK_STYLE[s.milk]}`}
                    >
                      <span className="truncate">{MILK_LABEL[s.milk]}</span>
                      <CycleIcon size={16} className="shrink-0 opacity-70" />
                    </button>
                  )}
                  <AmountStepper
                    label={`${s.time} feed amount`}
                    value={s.ml}
                    onChange={(ml) => update(i, { ml })}
                    step={FEED_STEP}
                    fineStep={FEED_FINE_STEP}
                    max={500}
                    size="sm"
                    readOnly={readOnly}
                  />
                </>
              )}
            </div>
          ))}
          {!readOnly && editingTimes && (
            <div className="flex items-center gap-2 py-2">
              <input type="time" aria-label="New feed time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className={`${fieldClass} !w-32`} />
              <button type="button" disabled={!newTime} onClick={addFeed} className="h-11 rounded-full bg-primary px-4 text-sm font-extrabold text-white disabled:opacity-50">
                Add feed
              </button>
            </div>
          )}
          {!readOnly && (
            <button type="button" onClick={() => setEditingTimes((e) => !e)} className="h-11 text-left text-[13px] font-extrabold text-primary">
              {editingTimes ? 'Done changing times' : '+ Add or move a feed time'}
            </button>
          )}
        </Card>
      )}

      {!readOnly &&
        (showFill ? (
          <FillHelper
            onFill={(filled) => {
              setSlots(filled)
              setShowFill(false)
            }}
          />
        ) : (
          <button type="button" onClick={() => setShowFill(true)} className="min-h-11 self-start text-[13px] font-extrabold text-primary">
            Start again with feeds every few hours
          </button>
        ))}

      {!readOnly && summary && (
        <Card className="flex flex-col gap-3 px-4 py-3.5">
          <span className="text-sm font-extrabold">New plan starts from</span>
          <Segmented
            label="New plan starts from"
            value={startMode}
            onChange={setStartMode}
            options={[
              { value: 'next', label: next ? `Next feed (${next.time})` : 'Now' },
              { value: 'custom', label: 'Choose a time' },
            ]}
          />
          {startMode === 'custom' && (
            <div className="flex gap-2">
              <input type="date" aria-label="Start date" min={today.date} value={customDate} onChange={(e) => setCustomDate(e.target.value)} className={fieldClass} />
              <input type="time" aria-label="Start time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className={`${fieldClass} !w-32`} />
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-extrabold">Note (optional)</span>
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. agreed with the dietitian" className={fieldClass} />
          </label>
        </Card>
      )}

      {versions.length > (upcoming ? 1 : 0) && (
        <details className="rounded-[18px] border-[1.5px] border-line bg-card px-4 py-2">
          <summary className="min-h-11 cursor-pointer content-center text-sm font-extrabold">Earlier plans</summary>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 pb-2">
            {versions.slice(upcoming ? 1 : 0).map((v) => (
              <li key={v.id} className="text-[13px]">
                <span className="font-bold">From {friendlyDateTime(v.effective_from)}</span>
                {v.id === inForce?.id && <span className="ml-1.5 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-bold text-primary">in use</span>}
                <br />
                <span className="text-ink-muted">
                  {describePlan(v.slots)}
                  {v.note ? ` · ${v.note}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </PlanEditLayout>
  )
}

