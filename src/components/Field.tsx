import type { ReactNode } from 'react'

export const inputClass =
  'h-12 w-full rounded-[14px] border-[1.5px] border-line bg-card px-3.5 text-base text-ink placeholder:text-ink-soft/70 focus:border-primary focus:outline-none'

export const primaryButtonClass =
  'flex h-12 w-full items-center justify-center rounded-full bg-primary px-5 text-base font-extrabold text-white hover:bg-primary-dark disabled:opacity-50'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-extrabold">{label}</span>
      {children}
      {hint && <span className="text-[13px] text-ink-muted">{hint}</span>}
    </label>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 rounded-[14px] bg-meds px-3.5 py-2.5 text-sm font-bold text-alert">
      {children}
    </p>
  )
}
