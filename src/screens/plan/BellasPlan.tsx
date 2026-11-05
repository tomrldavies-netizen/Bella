import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Elephant, Hornbill, LionCub, Meerkat, Monkey, Zebra } from '../../animals'
import { useAuth } from '../../auth/AuthContext'
import { useOutbox } from '../../offline/outbox'
import { Card, EmptyNote } from '../../components/Card'
import { ErrorNote } from '../../components/Field'
import { ChevronIcon, ClipboardIcon } from '../../components/Icons'
import { NamePill } from '../../components/NamePill'
import { ReadOnlyNote } from '../../components/PlanEditLayout'
import { ScreenHeader } from '../../components/ScreenHeader'
import { useReadyHousehold } from '../../household/HouseholdContext'
import { useLiveQuery } from '../../lib/useLiveQuery'
import { useNow } from '../../lib/useNow'
import { friendlyDateTime } from '../../lib/ukTime'
import { loadExercises, loadFeedPlans, loadMedicines, loadRecentChanges, loadRoutines } from '../../plan/api'
import { loadSeen } from '../../organise/api'
import { seenWords } from '../../organise/changes'
import { describePlan } from '../../plan/feedPlan'
import { describeRoutines } from '../../plan/routines'

function SectionLink({ to, icon, title, summary }: { to: string; icon: ReactNode; title: string; summary: string | null }) {
  return (
    <Link
      to={to}
      className="flex min-h-14 items-center gap-3 rounded-2xl border-[1.5px] border-line bg-card px-3 py-2 text-ink no-underline hover:text-ink"
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-extrabold">{title}</span>
        <span className="truncate text-[13px] text-ink-muted">{summary ?? 'Loading…'}</span>
      </span>
      <ChevronIcon size={18} className="shrink-0 text-ink-soft" />
    </Link>
  )
}

function SignedInCard() {
  const { me } = useReadyHousehold()
  const { session, signOut } = useAuth()
  const { ops } = useOutbox()
  const [confirm, setConfirm] = useState(false)
  return (
    <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
      <NamePill member={me} />
      <span className="min-w-0 flex-1 text-sm text-ink-muted">
        Signed in as {session?.user.email} · {me.role === 'parent' ? 'Parent' : 'Helper'}
      </span>
      {confirm && (
        <p role="alert" className="m-0 w-full rounded-xl bg-meds px-3 py-2 text-sm font-bold text-alert">
          {ops.length} change{ops.length === 1 ? " hasn't" : "s haven't"} synced yet and will be lost if you sign out now. Wait for signal, or tap Sign out again.
        </p>
      )}
      <button
        type="button"
        onClick={() => (ops.length && !confirm ? setConfirm(true) : signOut())}
        className="min-h-11 rounded-full border-[1.5px] border-line bg-card px-4 text-sm font-extrabold text-ink"
      >
        Sign out
      </button>
    </Card>
  )
}

