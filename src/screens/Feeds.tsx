import { useCallback, useState } from 'react'
import { Elephant } from '../animals'
import { addLog, updateLog } from '../care/api'
import { FeedForm } from '../care/FeedForm'
import { draftFromPlanned, feedRow, type FeedDraft } from '../care/feedDraft'
import { describePlanned, feedTotals, nearestPlannedFeed, nextPlannedFeed, plannedDayTotal, plannedFeedsAround } from '../care/feedLog'
import { BottomSheet, Toast } from '../components/BottomSheet'
import { Card, EmptyNote } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { fieldClass } from '../components/PlanEditLayout'
import { ScreenHeader } from '../components/ScreenHeader'
import { Segmented } from '../components/Segmented'
import { describeTube, tubeStatus } from '../care/tube'
import { formatElapsed, useFeedTimer } from '../care/useFeedTimer'
import { useToday } from '../care/useToday'
import { currentTime, formatNumber, ukNow, ukParts, ukToIso } from '../lib/ukTime'

const btn = 'h-11 rounded-full px-5 text-sm font-extrabold'

function TubeChangeSheet({ onSave, onClose }: { onSave: (nostril: 'left' | 'right', time: string) => Promise<void>; onClose: () => void }) {
  const [nostril, setNostril] = useState<'left' | 'right'>('left')
  const [time, setTime] = useState(() => ukNow(currentTime()).time)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <BottomSheet title="New NG tube" onClose={onClose}>
      <Segmented
        label="Nostril"
        value={nostril}
        onChange={setNostril}
        accent="border-feeds-accent"
        options={[
          { value: 'left', label: 'Left nostril' },
          { value: 'right', label: 'Right nostril' },
        ]}
      />
      <label className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold">Put in at</span>
        <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className={`${fieldClass} w-32`} />
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <button
        type="button"
        disabled={busy}
        className="h-12 rounded-full bg-primary font-extrabold text-white disabled:opacity-50"
        onClick={async () => {
          setBusy(true)
          try {
            await onSave(nostril, time)
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
            setBusy(false)
          }
        }}
      >
        Log tube change
      </button>
    </BottomSheet>
  )
}

