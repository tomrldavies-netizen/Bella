import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zebra } from '../animals'
import { AmountStepper } from '../components/AmountStepper'
import { BottomSheet, Toast } from '../components/BottomSheet'
import { Card, EmptyNote } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { fieldClass } from '../components/PlanEditLayout'
import { ScreenHeader } from '../components/ScreenHeader'
import { Toggle } from '../components/Toggle'
import { useReadyHousehold } from '../household/HouseholdContext'
import { useLiveQuery } from '../lib/useLiveQuery'
import { useNow } from '../lib/useNow'
import { ukNow, ukParts, ukToIso } from '../lib/ukTime'
import {
  DEFAULT_SUPPLIES,
  addAppointment,
  addQuestion,
  addSupply,
  deleteAppointment,
  deleteQuestion,
  deleteSupply,
  loadAppointments,
  loadCareTaskLogs,
  loadQuestions,
  loadSupplies,
  setSupplyQuantity,
  tickCareTask,
  untickCareTask,
  updateAppointment,
  updateQuestion,
  updateSupply,
} from '../organise/api'
import { careTaskStatus, whenWords } from '../organise/careTasks'
import { supplyLow } from '../organise/supplies'
import type { Appointment, Question, Supply } from '../organise/types'
import { loadRoutines } from '../plan/api'
import { describeRecurrence } from '../plan/routines'

const label = 'text-[13px] font-extrabold'
const saveBtn = 'h-12 rounded-full bg-primary font-extrabold text-white disabled:opacity-50'
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

function dayBox(iso: string) {
  const d = new Date(iso)
  return {
    dow: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' }).toUpperCase(),
    day: d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'Europe/London' }),
    month: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'Europe/London' }),
  }
}

function useSheetAction(onDone: (msg: string) => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onDone(msg)
    } catch (e) {
      setError(errText(e))
      setBusy(false)
    }
  }
  return { busy, error, run }
}

