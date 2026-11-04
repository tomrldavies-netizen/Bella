import { useState } from 'react'
import { ErrorNote } from '../components/Field'
import { useReadyHousehold } from '../household/HouseholdContext'
import { useLiveQuery } from '../lib/useLiveQuery'
import { shortDate, ukParts } from '../lib/ukTime'
import { loadPlanChangesFull, loadSeen, markSeen } from './api'
import { unseenFor } from './changes'

/**
 * "Bella's plan has changed" (HelperToday.dc.html): plan changes made by
 * someone else with "Tell everyone" on, until this person taps Got it.
 */
export function PlanChangedBanner() {
  const { household, me, members, baby } = useReadyHousehold()
  const changes = useLiveQuery(household.id, ['plan_changes'], loadPlanChangesFull)
  const seen = useLiveQuery(household.id, ['plan_change_seen'], loadSeen)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!changes.data || !seen.data) return null
  const unseen = unseenFor(me, changes.data, seen.data)
  if (unseen.length === 0) return null
  const shown = unseen.slice(0, 3)
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? 'Someone'

  return (
    <section aria-label="What's changed" className="flex flex-col gap-2 rounded-[18px] border-[1.5px] border-banner-accent bg-banner px-4 py-3">
      <span className="font-display text-lg leading-tight font-extrabold">{baby.name}'s plan has changed</span>
      {shown.map((c) => (
        <div key={c.id} className="flex flex-col">
          <span className="text-xs font-bold text-ink-muted">
            {nameOf(c.changed_by)} · {shortDate(ukParts(c.created_at).date)}
          </span>
          <span className="text-sm">{c.summary}</span>
        </div>
      ))}
      {unseen.length > shown.length && <span className="text-xs text-ink-muted">and {unseen.length - shown.length} more in Bella's plan → Recent changes</span>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await markSeen(household.id, unseen.map((c) => c.id))
            seen.reload()
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          } finally {
            setBusy(false)
          }
        }}
        className="h-11 self-start rounded-full bg-primary px-5 text-sm font-extrabold text-white disabled:opacity-50"
      >
        Got it
      </button>
    </section>
  )
}
