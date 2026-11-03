import type { ReactNode } from 'react'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[18px] border-[1.5px] border-line bg-card ${className}`}>{children}</div>
}

/** Gentle placeholder text for a section with nothing in it yet. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="m-0 text-sm leading-snug text-ink-muted">{children}</p>
}
