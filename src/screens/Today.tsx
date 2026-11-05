import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Elephant, Hippo, LionCub, Meerkat, Monkey, SavannaScene } from '../animals'
import { addLog, deleteLog } from '../care/api'
import { countdown } from '../care/countdown'
import { describePlanned, feedTotals, nextPlannedFeed, plannedDayTotal } from '../care/feedLog'
import { doseStatus, dosesForDay, nextDose } from '../care/medSchedule'
import { EditEntrySheet, NappySheet, NoteSheet } from '../care/sheets/LogSheets'
import { buildTimeline, type TimelineItem } from '../care/timeline'
import { tubeStatus } from '../care/tube'
import { obsDueAt, tempRangeOf } from '../care/obs'
import { useToday } from '../care/useToday'
import { Toast } from '../components/BottomSheet'
import { PlanChangedBanner } from '../organise/PlanChangedBanner'
import { careTaskStatus } from '../organise/careTasks'
import { currentPrescription, prescriptionStatus } from '../organise/prescriptions'
import { supplyLow } from '../organise/supplies'
import { Zebra } from '../animals'
import { Card, EmptyNote } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { ClipboardIcon, PencilIcon } from '../components/Icons'
import { NamePill } from '../components/NamePill'
import { useReadyHousehold } from '../household/HouseholdContext'
import { actualAgeLabel, correctedAgeLabel, dueDateLabel, ukToday } from '../lib/age'
import { formatLongDate, greeting } from '../lib/dates'
import { formatNumber, ukParts } from '../lib/ukTime'
import { formatDose } from '../plan/medicines'

// The pill stays small; the tap area around it is 44 px tall.
const pillClass =
  "relative rounded-full bg-card px-2.5 py-[5px] text-xs font-bold text-ink no-underline before:absolute before:-inset-y-[9px] before:inset-x-0 before:content-[''] hover:text-ink"

/** Actual age, corrected age and due-date countdown; each opens Growth. */
function AgePills({ now }: { now: Date }) {
  const { baby } = useReadyHousehold()
  const today = ukToday(now)
  const due = dueDateLabel(baby.due_date, today)
  return (
    <div className="flex flex-wrap gap-1.5">
      <Link to="/growth" className={pillClass}>
        {actualAgeLabel(baby.birth_date, today)}
      </Link>
      <Link to="/growth" className={pillClass}>
        {correctedAgeLabel(baby.birth_date, baby.gestation_weeks, baby.gestation_days, today)}
      </Link>
      {due && (
        <Link to="/growth" className={pillClass}>
          {due}
        </Link>
      )}
    </div>
  )
}

function PlanButton() {
  const { me } = useReadyHousehold()
  return (
    <Link
      to="/bellas-plan"
      className="flex h-11 items-center gap-1.5 rounded-full bg-card pr-3.5 pl-2.5 text-[13px] font-extrabold text-ink no-underline hover:text-ink"
    >
      <ClipboardIcon size={20} />
      {me.role === 'helper' ? (
        <span className="flex flex-col leading-tight">
          See Bella's plan<span className="text-[11px] font-bold text-ink-muted">view only</span>
        </span>
      ) : (
        "Bella's plan"
      )}
    </Link>
  )
}

/** Phone header: savanna scene with Bella's name (Main.dc.html / HelperToday.dc.html). */
function PhoneHeader({ now }: { now: Date }) {
  const { baby, me } = useReadyHousehold()
  return (
    <header className="relative h-[180px] overflow-hidden md:hidden">
      <SavannaScene className="absolute inset-0" />
      <div className="absolute top-[max(20px,env(safe-area-inset-top))] right-4">
        <PlanButton />
      </div>
      <div className="absolute top-[max(26px,env(safe-area-inset-top))] left-5 flex max-w-[55%] flex-col gap-0.5">
        <p className="m-0 text-sm font-bold text-ink-soft">{me.role === 'helper' ? `Helping as ${me.display_name}` : formatLongDate(now)}</p>
        <h1 className="m-0 truncate text-[42px] leading-[1.05] font-extrabold">{baby.name}</h1>
        <div className="mt-1.5">
          <AgePills now={now} />
        </div>
      </div>
    </header>
  )
}

