type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Shown after the number, e.g. "wks". */
  unit?: string
  onChange: (value: number) => void
}

/** − value + control with 44 px buttons, used instead of the keyboard. */
export function Stepper({ label, value, min, max, step = 1, unit, onChange }: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const btn =
    'flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-line bg-card text-2xl font-extrabold text-ink disabled:opacity-40'
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <button
        type="button"
        className={btn}
        aria-label={`Less ${label.toLowerCase()}`}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
      >
        −
      </button>
      <output aria-live="polite" className="min-w-[3.5ch] text-center font-display text-[28px] leading-none font-extrabold">
        {value}
        {unit && <span className="ml-1 font-sans text-sm font-bold text-ink-muted">{unit}</span>}
      </output>
      <button
        type="button"
        className={btn}
        aria-label={`More ${label.toLowerCase()}`}
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
      >
        +
      </button>
    </div>
  )
}
