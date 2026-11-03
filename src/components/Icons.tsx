import type { ReactNode } from 'react'

type IconProps = { size?: number; className?: string; strokeWidth?: number }

function Icon({ size = 22, className, strokeWidth = 2, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

// Line icons copied from the mockups' navigation and buttons.
export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </Icon>
)
export const BottleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 3h6M10 3v3l-2 3v11a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V9l-2-3V3M8 13h8" />
  </Icon>
)
export const PillIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z" />
    <path d="M7 7l7 7" />
  </Icon>
)
export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4v16h16" />
    <path d="M7 15l4-4 3 3 5-6" />
  </Icon>
)
export const HeartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
  </Icon>
)
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  </Icon>
)
export const BarsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 20V10M12 20V4M18 20v-7" />
  </Icon>
)
export const ClipboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 3h6v3H9zM8 11h8M8 15h5" />
  </Icon>
)
export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13 7l4 4" />
  </Icon>
)
export const BackIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)
