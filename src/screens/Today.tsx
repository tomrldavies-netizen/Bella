import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Elephant, Hippo, LionCub, Meerkat, Monkey, SavannaScene } from '../animals'
import { Card, EmptyNote } from '../components/Card'
import { ClipboardIcon, PencilIcon } from '../components/Icons'
import { formatLongDate, greeting } from '../lib/dates'
import { useNow } from '../lib/useNow'

function BellasPlanButton() {
  return (
    <Link
      to="/bellas-plan"
      className="flex h-11 items-center gap-1.5 rounded-full bg-card pr-3.5 pl-2.5 text-[13px] font-extrabold text-ink no-underline hover:text-ink"
    >
      <ClipboardIcon size={20} />
      Bella's plan
    </Link>
  )
}

/** Phone header: savanna scene with Bella's name (Main.dc.html). */
function PhoneHeader({ now }: { now: Date }) {
  return (
    <header className="relative h-[180px] overflow-hidden md:hidden">
      <SavannaScene className="absolute inset-0" />
      <div className="absolute top-[max(20px,env(safe-area-inset-top))] right-4">
        <BellasPlanButton />
      </div>
      <div className="absolute top-[max(26px,env(safe-area-inset-top))] left-5 flex flex-col gap-0.5">
        <p className="m-0 text-sm font-bold text-ink-soft">{formatLongDate(now)}</p>
        <h1 className="m-0 text-[42px] leading-[1.05] font-extrabold">Bella</h1>
      </div>
    </header>
  )
}

/** Tablet header: date and greeting (Tablet.dc.html). */
function TabletHeader({ now }: { now: Date }) {
  return (
    <header className="hidden items-start justify-between gap-4 md:flex">
      <div className="flex flex-col">
        <p className="m-0 text-sm font-bold text-ink-muted">{formatLongDate(now)}</p>
        <h1 className="m-0 text-[34px] leading-[1.1] font-extrabold">{greeting(now)}</h1>
      </div>
      <div className="rounded-full border-[1.5px] border-line">
        <BellasPlanButton />
      </div>
    </header>
  )
}

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="m-0 text-xl font-bold">{children}</h2>
      {aside}
    </div>
  )
}

function UpNext() {
  return (
    <section aria-labelledby="up-next" className="flex flex-col gap-2">
      <SectionTitle
        aside={
          <Link to="/summary" className="text-[13px] font-bold">
            Daily summary
          </Link>
        }
      >
        <span id="up-next">Up next</span>
      </SectionTitle>
      <Card className="px-4 py-3.5">
        <EmptyNote>
          Nothing due yet. Once Bella's plan is set up, the next feed, medicine, obs and appointment will show
          here with a countdown.
        </EmptyNote>
      </Card>
    </section>
  )
}

const tileClass =
  'flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-[1.5px] border-line bg-card text-[13px] font-bold text-ink no-underline hover:text-ink md:h-[76px] md:text-sm md:font-extrabold'

function QuickLog() {
  const links: { to: string; label: string; icon: ReactNode }[] = [
    { to: '/feeds', label: 'Feed', icon: <Elephant size={28} bg="#DCEBF2" /> },
    { to: '/meds', label: 'Meds', icon: <LionCub size={28} bg="#FBE3D3" /> },
    { to: '/care', label: 'Obs', icon: <Meerkat size={28} bg="#E3EFE4" /> },
    { to: '/care', label: 'Tummy time', icon: <Monkey size={28} bg="#F8E1E4" /> },
  ]
  // Order follows the mockup: Feed, Nappy, Meds, Obs, Tummy time, Note.
  const [feed, meds, obs, tummy] = links.map((l) => (
    <Link key={l.label} to={l.to} className={tileClass}>
      {l.icon}
      {l.label}
    </Link>
  ))
  return (
    <section aria-labelledby="quick-log" className="flex flex-col gap-2">
      <SectionTitle>
        <span id="quick-log">Quick log</span>
      </SectionTitle>
      <div className="grid grid-cols-3 gap-2.5 min-[1100px]:grid-cols-6">
        {feed}
        <button type="button" className={`${tileClass} opacity-60`} disabled title="Coming soon">
          <Hippo size={28} bg="#ECE4F5" />
          Nappy
        </button>
        {meds}
        {obs}
        {tummy}
        <button type="button" className={`${tileClass} opacity-60`} disabled title="Coming soon">
          <PencilIcon size={28} strokeWidth={1.8} />
          Note
        </button>
      </div>
    </section>
  )
}

function Timeline() {
  return (
    <section aria-labelledby="today-timeline" className="flex flex-col gap-2">
      <SectionTitle>
        <span id="today-timeline">Today</span>
      </SectionTitle>
      <Card className="px-4 py-3.5">
        <EmptyNote>Nothing logged yet today. Everything logged since midnight will show here, newest first.</EmptyNote>
      </Card>
    </section>
  )
}

/** Right-hand column on tablets: totals, next appointment, running low. */
function TabletAside() {
  return (
    <aside className="hidden flex-col gap-3.5 md:flex">
      <section className="flex flex-col gap-3 rounded-[22px] border-[1.5px] border-line bg-card px-[18px] py-4">
        <h2 className="m-0 text-xl font-bold">So far today</h2>
        <EmptyNote>Milk, medicines, tummy time and nappies will add up here as care is logged.</EmptyNote>
      </section>
      <section className="flex flex-col gap-1 rounded-[22px] bg-plan px-[18px] py-4">
        <h2 className="m-0 font-sans text-xs font-extrabold text-ink-deep uppercase">Next appointment</h2>
        <EmptyNote>No appointments added yet.</EmptyNote>
      </section>
      <section className="flex flex-col gap-1 rounded-[22px] bg-growth px-[18px] py-4">
        <h2 className="m-0 font-sans text-xs font-extrabold text-ink-deep uppercase">Running low</h2>
        <EmptyNote>Supplies and prescriptions will show here when they're added.</EmptyNote>
      </section>
    </aside>
  )
}

export function Today() {
  const now = useNow()
  return (
    <>
      <PhoneHeader now={now} />
      <div className="grid gap-6 px-4 pt-1 md:grid-cols-[minmax(0,1fr)_260px] md:px-7 md:pt-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-4 md:gap-5">
          <TabletHeader now={now} />
          <UpNext />
          <QuickLog />
          <Timeline />
        </div>
        <TabletAside />
      </div>
    </>
  )
}
