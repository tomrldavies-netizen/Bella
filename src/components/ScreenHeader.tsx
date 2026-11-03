import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BackIcon } from './Icons'

type Props = {
  title: string
  subtitle?: string
  /** Tailwind background class for the section tint, e.g. `bg-feeds`. */
  tint: string
  /** The section's animal guide (56 px). */
  guide: ReactNode
  /** Optional button on the right, e.g. "Add weigh-in". */
  action?: ReactNode
  /** Back link shown above the title (e.g. to Today or Bella's plan). */
  back?: { to: string; label: string }
  /** Hide the back link on tablets, where the rail already offers the way back. */
  backPhoneOnly?: boolean
}

/** Tinted, rounded section header used by every screen except Today. */
export function ScreenHeader({ title, subtitle, tint, guide, action, back, backPhoneOnly }: Props) {
  return (
    <header
      className={`${tint} flex flex-col gap-1.5 rounded-b-[28px] px-5 pt-[max(22px,env(safe-area-inset-top))] pb-[18px] md:mx-7 md:mt-7 md:rounded-[28px] md:pt-[22px]`}
    >
      {back && (
        <Link
          to={back.to}
          className={`-ml-1 flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-ink no-underline hover:text-ink ${
            backPhoneOnly ? 'md:hidden' : ''
          }`}
        >
          <BackIcon size={20} />
          {back.label}
        </Link>
      )}
      <div className="flex items-center gap-3.5">
        <span className="shrink-0">{guide}</span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 text-[30px] leading-[1.1] font-extrabold">{title}</h1>
          {subtitle && <p className="m-0 text-[13px] font-semibold text-ink-deep">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}