/** Bella's plan hub (CarePlan.dc.html). */
export function BellasPlan() {
  const { household, me, members } = useReadyHousehold()
  const hid = household.id
  const feeds = useLiveQuery(hid, ['feed_plans', 'feed_plan_slots'], loadFeedPlans)
  const meds = useLiveQuery(hid, ['medicines', 'medicine_doses'], loadMedicines)
  const exercises = useLiveQuery(hid, ['exercises'], loadExercises)
  const routines = useLiveQuery(hid, ['settings', 'care_tasks'], loadRoutines)
  const changes = useLiveQuery(hid, ['plan_changes'], loadRecentChanges)
  const seen = useLiveQuery(hid, ['plan_change_seen'], loadSeen)

  const now = useNow().getTime()
  const currentFeedPlan = feeds.data?.find((p) => Date.parse(p.effective_from) <= now) ?? feeds.data?.[feeds.data.length - 1]
  const activeMeds = meds.data?.filter((m) => m.active)
  const ofType = (t: string) => exercises.data?.filter((e) => e.active && e.type === t)
  const physio = ofType('physio')
  const speech = ofType('speech_language')
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  const loadError = feeds.error ?? meds.error ?? exercises.error ?? routines.error ?? changes.error
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? 'Someone'

  return (
    <>
      <ScreenHeader
        title="Bella's plan"
        subtitle="What she needs, and when"
        tint="bg-bella-plan"
        back={{ to: '/', label: 'Today' }}
        guide={
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-card text-ink">
            <ClipboardIcon size={28} strokeWidth={1.8} />
          </span>
        }
      />
      <div className="flex flex-col gap-3 px-4 pt-3.5 md:px-7">
        {me.role === 'helper' ? (
          <ReadOnlyNote />
        ) : (
          <p className="m-0 text-[13px] leading-snug text-ink-muted">
            Enter the plan agreed with Bella's clinical team. The app never suggests doses or amounts.
          </p>
        )}
        {loadError && <ErrorNote>Couldn't load Bella's plan: {loadError}</ErrorNote>}
        <nav aria-label="Plan sections" className="flex flex-col gap-1.5">
          <SectionLink
            to="feeds"
            icon={<Elephant size={36} bg="#DCEBF2" />}
            title="Feed plan"
            summary={feeds.data ? describePlan(currentFeedPlan?.slots ?? []) : null}
          />
          <SectionLink
            to="medicines"
            icon={<LionCub size={36} bg="#FBE3D3" />}
            title="Medicines"
            summary={activeMeds ? (activeMeds.length ? activeMeds.map((m) => m.name).join(' · ') : 'None added yet') : null}
          />
          <SectionLink
            to="exercises?type=physio"
            icon={<Monkey size={36} bg="#F8E1E4" />}
            title="Physio"
            summary={physio && routines.data ? `${count(physio.length, 'exercise')} · tummy time goal ${routines.data.tummyGoalMin} min` : null}
          />
          <SectionLink
            to="exercises?type=speech_language"
            icon={<Hornbill size={36} bg="#DDF0EE" />}
            title="Speech & language"
            summary={speech ? count(speech.length, 'exercise') : null}
          />
          <SectionLink
            to="routines"
            icon={<Meerkat size={36} bg="#E3EFE4" />}
            title="Obs & routines"
            summary={routines.data ? describeRoutines(routines.data) : null}
          />
          <SectionLink
            to="family"
            icon={<Zebra size={36} bg="#E6E9F4" />}
            title="Family & sharing"
            summary={`${count(members.filter((m) => m.role === 'parent').length, 'parent')} · ${count(members.filter((m) => m.role === 'helper').length, 'helper')}`}
          />
        </nav>

        <section aria-labelledby="recent-changes" className="flex flex-col gap-2 pt-1">
          <h2 id="recent-changes" className="m-0 text-xl font-bold">
            Recent changes
          </h2>
          <Card className="flex flex-col px-3.5 py-1">
            {changes.data && changes.data.length === 0 && (
              <div className="py-2.5">
                <EmptyNote>No changes yet. Every change to the plan will be listed here.</EmptyNote>
              </div>
            )}
            {changes.data?.map((c) => (
              <div key={c.id} className="flex flex-col gap-0.5 border-b border-line-soft py-2.5 last:border-b-0">
                <span className="text-sm font-bold">{c.summary}</span>
                <span className="text-xs text-ink-muted">
                  {nameOf(c.changed_by)} · {friendlyDateTime(c.created_at)}
                  {seen.data && seenWords(c, members, seen.data) ? ` · ${seenWords(c, members, seen.data)}` : ''}
                </span>
              </div>
            ))}
            {!changes.data && <div className="py-2.5"><EmptyNote>Loading…</EmptyNote></div>}
          </Card>
        </section>

        <SignedInCard />
      </div>
    </>
  )
}
