import { AmountStepper } from '../components/AmountStepper'
import { fieldClass } from '../components/PlanEditLayout'
import { Segmented } from '../components/Segmented'
import { Toggle } from '../components/Toggle'
import { formatNumber } from '../lib/ukTime'
import type { MilkType } from '../plan/feedPlan'
import { METHOD_LABEL, SICK_LABEL, describePlanned, type PlannedFeed } from './feedLog'
import { FEED_FINE_STEP, FEED_STEP, type FeedDraft } from './feedDraft'
import type { FeedMethod, SickLevel } from './types'

const label = 'text-[13px] font-extrabold'

/** The feed details: planned feed, method, amounts, milk, sick/reflux, when. */
export function FeedForm({
  draft,
  onChange,
  plannedOptions,
}: {
  draft: FeedDraft
  onChange: (d: FeedDraft) => void
  plannedOptions: PlannedFeed[]
}) {
  const set = (patch: Partial<FeedDraft>) => onChange({ ...draft, ...patch })
  const total = draft.oral + draft.tube
  const pct = total ? Math.round((draft.oral / total) * 100) : 0

  function pick(at: string) {
    const p = plannedOptions.find((o) => o.at === at) ?? null
    // Keep what's been given by mouth; the rest of the planned amount goes via tube.
    set(p ? { planned: p, milk: p.milk, tube: Math.max(0, p.ml - draft.oral) } : { planned: null })
  }

  return (
    <div className="flex flex-col gap-3.5">
      {plannedOptions.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className={label}>Planned feed</span>
          <select value={draft.planned?.at ?? ''} onChange={(e) => pick(e.target.value)} className={fieldClass}>
            <option value="">Not a planned feed</option>
            {plannedOptions.map((o) => (
              <option key={o.at} value={o.at}>
                {describePlanned(o)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <span className={label}>How was it given?</span>
        <Segmented<FeedMethod>
          label="How was it given?"
          value={draft.method}
          onChange={(method) => set({ method, oral: method === 'tube' ? 0 : draft.oral, tube: method === 'tube' ? total : draft.tube })}
          accent="border-feeds-accent"
          options={(['tube', 'bottle_tube', 'breast_tube'] as const).map((v) => ({ value: v, label: METHOD_LABEL[v] }))}
        />
      </div>

      {draft.method !== 'tube' && (
        <div className="flex items-center justify-between gap-2">
          <span className="flex flex-col">
            <span className={label}>By mouth</span>
            {draft.method === 'breast_tube' && <span className="text-xs text-ink-muted">Your best estimate</span>}
          </span>
          <AmountStepper
            label="By mouth"
            value={draft.oral}
            step={FEED_STEP}
            fineStep={FEED_FINE_STEP}
            max={500}
            onChange={(oral) => {
              // Topping up by tube: keep the planned total when there is one.
              const tube = draft.planned ? Math.max(0, draft.planned.ml - oral) : draft.tube
              set({ oral, tube })
            }}
          />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className={label}>Via tube</span>
        <AmountStepper label="Via tube" value={draft.tube} step={FEED_STEP} fineStep={FEED_FINE_STEP} max={500} onChange={(tube) => set({ tube })} />
      </div>
      <p className="m-0 rounded-xl bg-feeds px-3 py-2 text-[13px] font-bold">
        Total {formatNumber(total)} ml
        {draft.planned ? ` of ${formatNumber(draft.planned.ml)} ml planned` : ''}
        {draft.method !== 'tube' ? ` · ${pct}% by mouth` : ''}
      </p>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Milk</span>
        <div className="flex flex-col gap-1.5">
          <div className="min-w-0">
            <Segmented<MilkType | ''>
              label="Milk"
              value={draft.milk ?? ''}
              onChange={(m) => set({ milk: m || null })}
              accent="border-feeds-accent"
              options={[
                { value: 'breast', label: 'Breast milk' },
                { value: 'formula', label: 'Formula' },
                { value: 'mix', label: 'Mix' },
              ]}
            />
          </div>
          <Toggle on={draft.fortified} onChange={(fortified) => set({ fortified })} label="Fortifier" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Sick or reflux?</span>
        <Segmented<SickLevel>
          label="Sick or reflux?"
          value={draft.sick}
          onChange={(sick) => set({ sick })}
          accent="border-feeds-accent"
          options={(['none', 'posset', 'small', 'large'] as const).map((v) => ({ value: v, label: SICK_LABEL[v] }))}
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className={label}>Note</span>
        <input value={draft.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} placeholder="Optional" className={fieldClass} />
      </label>

      <label className="flex items-center justify-between gap-2">
        <span className={label}>Time</span>
        <input type="time" value={draft.time} onChange={(e) => e.target.value && set({ time: e.target.value })} className={`${fieldClass} w-32`} />
      </label>
    </div>
  )
}