/** Tablet header: date and greeting (Tablet.dc.html). */
function TabletHeader({ now }: { now: Date }) {
  const { me } = useReadyHousehold()
  return (
    <header className="hidden items-start justify-between gap-4 md:flex">
      <div className="flex flex-col gap-1">
        <p className="m-0 text-sm font-bold text-ink-muted">
          {formatLongDate(now)}
          {me.role === 'helper' ? ` · helping as ${me.display_name}` : ''}
        </p>
        <h1 className="m-0 text-[34px] leading-[1.1] font-extrabold">{greeting(now)}</h1>
        <div className="[&_a]:border-[1.5px] [&_a]:border-line">
          <AgePills now={now} />
        </div>
      </div>
      <div className="rounded-full border-[1.5px] border-line">
        <PlanButton />
      </div>
    </header>
  )
}

function SectionTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 id={id} className="m-0 text-xl font-bold">
        {children}
      </h2>
      {aside}
    </div>
  )
}

type UpNextCard = { key: string; to: string; tint: string; icon: ReactNode; label: string; big: string; detail: string; alert?: boolean }

function UpNext({ cards, loading }: { cards: UpNextCard[]; loading: boolean }) {
  return (
    <section aria-labelledby="up-next" className="flex flex-col gap-2">
      <SectionTitle
        id="up-next"
        aside={
          <Link to="/summary" className="inline-flex min-h-11 items-center text-[13px] font-bold">
            Daily summary
          </Link>
        }
      >
        Up next
      </SectionTitle>
      {cards.length === 0 ? (
        <Card className="px-4 py-3.5">
          <EmptyNote>
            {loading ? 'Loading…' : "Nothing due yet. Once Bella's plan has feeds and medicines, the next ones show here with a countdown."}
          </EmptyNote>
        </Card>
      ) : (
        <div className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:px-0">
          {cards.map((c) => (
            <Link
              key={c.key}
              to={c.to}
              className={`${c.tint} flex min-w-[112px] flex-1 snap-start flex-col gap-1 rounded-[18px] p-3 text-ink no-underline hover:text-ink md:rounded-[20px] md:p-4`}
            >
              <span className="md:hidden">{c.icon}</span>
              <span className="truncate text-[13px] font-bold md:text-sm md:font-extrabold">{c.label}</span>
              <span className={`font-display text-xl leading-[1.1] font-extrabold md:text-[30px] ${c.alert ? 'text-alert' : ''}`}>{c.big}</span>
              <span className="text-xs text-ink-muted md:text-[13px] md:text-ink-deep">{c.detail}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

const tileClass =
  'flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-[1.5px] border-line bg-card text-[13px] font-bold text-ink no-underline hover:text-ink md:h-[76px] md:text-sm md:font-extrabold'

function QuickLog({ onNappy, onNote }: { onNappy: () => void; onNote: () => void }) {
  return (
    <section aria-labelledby="quick-log" className="flex flex-col gap-2">
      <SectionTitle id="quick-log">Quick log</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5 min-[1100px]:grid-cols-6">
        <Link to="/feeds" className={tileClass}>
          <Elephant size={28} bg="#DCEBF2" />
          Feed
        </Link>
        <button type="button" className={tileClass} onClick={onNappy}>
          <Hippo size={28} bg="#ECE4F5" />
          Nappy
        </button>
        <Link to="/meds" className={tileClass}>
          <LionCub size={28} bg="#FBE3D3" />
          Meds
        </Link>
        <Link to="/care" className={tileClass}>
          <Meerkat size={28} bg="#E3EFE4" />
          Obs
        </Link>
        <Link to="/care" className={tileClass}>
          <Monkey size={28} bg="#F8E1E4" />
          Tummy time
        </Link>
        <button type="button" className={tileClass} onClick={onNote}>
          <PencilIcon size={28} strokeWidth={1.8} />
          Note
        </button>
      </div>
    </section>
  )
}

function Timeline({ items, loading, onOpen }: { items: TimelineItem[]; loading: boolean; onOpen: (i: TimelineItem) => void }) {
  const { members } = useReadyHousehold()
  return (
    <section aria-labelledby="today-timeline" className="flex flex-col gap-2">
      <SectionTitle id="today-timeline">Today</SectionTitle>
      <Card className="flex flex-col px-3.5 py-1 md:rounded-[22px] md:px-5">
        {items.length === 0 && (
          <div className="py-2.5">
            <EmptyNote>{loading ? 'Loading…' : 'Nothing logged yet today. Everything logged since midnight shows here, newest first.'}</EmptyNote>
          </div>
        )}
        {items.map((i) => {
          const who = members.find((m) => m.id === i.by)
          return (
            <button
              key={i.key}
              type="button"
              onClick={() => onOpen(i)}
              className="flex min-h-[46px] items-center gap-2.5 border-b border-line-soft py-1.5 text-left last:border-b-0 md:min-h-12 md:gap-3.5"
            >
              <span className="w-[42px] shrink-0 text-[13px] font-extrabold md:w-[50px] md:text-sm">{i.time}</span>
              {' '}
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i.colour }} />
              <span className={`min-w-0 flex-1 text-sm md:text-[15px] ${i.flagged ? 'font-bold text-alert' : ''}`}>{i.text}</span>
              {i.pending && (
                <span className="shrink-0 text-[11px] font-bold text-ink-muted">
                  <span className="sr-only">,</span>{' '}waiting to sync
                </span>
              )}
              {who && (
                <>
                  <span className="sr-only">,</span>{' '}
                  <NamePill member={who} className="shrink-0 !px-2 !py-[3px]" />
                </>
              )}
              <span className="sr-only">.</span>{' '}<span className="sr-only">Tap to edit</span>
            </button>
          )
        })}
      </Card>
    </section>
  )
}

function Bar({ label, value, of, colour }: { label: string; value: string; of: number; colour: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm font-bold">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-line">
        <div className="h-2 rounded-full transition-[width] duration-500 ease-out" style={{ width: `${Math.min(100, Math.round(of * 100))}%`, background: colour }} />
      </div>
    </div>
  )
}

export function Today() {
  const t = useToday()
  const [sheet, setSheet] = useState<'nappy' | 'note' | TimelineItem | null>(null)
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null)
  const closeSheet = useCallback(() => setSheet(null), [])
  const clearToast = useCallback(() => setToast(null), [])

  const plans = t.plans ?? []
  const meds = t.medicines ?? []
  const logs = t.logs
  const given = t.scheduledGiven

  // Up next
  const cards: UpNextCard[] = []
  const feed = nextPlannedFeed(plans, t.today, t.now)
  if (feed) {
    cards.push({ key: 'feed', to: '/feeds', tint: 'bg-feeds', icon: <Elephant size={30} />, label: 'NG feed', big: countdown(feed.at, t.now), detail: describePlanned(feed) })
  }
  const dose = nextDose(meds, given, t.today, t.now)
  if (dose) {
    const overdue = Date.parse(dose.scheduledFor) < t.now.getTime()
    cards.push({
      key: 'med',
      to: '/meds',
      tint: 'bg-meds',
      icon: <LionCub size={30} />,
      label: dose.name,
      big: countdown(dose.scheduledFor, t.now),
      detail: `${dose.time} · ${formatDose(dose.dose, dose.unit)}`,
      alert: overdue,
    })
  }
  const range = tempRangeOf(t.routines)
  const obsDue = obsDueAt(t.lastObs, t.routines?.obsIntervalMin ?? null, t.now)
  if (obsDue && t.ready) {
    cards.push({
      key: 'obs',
      to: '/care',
      tint: 'bg-obs',
      icon: <Meerkat size={30} />,
      label: 'Obs',
      big: t.lastObs ? countdown(obsDue, t.now) : 'Due',
      detail: t.lastObs ? `${ukParts(obsDue).time} · temp, breathing, sleep` : 'none logged yet',
      alert: Date.parse(obsDue) < t.now.getTime(),
    })
  }
  const tube = tubeStatus(t.tube, t.routines?.tubeChangeDays ?? null, t.today)
  if (tube?.intervalDays && tube.day >= tube.intervalDays) {
    cards.push({
      key: 'tube',
      to: '/feeds',
      tint: 'bg-speech',
      icon: <Elephant size={30} />,
      label: 'NG tube change',
      big: tube.due ? 'Due' : 'Tomorrow',
      detail: `${tube.nostril} nostril · day ${tube.day} of ${tube.intervalDays}`,
      alert: tube.due,
    })
  }

  const nextAppt = t.appointments.find((a) => Date.parse(a.starts_at) >= t.now.getTime() - 60 * 60_000) ?? null
  if (nextAppt && Date.parse(nextAppt.starts_at) - t.now.getTime() < 7 * 86_400_000) {
    const sameDay = ukParts(nextAppt.starts_at).date === t.today
    cards.push({
      key: 'appt',
      to: '/plan',
      tint: 'bg-plan',
      icon: <Zebra size={30} />,
      label: nextAppt.with_whom ?? 'Appointment',
      big: sameDay ? countdown(nextAppt.starts_at, t.now) : new Date(nextAppt.starts_at).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' }),
      detail: `${ukParts(nextAppt.starts_at).time}${nextAppt.location ? ` · ${nextAppt.location}` : ''}`,
    })
  }
  for (const task of t.routines?.tasks ?? []) {
    const st = careTaskStatus(task, t.careTaskLogs, t.today)
    if (st.dueToday) cards.push({ key: `task-${task.id}`, to: '/plan', tint: 'bg-obs', icon: <Meerkat size={30} />, label: task.name, big: 'Today', detail: st.overdueDays ? `${st.overdueDays} day${st.overdueDays === 1 ? '' : 's'} late` : 'tick it off in Plan', alert: st.overdueDays > 0 })
  }
  const lowSupplies = t.supplies.filter(supplyLow)
  const lowRx = meds.flatMap((m) => {
    const rx = currentPrescription(t.prescriptions, m.id)
    const st = m.active && rx ? prescriptionStatus(rx, m, t.today) : null
    return st?.low ? [{ name: m.name, days: st.daysLeft }] : []
  })

  const items = logs ? buildTimeline(logs, meds, t.exercises ?? [], range) : []
  const tummyMin = (logs?.tummy ?? []).reduce((sum, x) => sum + x.duration_min, 0)
  const tummyGoal = t.routines?.tummyGoalMin ?? 0
  const milk = feedTotals(logs?.feeds ?? [])
  const target = plannedDayTotal(plans, t.today)
  const scheduled = dosesForDay(meds, t.today)
  const givenCount = scheduled.filter((s) => doseStatus(s, given, t.now) === 'given').length
  const wet = logs?.nappies.filter((n) => n.wet).length ?? 0
  const dirty = logs?.nappies.filter((n) => n.dirty).length ?? 0

  async function logNappy(wetN: boolean, dirtyN: boolean) {
    setSheet(null)
    try {
      const id = await addLog('nappies', t.householdId, { wet: wetN, dirty: dirtyN })
      t.reload()
      setToast({
        message: `Nappy logged · ${wetN && dirtyN ? 'wet and dirty' : wetN ? 'wet' : 'dirty'}`,
        undo: async () => {
          setToast(null)
          await deleteLog('nappies', id)
          t.reload()
        },
      })
    } catch (e) {
      setToast({ message: `Couldn't log the nappy: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  const open = typeof sheet === 'object' && sheet !== null ? sheet : null
  const openEntry = open?.entry
  const openMed = openEntry?.kind === 'given' ? meds.find((m) => m.id === openEntry.row.medicine_id) : undefined

  return (
    <>
      <PhoneHeader now={t.now} />
      <div className="grid gap-6 px-4 pt-1 md:grid-cols-[minmax(0,1fr)_260px] md:px-7 md:pt-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <TabletHeader now={t.now} />
          {t.error && <ErrorNote>Couldn't load today: {t.error}</ErrorNote>}
          <PlanChangedBanner />
          <UpNext cards={cards} loading={!t.ready} />
          <QuickLog onNappy={() => setSheet('nappy')} onNote={() => setSheet('note')} />
          <Timeline items={items} loading={!t.ready} onOpen={setSheet} />
        </div>
        <aside className="hidden flex-col gap-3.5 md:flex">
          <section className="flex flex-col gap-3 rounded-[22px] border-[1.5px] border-line bg-card px-[18px] py-4">
            <h2 className="m-0 text-xl font-bold">So far today</h2>
            <Bar label="Milk" value={target ? `${formatNumber(milk.total)} / ${formatNumber(target)} ml` : `${formatNumber(milk.total)} ml`} of={target ? milk.total / target : 0} colour="#7FA9C1" />
            <Bar label="Medicines" value={`${givenCount} / ${scheduled.length}`} of={scheduled.length ? givenCount / scheduled.length : 0} colour="#E9A06B" />
            <Bar label="Tummy time" value={tummyGoal ? `${tummyMin} / ${tummyGoal} min` : `${tummyMin} min`} of={tummyGoal ? tummyMin / tummyGoal : 0} colour="#B5677D" />
            <div className="flex justify-between text-sm font-bold">
              <span>Nappies</span>
              <span>
                {wet} wet · {dirty} dirty
              </span>
            </div>
          </section>
          <Link to="/plan" className="flex flex-col gap-1 rounded-[22px] bg-plan px-[18px] py-4 text-ink no-underline hover:text-ink">
            <h2 className="m-0 font-sans text-xs font-extrabold text-ink-deep uppercase">Next appointment</h2>
            {nextAppt ? (
              <>
                <span className="font-display text-xl leading-tight font-extrabold">
                  {new Date(nextAppt.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' })} · {ukParts(nextAppt.starts_at).time}
                </span>
                <span className="text-sm">
                  {nextAppt.with_whom}
                  {nextAppt.location ? `, ${nextAppt.location}` : ''}
                </span>
              </>
            ) : (
              <EmptyNote>No appointments coming up.</EmptyNote>
            )}
          </Link>
          <Link to="/plan" className="flex flex-col gap-1 rounded-[22px] bg-growth px-[18px] py-4 text-ink no-underline hover:text-ink">
            <h2 className="m-0 font-sans text-xs font-extrabold text-ink-deep uppercase">Running low</h2>
            {lowSupplies.length === 0 && lowRx.length === 0 ? (
              <EmptyNote>{t.supplies.length || t.prescriptions.length ? 'Nothing running low.' : 'Add supplies in Plan to track them here.'}</EmptyNote>
            ) : (
              <>
                {lowSupplies.length > 0 && <span className="text-sm font-bold">{lowSupplies.map((x) => `${x.name} (${x.quantity})`).join(' · ')}</span>}
                {lowRx.map((r) => (
                  <span key={r.name} className="text-sm font-bold">
                    {r.name}, about {r.days} day{r.days === 1 ? '' : 's'}
                  </span>
                ))}
              </>
            )}
          </Link>
        </aside>
      </div>

      {sheet === 'nappy' && <NappySheet onLog={logNappy} onClose={closeSheet} />}
      {sheet === 'note' && (
        <NoteSheet
          onClose={closeSheet}
          onSave={async (text) => {
            await addLog('notes', t.householdId, { text })
            setSheet(null)
            t.reload()
            setToast({ message: 'Note saved' })
          }}
        />
      )}
      {open && (
        <EditEntrySheet
          entry={open.entry}
          plans={plans}
          medicineName={openMed?.name}
          unit={openMed?.versions[0]?.unit}
          range={range}
          onClose={closeSheet}
          onDone={() => {
            setSheet(null)
            t.reload()
          }}
        />
      )}
      {toast && <Toast message={toast.message} onUndo={toast.undo} onDone={clearToast} />}
    </>
  )
}

