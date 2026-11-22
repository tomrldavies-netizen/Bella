import { useCallback, useState } from 'react'
import { Meerkat } from '../animals'
import { Toast } from '../components/BottomSheet'
import { Card, EmptyNote } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { NamePill } from '../components/NamePill'
import { useLiveQuery } from '../lib/useLiveQuery'
import { addDaysIso, ukParts, ukToIso } from '../lib/ukTime'
import { addLog, deleteLog, loadSuctionsSince } from './api'
import { countdown } from './countdown'
import { EditEntrySheet, SuctionSheet } from './sheets/LogSheets'
import { SUCTION_AMOUNTS, SUCTION_SHADE, countSuctions, describeCounts, suctionDetail, suctionsByDay, timesWord } from './suction'
import type { SuctionAmount, SuctionLog, SuctionSite } from './types'
import { useToday } from './useToday'

const DAYS = 7
const capital = (s: string) => s.replace(/^./, (c) => c.toUpperCase())
const weekday = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
const dayLabel = (date: string, today: string) =>
  date === today
    ? 'Today'
    : date === addDaysIso(today, -1)
      ? 'Yesterday'
      : new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(',', '')

/** Stacked bars, one per day: a little / medium / a lot. */
function WeekChart({ days, today }: { days: ReturnType<typeof suctionsByDay>; today: string }) {
  const max = Math.max(1, ...days.map((d) => d.total))
  const summary = days.map((d) => `${dayLabel(d.date, today)} ${d.total}`).join(', ')
  return (
    <figure className="m-0 flex flex-col gap-2">
      <div role="img" aria-label={`Suctions per day, last ${DAYS} days: ${summary}`} className="flex h-32 items-end gap-1.5">
        {days.map((d) => (
          <div key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-extrabold tabular-nums">{d.total || ''}</span>
            <div className="flex w-full max-w-9 flex-col-reverse overflow-hidden rounded-md" style={{ height: `${(d.total / max) * 100}%` }}>
              {SUCTION_AMOUNTS.map((a) => (d[a.value] ? <div key={a.value} style={{ flexGrow: d[a.value], background: SUCTION_SHADE[a.value] }} /> : null))}
            </div>
            <span className={`text-[11px] ${d.date === today ? 'font-extrabold' : 'font-bold text-ink-muted'}`}>{d.date === today ? 'Today' : weekday(d.date)}</span>
          </div>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-3 text-xs font-bold" aria-hidden="true">
        {SUCTION_AMOUNTS.map((a) => (
          <span key={a.value} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SUCTION_SHADE[a.value] }} />
            {a.label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

export function SuctionCard() {
  const t = useToday()
  const since = ukToIso(addDaysIso(t.today, -(DAYS - 1)), '00:00')
  const week = useLiveQuery(t.householdId, ['suctions'], (h) => loadSuctionsSince(h, since), t.today, 'suctions-week')
  const [logging, setLogging] = useState(false)
  const [editing, setEditing] = useState<SuctionLog | null>(null)
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  // Today comes from the shared day logs, which include anything still waiting to sync on this phone.
  const todayRows = t.logs?.suctions ?? []
  const rows = [...(week.data ?? []).filter((r) => ukParts(r.logged_at).date !== t.today), ...todayRows]
  const days = suctionsByDay(rows, t.today, DAYS)
  const last = [...rows].sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0]
  const who = (id: string) => t.members.find((m) => m.id === id)
  const reload = () => {
    t.reload()
    week.reload()
  }

  async function log(amount: SuctionAmount, site: SuctionSite | null) {
    setLogging(false)
    try {
      const id = await addLog('suctions', t.householdId, { amount, site })
      reload()
      setToast({
        message: `Suction logged · ${suctionDetail({ amount, site })}`,
        undo: async () => {
          setToast(null)
          await deleteLog('suctions', id)
          reload()
        },
      })
    } catch (e) {
      setToast({ message: `Couldn't log the suction: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const history = [...days].reverse().filter((d) => d.total > 0)
  const weekCounts = countSuctions(days.flatMap((d) => d.rows))

  return (
    <>
      <Card className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Meerkat size={34} bg="#E3EFE4" />
          <span className="flex min-w-0 flex-1 flex-col">
            <h2 className="m-0 text-xl leading-tight font-bold">Suction</h2>
            <span className="text-xs text-ink-muted">
              {last ? `Last ${countdown(last.logged_at, t.now).replace(/^Now$/, 'just now')} · ${ukParts(last.logged_at).time}${who(last.logged_by) ? ` by ${who(last.logged_by)!.display_name}` : ''}` : `None logged in the last ${DAYS} days`}
            </span>
          </span>
          <span className="text-sm font-extrabold">{todayRows.length} today</span>
        </div>
        <button type="button" onClick={() => setLogging(true)} disabled={!t.ready} className="h-11 rounded-full bg-primary text-sm font-extrabold text-white disabled:opacity-50">
          Log suction
        </button>

        {week.error && <ErrorNote>Couldn't load the suction history: {week.error}</ErrorNote>}
        <WeekChart days={days} today={t.today} />
        <span className="text-xs text-ink-muted">
          {timesWord(weekCounts.total)} in the last {DAYS} days{weekCounts.total ? ` · ${describeCounts(weekCounts)}` : ''}
        </span>

        <details>
          <summary className="min-h-11 cursor-pointer content-center text-[13px] font-extrabold text-primary">History</summary>
          {history.length === 0 && <EmptyNote>Nothing logged in the last {DAYS} days.</EmptyNote>}
          <div className="flex flex-col gap-3 pt-1">
            {history.map((d) => (
              <section key={d.date} aria-label={`${dayLabel(d.date, t.today)}, ${timesWord(d.total)}`} className="flex flex-col">
                <h3 className="m-0 flex justify-between border-b border-line-soft pb-1 text-sm font-extrabold">
                  <span>{dayLabel(d.date, t.today)}</span>
                  <span className="text-ink-muted">{timesWord(d.total)}</span>
                </h3>
                <ul className="m-0 flex list-none flex-col p-0">
                  {d.rows.map((r) => {
                    const m = who(r.logged_by)
                    return (
                      <li key={r.id}>
                        <button type="button" onClick={() => setEditing(r)} className="flex min-h-11 w-full items-center gap-3 py-1.5 text-left">
                          <span className="w-12 shrink-0 text-sm font-extrabold tabular-nums">{ukParts(r.logged_at).time}</span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-sm font-bold">{capital(suctionDetail(r))}</span>
                            {r.note && <span className="truncate text-xs text-ink-muted">{r.note}</span>}
                          </span>
                          {m && <NamePill member={m} />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </details>
      </Card>

      {logging && <SuctionSheet onLog={log} onClose={() => setLogging(false)} />}
      {editing && (
        <EditEntrySheet
          entry={{ kind: 'suction', row: editing }}
          plans={t.plans ?? []}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
      {toast && <Toast message={toast.message} onUndo={toast.undo} onDone={clearToast} />}
    </>
  )
}
