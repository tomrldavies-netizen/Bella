/** On/off switch styled like the mockups' "Tell everyone" toggle. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-11 items-center gap-2.5 p-0 text-left text-sm font-bold text-ink"
    >
      <span
        aria-hidden="true"
        className={`flex h-6 w-10 shrink-0 rounded-full p-[3px] transition-colors ${on ? 'justify-end bg-primary' : 'justify-start bg-line'}`}
      >
        <span className="h-[18px] w-[18px] rounded-full bg-card" />
      </span>
      {label}
    </button>
  )
}
