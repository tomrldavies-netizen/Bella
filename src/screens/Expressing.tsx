import { useCallback, useState } from 'react'
import { Elephant } from '../animals'
import { AmountStepper } from '../components/AmountStepper'
import { BottomSheet, Toast } from '../components/BottomSheet'
import { Card, EmptyNote } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { fieldClass } from '../components/PlanEditLayout'
import { ScreenHeader } from '../components/ScreenHeader'
import { Segmented } from '../components/Segmented'
import { useReadyHousehold } from '../household/HouseholdContext'
import { useLiveQuery } from '../lib/useLiveQuery'
import { useNow } from '../lib/useNow'
import { currentTime, formatNumber, friendlyDateTime, ukNow, ukToIso } from '../lib/ukTime'
import { addExpressing, deleteExpressing, loadExpressing, updateExpressing } from '../organise/api'
import { freezerStock } from '../organise/expressing'
import type { ExpressingSession } from '../organise/types'

type Storage = 'fridge' | 'freezer' | 'used'
const STORAGE_LABEL: Record<Storage, string> = { fridge: 'Fridge', freezer: 'Freezer', used: 'Used now' }
const label = 'text-[13px] font-extrabold'

export function Expressing() {
  const { household, members } = useReadyHousehold()
  const now = useNow()
  const q = useLiveQuery(household.id, ['expressing_sessions'], loadExpressing)
  const [time, setTime] = useState(() => ukNow(currentTime()).time)
  const [duration, setDuration] = useState(15)
  const [left, setLeft] = useState(0)
  const [right, setRight] = useState(0)
  const [storage, setStorage] = useState<Storage>('fridge')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<ExpressingSession | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [setToast])

  const sessions = q.data ?? []
  const stock = freezerStock(sessions)
  const loggedAt = ukToIso(ukNow(now).date, time)
  const future = Date.parse(loggedAt) > now.getTime() + 5 * 60_000
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? ''
  const recent = sessions.filter((s) => Date.parse(s.logged_at) > now.getTime() - 7 * 86_400_000)
  const inFreezer = sessions.filter((s) => s.storage === 'freezer' && !s.used_at)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await addExpressing(household.id, { logged_at: loggedAt, duration_min: duration, left_ml: left, right_ml: right, storage })
      setToast(`Saved · ${formatNumber(left + right)} ml`)
      setLeft(0)
      setRight(0)
      setTime(ukNow(currentTime()).time)
      q.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const row = (s: ExpressingSession) => (
    <button key={s.id} type="button" onClick={() => setOpen(s)} className="flex min-h-12 items-center gap-2.5 border-b border-line-soft py-1.5 text-left last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-bold">
          {formatNumber(Number(s.left_ml) + Number(s.right_ml))} ml · L {formatNumber(Number(s.left_ml))} / R {formatNumber(Number(s.right_ml))}
          {s.duration_min ? ` · ${s.duration_min} min` : ''}
        </span>
        <span className="text-xs text-ink-muted">
          {friendlyDateTime(s.logged_at, now)} · {nameOf(s.logged_by)}
        </span>
      </span>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${s.storage === 'freezer' && !s.used_at ? 'bg-feeds' : 'bg-tabs text-ink-muted'}`}>
        {s.storage === 'freezer' && s.used_at ? 'Frozen, used' : s.storage ? STORAGE_LABEL[s.storage] : '—'}
      </span>
    </button>
  )

  return (
    <>
      <ScreenHeader title="Expressing" subtitle={`Freezer stock ${formatNumber(stock)} ml`} tint="bg-feeds" guide={<Elephant size={56} cheeks />} back={{ to: '/feeds', label: 'Feeds' }} />
      <div className="flex flex-col gap-3 px-4 pt-3.5 pb-4 md:max-w-3xl md:px-7">
        {q.error && <ErrorNote>{q.error}</ErrorNote>}
        <Card className="flex flex-col gap-3.5 px-4 py-3.5">
          <h2 className="m-0 text-xl font-bold">Pump session</h2>
          <label className="flex items-center justify-between gap-2">
            <span className={label}>Time</span>
            <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className={`${fieldClass} !w-32`} />
          </label>
          <div className="flex items-center justify-between gap-2">
            <span className={label}>How long</span>
            <AmountStepper label="How long" value={duration} onChange={setDuration} step={5} fineStep={1} max={120} unit="min" size="sm" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={label}>Left</span>
            <AmountStepper label="Left side" value={left} onChange={setLeft} step={5} fineStep={1} max={500} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={label}>Right</span>
            <AmountStepper label="Right side" value={right} onChange={setRight} step={5} fineStep={1} max={500} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={label}>Stored</span>
            <Segmented<Storage>
              label="Stored"
              value={storage}
              onChange={setStorage}
              accent="border-feeds-accent"
              options={(['fridge', 'freezer', 'used'] as const).map((v) => ({ value: v, label: STORAGE_LABEL[v] }))}
            />
          </div>
          {future && <ErrorNote>That time is in the future.</ErrorNote>}
          {error && <ErrorNote>{error}</ErrorNote>}
          <button type="button" disabled={busy || future || left + right <= 0} onClick={save} className="h-[52px] rounded-2xl bg-primary font-display text-lg font-extrabold text-white disabled:opacity-50">
            {busy ? 'Saving…' : `Save ${formatNumber(left + right)} ml`}
          </button>
        </Card>

        {inFreezer.length > 0 && (
          <section aria-labelledby="freezer" className="flex flex-col gap-2">
            <h2 id="freezer" className="m-0 text-xl font-bold">
              In the freezer · {formatNumber(stock)} ml
            </h2>
            <Card className="flex flex-col px-3.5 py-1">
              {inFreezer.map((s) => (
                <div key={s.id} className="flex min-h-12 items-center gap-2.5 border-b border-line-soft py-1.5 last:border-b-0">
                  <span className="flex-1 text-sm">
                    <strong>{formatNumber(Number(s.left_ml) + Number(s.right_ml))} ml</strong> · {friendlyDateTime(s.logged_at, now)}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateExpressing(s.id, { used_at: currentTime().toISOString() })
                      q.reload()
                      setToast('Marked used')
                    }}
                    className="h-10 rounded-full border-[1.5px] border-feeds-accent bg-feeds px-3.5 text-sm font-extrabold"
                  >
                    Used
                  </button>
                </div>
              ))}
            </Card>
          </section>
        )}

        <section aria-labelledby="recent-sessions" className="flex flex-col gap-2">
          <h2 id="recent-sessions" className="m-0 text-xl font-bold">
            Last 7 days
          </h2>
          <Card className="flex flex-col px-3.5 py-1">
            {recent.length === 0 ? (
              <div className="py-2.5">
                <EmptyNote>{q.data ? 'No sessions logged in the last week.' : 'Loading…'}</EmptyNote>
              </div>
            ) : (
              recent.map(row)
            )}
          </Card>
        </section>
      </div>

      {open && (
        <BottomSheet title="Pump session" onClose={() => setOpen(null)}>
          <p className="m-0 text-sm">
            {formatNumber(Number(open.left_ml) + Number(open.right_ml))} ml · {friendlyDateTime(open.logged_at, now)} · {open.storage ? STORAGE_LABEL[open.storage] : ''}
          </p>
          {open.storage === 'freezer' && open.used_at && (
            <button
              type="button"
              onClick={async () => {
                await updateExpressing(open.id, { used_at: null })
                setOpen(null)
                q.reload()
              }}
              className="h-11 rounded-full border-[1.5px] border-line bg-card text-sm font-extrabold"
            >
              Put back in freezer stock
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              await deleteExpressing(open.id)
              setOpen(null)
              q.reload()
              setToast('Session deleted')
            }}
            className="h-11 rounded-full bg-alert text-sm font-extrabold text-white"
          >
            Delete this session
          </button>
        </BottomSheet>
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}
