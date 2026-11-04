type Option<T extends string> = { value: T; label: string }

/** A row of mutually exclusive buttons (mockup "Given: By mouth / Via tube / Either"). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  accent = 'border-primary',
}: {
  label: string
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  /** Tailwind border class for the selected option. */
  accent?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl bg-tabs p-1">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-11 flex-1 rounded-[9px] px-2 text-[13px] ${
              on ? `border-[1.5px] bg-card font-extrabold text-ink ${accent}` : 'font-bold text-ink-deep'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