export function Feeds() {
  const t = useToday()
  const timer = useFeedTimer()
  const plans = t.plans ?? []
  const planned = plannedFeedsAround(plans, t.now.toISOString())
  const next = nextPlannedFeed(plans, t.today, t.now)

  const [draft, setDraft] = useState<FeedDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tubeSheet, setTubeSheet] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [setToast])

  // Start from the planned feed nearest now (once the plan has loaded).
  const nowTime = ukNow(t.now).time
  const current: FeedDraft = draft ?? draftFromPlanned(t.plans ? nearestPlannedFeed(plans, t.now.toISOString()) : null, nowTime)

  function startTimer() {
    const at = currentTime()
    timer.start()
    setDraft({ ...draftFromPlanned(nearestPlannedFeed(plans, at.toISOString()), ukNow(at).time), ...(draft ? { method: draft.method } : {}) })
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const loggedAt = ukToIso(ukNow(currentTime()).date, current.time)
      await addLog('feeds', t.householdId, {
        ...feedRow(current, loggedAt),
        started_at: timer.startedAt,
        ended_at: timer.startedAt ? currentTime().toISOString() : null,
      })
      // Only stop the timer once the feed is safely saved.
      timer.clear()
      setDraft(null)
      setToast(`Feed saved · ${formatNumber(current.oral + current.tube)} ml`)
      t.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const totals = feedTotals(t.logs?.feeds ?? [])
  const target = plannedDayTotal(plans, t.today)
  const tube = tubeStatus(t.tube, t.routines?.tubeChangeDays ?? null, t.today)
  const future = Date.parse(ukToIso(t.today, current.time)) > t.now.getTime() + 5 * 60_000

  const recent = current.planned ?? nearestPlannedFeed(plans, t.now.toISOString())
  const subtitle = !t.plans
    ? 'Loading…'
    : plans.length === 0
      ? 'No feed plan yet'
      : [recent ? `${recent.time} plan: ${formatNumber(recent.ml)} ml ${recent.milk === 'breast' ? 'breast milk' : recent.milk}` : null, next ? `next ${next.time}` : null]
          .filter(Boolean)
          .join(' · ')

  return (
    <>
      <ScreenHeader title="Feeds" subtitle={subtitle} tint="bg-feeds" guide={<Elephant size={56} cheeks />} />
      <div className="flex flex-col gap-3 px-4 pt-3.5 md:max-w-3xl md:px-7">
        {t.error && <ErrorNote>Couldn't load feeds: {t.error}</ErrorNote>}

        <Card className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex flex-col">
            <span className="text-[13px] font-bold text-ink-deep">
              Feed timer{timer.startedAt ? ` · started ${ukParts(timer.startedAt).time}` : ''}
            </span>
            <span className="font-display text-[34px] leading-none font-extrabold tabular-nums" aria-live="off">
              {formatElapsed(timer.elapsed)}
            </span>
          </div>
          <div className="flex gap-2">
            {!timer.startedAt && (
              <button type="button" onClick={startTimer} className={`${btn} bg-primary text-white`}>
                Start
              </button>
            )}
            {timer.running && (
              <button type="button" onClick={timer.pause} className={`${btn} border-[1.5px] border-line bg-card`}>
                Pause
              </button>
            )}
            {timer.paused && (
              <button type="button" onClick={timer.resume} className={`${btn} border-[1.5px] border-line bg-card`}>
                Resume
              </button>
            )}
            {timer.startedAt && (
              <button type="button" onClick={timer.clear} className={`${btn} px-3 text-ink-muted`}>
                Reset
              </button>
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-3.5 px-4 py-3.5">
          <FeedForm draft={current} onChange={setDraft} plannedOptions={planned} />
          {future && <ErrorNote>That time is in the future.</ErrorNote>}
          {error && <ErrorNote>{error}</ErrorNote>}
          <button
            type="button"
            onClick={save}
            disabled={saving || future || current.oral + current.tube <= 0}
            className="h-[52px] rounded-2xl bg-primary font-display text-lg font-extrabold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Saving…' : timer.startedAt ? 'Finish and save feed' : 'Save feed'}
          </button>
        </Card>

        <Card className="flex flex-col gap-0.5 px-4 py-3">
          <span className="text-[13px] font-extrabold">So far today</span>
          <span className="text-sm">
            {totals.count} feed{totals.count === 1 ? '' : 's'} · {formatNumber(totals.total)}
            {target ? ` of ${formatNumber(target)}` : ''} ml · {totals.pctByMouth}% by mouth
          </span>
          {next && <span className="text-xs text-ink-muted">Next planned: {describePlanned(next)}</span>}
        </Card>

        <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[15px] font-extrabold">{tube ? `NG tube · ${tube.nostril} nostril` : 'NG tube'}</span>
            <span className={`text-[13px] ${tube?.due ? 'font-bold text-alert' : 'text-ink-muted'}`}>
              {tube ? `${describeTube(tube)}${tube.due ? ' · change due' : ''}` : 'No tube change logged yet'}
            </span>
          </div>
          <div className="flex gap-2">
            {t.tube && (
              <button
                type="button"
                className={`${btn} border-[1.5px] border-line bg-card px-4`}
                onClick={async () => {
                  await updateLog('tube_changes', t.tube!.id, { retaped_at: currentTime().toISOString() })
                  t.reload()
                  setToast('Retape logged')
                }}
              >
                Retaped
              </button>
            )}
            <button type="button" onClick={() => setTubeSheet(true)} className={`${btn} border-[1.5px] border-feeds-accent bg-feeds px-4`}>
              Log change
            </button>
          </div>
        </Card>
        {!t.ready && !t.error && <EmptyNote>Loading…</EmptyNote>}
      </div>

      {tubeSheet && (
        <TubeChangeSheet
          onClose={() => setTubeSheet(false)}
          onSave={async (nostril, time) => {
            const at = ukToIso(ukNow(currentTime()).date, time)
            await addLog('tube_changes', t.householdId, { nostril, inserted_at: at, logged_at: at })
            setTubeSheet(false)
            t.reload()
            setToast('Tube change logged')
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}