function AppointmentSheet({ appt, householdId, readOnly, questions, onDone, onClose }: { appt: Appointment | null; householdId: string; readOnly: boolean; questions: Question[]; onDone: (m: string) => void; onClose: () => void }) {
  const start = appt ? ukParts(appt.starts_at) : { date: ukNow().date, time: '10:00' }
  const [date, setDate] = useState(start.date)
  const [time, setTime] = useState(start.time)
  const [who, setWho] = useState(appt?.with_whom ?? '')
  const [where, setWhere] = useState(appt?.location ?? '')
  const [notes, setNotes] = useState(appt?.notes ?? '')
  const [confirm, setConfirm] = useState(false)
  const { busy, error, run } = useSheetAction(onDone)
  const row = { starts_at: ukToIso(date, time), with_whom: who.trim() || null, location: where.trim() || null, notes: notes.trim() || null }
  const mine = appt ? questions.filter((q) => q.appointment_id === appt.id) : []

  if (readOnly && appt) {
    return (
      <BottomSheet title={appt.with_whom ?? 'Appointment'} onClose={onClose}>
        <p className="m-0 text-sm">
          {new Date(appt.starts_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' })} · {start.time}
          {appt.location ? ` · ${appt.location}` : ''}
        </p>
        {appt.notes && <p className="m-0 text-sm text-ink-muted">{appt.notes}</p>}
        {mine.length > 0 && (
          <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm">
            {mine.map((q) => (
              <li key={q.id}>{q.text}</li>
            ))}
          </ul>
        )}
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title={appt ? 'Edit appointment' : 'Add appointment'} onClose={onClose}>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className={label}>Date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={fieldClass} />
        </label>
        <label className="flex w-32 flex-col gap-1">
          <span className={label}>Time</span>
          <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} className={fieldClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={label}>Who</span>
        <input value={who} maxLength={120} onChange={(e) => setWho(e.target.value)} placeholder="e.g. Community neonatal nurse" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>Where</span>
        <input value={where} maxLength={120} onChange={(e) => setWhere(e.target.value)} placeholder="e.g. home visit" className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={label}>Notes</span>
        <input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={fieldClass} />
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <button type="button" disabled={busy || !who.trim()} className={saveBtn} onClick={() => run(() => (appt ? updateAppointment(appt.id, row) : addAppointment(householdId, row)), appt ? 'Appointment saved' : 'Appointment added')}>
        {appt ? 'Save appointment' : 'Add appointment'}
      </button>
      {appt &&
        (confirm ? (
          <button type="button" disabled={busy} onClick={() => run(() => deleteAppointment(appt.id), 'Appointment deleted')} className="h-11 rounded-full bg-alert text-sm font-extrabold text-white">
            Yes, delete it (questions are kept)
          </button>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="min-h-11 text-sm font-extrabold text-alert">
            Delete appointment
          </button>
        ))}
    </BottomSheet>
  )
}

function QuestionSheet({ q, appointments, onDone, onClose }: { q: Question; appointments: Appointment[]; onDone: (m: string) => void; onClose: () => void }) {
  const [text, setText] = useState(q.text)
  const [appt, setAppt] = useState(q.appointment_id ?? '')
  const [answered, setAnswered] = useState(q.answered)
  const [answer, setAnswer] = useState(q.answer ?? '')
  const [confirm, setConfirm] = useState(false)
  const { busy, error, run } = useSheetAction(onDone)
  return (
    <BottomSheet title="Question" onClose={onClose}>
      <textarea aria-label="Question" value={text} rows={2} maxLength={1000} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border-[1.5px] border-line bg-field p-3 text-[15px]" />
      <label className="flex flex-col gap-1">
        <span className={label}>For</span>
        <select value={appt} onChange={(e) => setAppt(e.target.value)} className={fieldClass}>
          <option value="">Any appointment</option>
          {appointments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.with_whom} · {ukParts(a.starts_at).date.split('-').reverse().slice(0, 2).join('/')}
            </option>
          ))}
        </select>
      </label>
      <Toggle on={answered} onChange={setAnswered} label="Answered" />
      {answered && (
        <label className="flex flex-col gap-1">
          <span className={label}>Answer</span>
          <textarea value={answer} rows={2} maxLength={2000} onChange={(e) => setAnswer(e.target.value)} placeholder="What the team said" className="w-full rounded-xl border-[1.5px] border-line bg-field p-3 text-[15px]" />
        </label>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <button
        type="button"
        disabled={busy || !text.trim()}
        className={saveBtn}
        onClick={() => run(() => updateQuestion(q.id, { text: text.trim(), appointment_id: appt || null, answered, answer: answered ? answer.trim() || null : null }), 'Question saved')}
      >
        Save
      </button>
      {confirm ? (
        <button type="button" disabled={busy} onClick={() => run(() => deleteQuestion(q.id), 'Question deleted')} className="h-11 rounded-full bg-alert text-sm font-extrabold text-white">
          Yes, delete it
        </button>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="min-h-11 text-sm font-extrabold text-alert">
          Delete question
        </button>
      )}
    </BottomSheet>
  )
}

function SupplySheet({ supply, householdId, onDone, onClose }: { supply: Supply | null; householdId: string; onDone: (m: string) => void; onClose: () => void }) {
  const [name, setName] = useState(supply?.name ?? '')
  const [low, setLow] = useState(supply?.low_threshold ?? 0)
  const [qty, setQty] = useState(supply?.quantity ?? 0)
  const [order, setOrder] = useState(supply?.to_order ?? false)
  const [confirm, setConfirm] = useState(false)
  const { busy, error, run } = useSheetAction(onDone)
  return (
    <BottomSheet title={supply ? supply.name : 'Add a supply'} onClose={onClose}>
      <label className="flex flex-col gap-1">
        <span className={label}>Item</span>
        <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Syringes" className={fieldClass} />
      </label>
      {!supply && (
        <div className="flex items-center justify-between gap-2">
          <span className={label}>How many now</span>
          <AmountStepper label="How many now" value={qty} onChange={setQty} step={1} max={9999} unit="" size="sm" />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-col">
          <span className={label}>Running low at</span>
          <span className="text-xs text-ink-muted">Shown in "Running low" at or below this</span>
        </span>
        <AmountStepper label="Running low at" value={low} onChange={setLow} step={1} max={999} unit="" size="sm" />
      </div>
      <Toggle on={order} onChange={setOrder} label="Needs ordering" />
      {error && <ErrorNote>{error}</ErrorNote>}
      <button
        type="button"
        disabled={busy || !name.trim()}
        className={saveBtn}
        onClick={() =>
          run(
            () =>
              supply
                ? updateSupply(supply.id, { name: name.trim(), low_threshold: low, to_order: order })
                : addSupply(householdId, { name: name.trim(), quantity: qty, low_threshold: low, to_order: order }),
            supply ? 'Saved' : 'Supply added',
          )
        }
      >
        {supply ? 'Save' : 'Add'}
      </button>
      {supply &&
        (confirm ? (
          <button type="button" disabled={busy} onClick={() => run(() => deleteSupply(supply.id), 'Supply removed')} className="h-11 rounded-full bg-alert text-sm font-extrabold text-white">
            Yes, remove it
          </button>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="min-h-11 text-sm font-extrabold text-alert">
            Remove this item
          </button>
        ))}
    </BottomSheet>
  )
}

export function PlanScreen() {
  const { household, me } = useReadyHousehold()
  const hid = household.id
  const isParent = me.role === 'parent'
  const now = useNow()
  const today = ukNow(now).date
  const appts = useLiveQuery(hid, ['appointments'], loadAppointments)
  const questions = useLiveQuery(hid, ['questions'], loadQuestions)
  const supplies = useLiveQuery(hid, ['supplies'], loadSupplies)
  const routines = useLiveQuery(hid, ['care_tasks', 'settings'], loadRoutines)
  const taskLogs = useLiveQuery(hid, ['care_task_logs'], loadCareTaskLogs)
  const [sheet, setSheet] = useState<{ kind: 'appt'; a: Appointment | null } | { kind: 'q'; q: Question } | { kind: 'supply'; s: Supply | null } | null>(null)
  const [newQ, setNewQ] = useState('')
  const [newQFor, setNewQFor] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [setToast])
  const done = (msg: string) => {
    setSheet(null)
    setToast(msg)
    appts.reload()
    questions.reload()
    supplies.reload()
  }
  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    setError(null)
    try {
      await fn()
      if (msg) setToast(msg)
    } catch (e) {
      setError(errText(e))
    }
  }

  const allAppts = appts.data ?? []
  const startOfToday = Date.parse(ukToIso(today, '00:00'))
  const upcoming = allAppts.filter((a) => Date.parse(a.starts_at) >= startOfToday)
  const past = allAppts.filter((a) => Date.parse(a.starts_at) < startOfToday).reverse()
  const qs = questions.data ?? []
  const open = qs.filter((q) => !q.answered)
  const answered = qs.filter((q) => q.answered)
  const apptName = (id: string | null) => (id ? (allAppts.find((a) => a.id === id)?.with_whom ?? 'Appointment') : 'Any')
  const qCount = (id: string) => open.filter((q) => q.appointment_id === id).length
  const firstError = appts.error ?? questions.error ?? supplies.error ?? routines.error ?? taskLogs.error ?? error

  const apptCard = (a: Appointment) => {
    const b = dayBox(a.starts_at)
    const n = qCount(a.id)
    return (
      <button key={a.id} type="button" onClick={() => setSheet({ kind: 'appt', a })} className="flex min-h-[60px] items-center gap-3 border-b border-line-soft py-2 text-left last:border-b-0">
        <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-plan py-1">
          <span className="text-[10px] font-extrabold text-ink-deep">{b.dow}</span>
          <span className="font-display text-xl leading-none font-extrabold">{b.day}</span>
          <span className="text-[10px] font-bold text-ink-deep">{b.month}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-extrabold">{a.with_whom}</span>
          <span className="text-xs text-ink-muted">
            {ukParts(a.starts_at).time}
            {a.location ? ` · ${a.location}` : ''}
          </span>
        </span>
        {n > 0 && <span className="rounded-full bg-plan px-2 py-0.5 text-xs font-extrabold">{n} Q{n === 1 ? '' : 's'}</span>}
      </button>
    )
  }

  return (
    <>
      <ScreenHeader title="Plan" subtitle="Appointments, questions & supplies" tint="bg-plan" guide={<Zebra size={56} />} back={{ to: '/', label: 'Today' }} backPhoneOnly />
      <div className="flex flex-col gap-3 px-4 pt-3.5 pb-4 md:max-w-3xl md:px-7">
        {firstError && <ErrorNote>{firstError}</ErrorNote>}

        <section aria-labelledby="appts" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 id="appts" className="m-0 text-xl font-bold">
              Appointments
            </h2>
            {isParent && (
              <button type="button" onClick={() => setSheet({ kind: 'appt', a: null })} className="min-h-11 px-2 text-[13px] font-extrabold text-primary">
                + Add
              </button>
            )}
          </div>
          <Card className="flex flex-col px-3.5 py-1">
            {upcoming.length === 0 && (
              <div className="py-2.5">
                <EmptyNote>{appts.data ? 'No appointments coming up.' : 'Loading…'}</EmptyNote>
              </div>
            )}
            {upcoming.map(apptCard)}
          </Card>
          {past.length > 0 && (
            <details className="rounded-[18px] border-[1.5px] border-line bg-card px-3.5 py-1">
              <summary className="min-h-11 cursor-pointer content-center text-sm font-extrabold">Past appointments ({past.length})</summary>
              <div className="flex flex-col">{past.slice(0, 20).map(apptCard)}</div>
            </details>
          )}
        </section>

        <section aria-labelledby="questions" className="flex flex-col gap-2">
          <h2 id="questions" className="m-0 text-xl font-bold">
            Questions for the team
          </h2>
          <Card className="flex flex-col px-3.5 py-1">
            {open.map((q) => (
              <div key={q.id} className="flex min-h-12 items-center gap-2.5 border-b border-line-soft py-1.5 last:border-b-0">
                <button
                  type="button"
                  aria-label={`Mark answered: ${q.text}`}
                  aria-pressed={false}
                  onClick={() => setSheet({ kind: 'q', q: { ...q, answered: true } })}
                  className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center"
                >
                  <span aria-hidden="true" className="h-7 w-7 rounded-full border-2 border-plan-accent bg-card" />
                </button>
                <button type="button" onClick={() => setSheet({ kind: 'q', q })} className="min-h-11 min-w-0 flex-1 text-left text-sm">
                  {q.text}
                </button>
                <span className="max-w-[38%] shrink-0 truncate rounded-full bg-plan px-2 py-0.5 text-xs font-bold">{apptName(q.appointment_id)}</span>
              </div>
            ))}
            <div className="flex flex-col gap-2 py-2.5">
              <input aria-label="New question" value={newQ} maxLength={1000} onChange={(e) => setNewQ(e.target.value)} placeholder="Add a question…" className={fieldClass} />
              {newQ.trim() && (
                <div className="flex gap-2">
                  <select aria-label="For which appointment" value={newQFor} onChange={(e) => setNewQFor(e.target.value)} className={fieldClass}>
                    <option value="">Any appointment</option>
                    {upcoming.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.with_whom}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      act(async () => {
                        await addQuestion(hid, newQ.trim(), newQFor || null)
                        setNewQ('')
                        setNewQFor('')
                        questions.reload()
                      }, 'Question added')
                    }
                    className="h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-extrabold text-white"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          </Card>
          {answered.length > 0 && (
            <details className="rounded-[18px] border-[1.5px] border-line bg-card px-3.5 py-1">
              <summary className="min-h-11 cursor-pointer content-center text-sm font-extrabold">Answered ({answered.length})</summary>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 pb-2">
                {answered.map((q) => (
                  <li key={q.id}>
                    <button type="button" onClick={() => setSheet({ kind: 'q', q })} className="flex w-full flex-col text-left">
                      <span className="text-sm font-bold">{q.text}</span>
                      {q.answer && <span className="text-[13px] text-ink-muted">{q.answer}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section aria-labelledby="supplies" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 id="supplies" className="m-0 text-xl font-bold">
              Supplies
            </h2>
            {isParent && (
              <button type="button" onClick={() => setSheet({ kind: 'supply', s: null })} className="min-h-11 px-2 text-[13px] font-extrabold text-primary">
                + Add
              </button>
            )}
          </div>
          <Card className="flex flex-col px-3.5 py-1">
            {supplies.data?.length === 0 && (
              <div className="flex flex-col gap-2 py-2.5">
                <EmptyNote>No supplies listed yet.</EmptyNote>
                {isParent && (
                  <button
                    type="button"
                    onClick={() =>
                      act(async () => {
                        for (const name of DEFAULT_SUPPLIES) await addSupply(hid, { name, quantity: 0, low_threshold: 0, to_order: false })
                        supplies.reload()
                      }, 'Added the usual supplies. Set the counts.')
                    }
                    className="h-11 self-start rounded-full border-[1.5px] border-primary px-4 text-sm font-extrabold text-primary"
                  >
                    Add NG tubes, syringes, tube tape, fortifier
                  </button>
                )}
              </div>
            )}
            {(supplies.data ?? []).map((s) => {
              const low = supplyLow(s)
              return (
                <div key={s.id} className="flex min-h-[52px] items-center gap-2 border-b border-line-soft py-1.5 last:border-b-0">
                  <button type="button" disabled={!isParent} onClick={() => setSheet({ kind: 'supply', s })} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center text-left">
                    <span className="text-sm font-extrabold">{s.name}</span>
                    <span className={`text-xs ${low ? 'font-bold text-alert' : 'text-ink-muted'}`}>
                      {s.quantity} left{s.to_order ? ' · order' : low ? ' · running low' : ''}
                    </span>
                  </button>
                  <AmountStepper
                    label={`${s.name} count`}
                    value={s.quantity}
                    onChange={(n) => act(async () => {
                      await setSupplyQuantity(s.id, n)
                      supplies.reload()
                    })}
                    step={1}
                    max={9999}
                    unit=""
                    size="sm"
                  />
                </div>
              )
            })}
          </Card>
        </section>

        <section aria-labelledby="bath" className="flex flex-col gap-2">
          <h2 id="bath" className="m-0 text-xl font-bold">
            Bath &amp; skin care
          </h2>
          <Card className="flex flex-col px-3.5 py-1">
            {routines.data?.tasks.length === 0 && (
              <div className="py-2.5">
                <EmptyNote>
                  No care tasks yet.{' '}
                  {isParent && (
                    <Link to="/bellas-plan/routines" className="font-bold">
                      Add them in Bella's plan
                    </Link>
                  )}
                </EmptyNote>
              </div>
            )}
            {(routines.data?.tasks ?? []).map((t) => {
              const st = careTaskStatus(t, taskLogs.data ?? [], today)
              const todayLog = (taskLogs.data ?? []).find((l) => l.care_task_id === t.id && ukParts(l.logged_at).date === today)
              return (
                <div key={t.id} className="flex min-h-[52px] items-center gap-2.5 border-b border-line-soft py-1.5 last:border-b-0">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-extrabold">{t.name}</span>
                    <span className={`text-xs ${st.dueToday ? 'font-bold text-alert' : 'text-ink-muted'}`}>
                      {st.doneToday ? `Done today · next ${whenWords(st.next, today)}` : st.dueToday ? (st.overdueDays ? `Due ${st.overdueDays} day${st.overdueDays === 1 ? '' : 's'} ago` : 'Due today') : `Next ${whenWords(st.next, today)}`} · {describeRecurrence(t.recurrence).replace(/^E/, 'e')}
                    </span>
                  </span>
                  {st.doneToday && todayLog ? (
                    <button type="button" onClick={() => act(async () => (await untickCareTask(todayLog.id), taskLogs.reload()), 'Undone')} className="h-11 rounded-full bg-obs px-3.5 text-sm font-extrabold text-primary">
                      ✓ Done
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={`${t.name} done`}
                      onClick={() => act(async () => (await tickCareTask(hid, t.id!), taskLogs.reload()), `${t.name} done`)}
                      className="h-11 rounded-full border-[1.5px] border-obs-accent bg-card px-3.5 text-sm font-extrabold"
                    >
                      Done
                    </button>
                  )}
                </div>
              )
            })}
          </Card>
        </section>
      </div>

      {sheet?.kind === 'appt' && (
        <AppointmentSheet appt={sheet.a} householdId={hid} readOnly={!isParent} questions={qs} onDone={done} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === 'q' && <QuestionSheet q={sheet.q} appointments={allAppts} onDone={done} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'supply' && <SupplySheet supply={sheet.s} householdId={hid} onDone={done} onClose={() => setSheet(null)} />}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}
