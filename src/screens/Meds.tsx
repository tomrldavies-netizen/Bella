import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { LionCub } from '../animals'
import { countdown } from '../care/countdown'
import { doseStatus, dosesForDay, givenFor, nextDose, type DoseSlot, type DoseStatus } from '../care/medSchedule'
import { GiveSheet } from '../care/sheets/GiveSheet'
import { EditEntrySheet } from '../care/sheets/LogSheets'
import type { GivenLog } from '../care/types'
import { useToday } from '../care/useToday'
import { Toast } from '../components/BottomSheet'
import { Card, EmptyNote } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { NamePill } from '../components/NamePill'
import { ScreenHeader } from '../components/ScreenHeader'
import { ukParts } from '../lib/ukTime'
import { formatDose } from '../plan/medicines'

const STATUS_CHIP: Record<Exclude<DoseStatus, 'given'>, { text: string; cls: string }> = {
  due: { text: 'Due', cls: 'bg-meds text-alert' },
  missed: { text: 'Missed', cls: 'bg-alert text-white' },
  later: { text: 'Later', cls: 'bg-tabs text-ink-muted' },
}

const ROUTE_WORDS = { mouth: 'by mouth', tube: 'via tube', either: 'by mouth or via tube' } as const

export function Meds() {
  const t = useToday()
  const [giving, setGiving] = useState<DoseSlot | null>(null)
  const [editing, setEditing] = useState<GivenLog | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])

  const meds = t.medicines ?? []
  const given = t.scheduledGiven
  const schedule = dosesForDay(meds, t.today)
  const next = nextDose(meds, given, t.today, t.now)
  const givenCount = schedule.filter((s) => doseStatus(s, given, t.now) === 'given').length
  const nameOf = (id: string) => t.members.find((m) => m.id === id)

  const mins = next ? Math.round((Date.parse(next.scheduledFor) - t.now.getTime()) / 60000) : 0
  const dueLabel = !next ? '' : mins > 0 ? `DUE IN ${countdown(next.scheduledFor, t.now).toUpperCase()}` : mins === 0 ? 'DUE NOW' : `${countdown(next.scheduledFor, t.now).replace(' ago', '').toUpperCase()} LATE`

  const editingMed = editing ? meds.find((m) => m.id === editing.medicine_id) : undefined

  return (
    <>
      <ScreenHeader
        title="Medicines"
        subtitle={schedule.length ? `${givenCount} of ${schedule.length} doses given today` : "Today's doses"}
        tint="bg-meds"
        guide={<LionCub size={56} smile />}
        action={
          t.me.role === 'parent' ? (
            <Link to="/bellas-plan/medicines" className="flex min-h-11 items-center rounded-full bg-card px-3 text-xs font-extrabold text-ink no-underline hover:text-ink">
              Edit doses
            </Link>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-3 px-4 pt-3.5 md:max-w-3xl md:px-7">
        {t.error && <ErrorNote>Couldn't load medicines: {t.error}</ErrorNote>}

        {next && (
          <section className="flex items-center justify-between gap-3 rounded-[20px] border-[1.5px] border-meds-accent bg-meds px-4 py-3.5">
            <div className="flex min-w-0 flex-col">
              <span className={`text-xs font-extrabold ${mins < 0 ? 'text-alert' : 'text-ink-deep'}`}>{dueLabel}</span>
              <span className="font-display text-xl leading-tight font-extrabold">
                {next.name} · {formatDose(next.dose, next.unit)}
              </span>
              <span className="text-[13px] text-ink-deep">
                {next.time} · {ROUTE_WORDS[next.route]}
              </span>
            </div>
            <button type="button" onClick={() => setGiving(next)} className="h-12 shrink-0 rounded-full bg-primary px-4 text-sm font-extrabold text-white">
              Mark given
            </button>
          </section>
        )}

        <section aria-labelledby="schedule" className="flex flex-col gap-2">
          <h2 id="schedule" className="m-0 text-xl font-bold">
            Today's schedule
          </h2>
          <Card className="flex flex-col px-3.5 py-1">
            {schedule.length === 0 && (
              <div className="py-2.5">
                <EmptyNote>{t.ready ? "No medicines in Bella's plan." : 'Loading…'}</EmptyNote>
              </div>
            )}
            {schedule.map((s) => {
              const status = doseStatus(s, given, t.now)
              const done = givenFor(s, given)
              const last = done[done.length - 1]
              const who = last ? nameOf(last.logged_by) : undefined
              return (
                <button
                  key={`${s.medicineId}:${s.scheduledFor}`}
                  type="button"
                  onClick={() => (last ? setEditing(last) : setGiving(s))}
                  aria-label={`${s.time} ${s.name} ${formatDose(s.dose, s.unit)}: ${status === 'given' ? `given by ${who?.display_name ?? 'someone'}` : STATUS_CHIP[status].text}`}
                  className="flex min-h-12 items-center gap-2.5 border-b border-line-soft py-1.5 text-left last:border-b-0"
                >
                  <span className="w-[42px] shrink-0 text-[13px] font-extrabold">{s.time}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    {s.name} {formatDose(last?.dose_given ?? s.dose, s.unit)}
                    {done.length > 1 && <span className="ml-1 text-xs font-bold text-alert">· given {done.length} times</span>}
                  </span>
                  {status === 'given' ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs text-ink-muted">{ukParts(last.given_at).time}</span>
                      {who && <NamePill member={who} className="!px-2 !py-[3px]" />}
                    </span>
                  ) : (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${STATUS_CHIP[status].cls}`}>{STATUS_CHIP[status].text}</span>
                  )}
                </button>
              )
            })}
          </Card>
          {schedule.length > 0 && <p className="m-0 text-xs text-ink-muted">Tap a dose to mark it given, or to change one already given.</p>}
          {t.me.role === 'parent' && meds.length === 0 && t.ready && (
            <Link to="/bellas-plan/medicines" className="text-sm font-extrabold">
              Add medicines to Bella's plan
            </Link>
          )}
        </section>
      </div>

      {giving && (
        <GiveSheet
          householdId={t.householdId}
          slot={giving}
          already={givenFor(giving, given)}
          members={t.members}
          onClose={() => setGiving(null)}
          onDone={() => {
            setToast(`${giving.name} marked given`)
            setGiving(null)
            t.reload()
          }}
        />
      )}
      {editing && (
        <EditEntrySheet
          entry={{ kind: 'given', row: editing }}
          plans={[]}
          medicineName={editingMed?.name}
          unit={editingMed?.versions[0]?.unit}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            t.reload()
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}
