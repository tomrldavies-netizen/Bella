import { AmountStepper } from '../components/AmountStepper'
import { fieldClass } from '../components/PlanEditLayout'
import { Segmented } from '../components/Segmented'
import { BREATHING_LABEL, SLEEP_LABEL, obsConcerns, type TempRange } from './obs'
import type { ObsDraft } from './obsDraft'
import type { Breathing, Sleep } from './types'

const label = 'text-[13px] font-extrabold'

/** Obs checklist: temperature (0.1 °C steps), breathing & colour, sleep & settling, note. */
export function ObsForm({ draft, onChange, range }: { draft: ObsDraft; onChange: (d: ObsDraft) => void; range: TempRange }) {
  const set = (patch: Partial<ObsDraft>) => onChange({ ...draft, ...patch })
  const concerns = obsConcerns({ temperature_c: draft.temp, breathing: draft.breathing, sleep: draft.sleep }, range)
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-col">
          <span className={label}>Temperature</span>
          {range && (
            <span className="text-xs text-ink-muted">
              Normal range {range.min.toFixed(1)}–{range.max.toFixed(1)} °C
            </span>
          )}
        </span>
        <AmountStepper label="Temperature" value={draft.temp} onChange={(temp) => set({ temp })} step={0.1} min={30} max={45} unit="°C" />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>Breathing &amp; colour</span>
        <Segmented<Breathing>
          label="Breathing & colour"
          value={draft.breathing}
          onChange={(breathing) => set({ breathing })}
          accent="border-obs-accent"
          options={(['normal', 'noisy', 'pauses', 'colour_change'] as const).map((v) => ({ value: v, label: BREATHING_LABEL[v] }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={label}>Sleep &amp; settling</span>
        <Segmented<Sleep>
          label="Sleep & settling"
          value={draft.sleep}
          onChange={(sleep) => set({ sleep })}
          accent="border-obs-accent"
          options={(['settled', 'unsettled', 'very_sleepy'] as const).map((v) => ({ value: v, label: SLEEP_LABEL[v] }))}
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className={label}>Note</span>
        <input value={draft.note} maxLength={500} onChange={(e) => set({ note: e.target.value })} placeholder="Optional" className={fieldClass} />
      </label>
      {concerns.length > 0 && (
        <p className="m-0 rounded-xl bg-meds px-3 py-2 text-[13px] font-bold text-alert">
          This will be highlighted: {concerns.join(', ')}.
        </p>
      )}
    </div>
  )
}
