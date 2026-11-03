import type { ReactNode } from 'react'
import { SavannaScene } from '../animals'

/** Savanna header and a single centred column, for sign-in and setup. */
export function WelcomeLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-10">
      <div className="mx-auto max-w-lg md:pt-8">
        <header className="relative h-[180px] overflow-hidden md:rounded-[28px]">
          <SavannaScene className="absolute inset-0" />
          <div className="absolute top-[max(26px,env(safe-area-inset-top))] left-5 flex max-w-[60%] flex-col gap-0.5">
            <h1 className="m-0 text-[38px] leading-[1.05] font-extrabold">{title}</h1>
            {subtitle && <p className="m-0 text-sm font-bold text-ink-soft">{subtitle}</p>}
          </div>
        </header>
        <main className="flex flex-col gap-4 px-4 pt-4 md:px-0">{children}</main>
      </div>
    </div>
  )
}
