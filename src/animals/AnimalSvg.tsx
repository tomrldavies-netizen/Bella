import type { ReactNode } from 'react'

export type AnimalProps = {
  /** Rendered width and height in px. */
  size?: number
  /** Fill of the round badge behind the face. */
  bg?: string
  /** Accessible name. Leave out for decorative use. */
  title?: string
  className?: string
}

/** Shared 44×44 frame used by every animal face in the mockups. */
export function AnimalSvg({
  size = 44,
  bg = '#FFFFFF',
  title,
  className,
  children,
}: AnimalProps & { children: ReactNode }) {
  const a11y = title
    ? { role: 'img' as const, 'aria-label': title }
    : { 'aria-hidden': true as const }
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} className={className} {...a11y}>
      <circle cx="22" cy="22" r="22" fill={bg} />
      {children}
    </svg>
  )
}
