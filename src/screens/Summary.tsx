import { useState } from 'react'
import { Hippo } from '../animals'
import { loadDayLogs, loadGivenBetween, loadWeights } from '../care/api'
import { tempRangeOf } from '../care/obs'
import { Card, EmptyNote } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { NamePill } from '../components/NamePill'
import { ScreenHeader } from '../components/ScreenHeader'
import { formatKg } from '../growth/growth'
import { useReadyHousehold } from '../household/HouseholdContext'
import { useLiveQuery } from '../lib/useLiveQuery'
import { useNow } from '../lib/useNow'
import { addDaysIso, formatNumber, ukNow, ukParts, ukToIso } from '../lib/ukTime'
import { daySummary, type FeedBar } from '../organise/summary'
import { loadFeedPlans, loadMedicines, loadRoutines } from '../plan/api'

function longDay(date: string) {
  const d = new Date(date + 'T12:00:00Z')
  return `${d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })} ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`
}

/** Stacked bars: by mouth (dark) on top of via tube, placed by time of day. */
function FeedChart({ bars }: { bars: FeedBar[] }) {
  const W = 340
  const baseY = 100
  const top = 10
  const max = Math.max(10, ...bars.map((b) => b.oral + b.tube))
  const h = (ml: number) => (ml / max) * (baseY - top)
  const x = (hour: number) => 10 + (hour / 24) * (W - 20)
  const label = bars.length
    ? `${bars.length} feeds: ${bars.map((b) => `${b.time} ${formatNumber(b.oral + b.tube)} ml (${formatNumber(b.oral)} by mouth)`).join(', ')}`
    : 'No feeds'
  return (
    <svg viewBox={`0 0 ${W} 122`} width="100%" role="img" aria-label={label}>
      <line x1="10" y1={baseY} x2={W - 6} y2={baseY} stroke="#D9CDB8" strokeWidth="1" />
      {bars.map((b, i) => (
        <g key={i}>
          <rect x={x(b.hour) - 7} y={baseY - h(b.tube)} width="14" height={h(b.tube)} rx="3" fill="#B7CEDB" />
          <rect x={x(b.hour) - 7} y={baseY - h(b.tube) - h(b.oral)} width="14" height={h(b.oral)} rx="3" fill="#3F6B4B" />
        </g>
      ))}
      {[0, 3, 6, 9, 12, 15, 18, 21].map((t) => (
        <text key={t} x={x(t + 0.5)} y="116" textAnchor="middle" fontFamily="Nunito, sans-serif" fontSize="11" fill="#5C5146">
          {String(t).padStart(2, '0')}
        </text>
      ))}
    </svg>
  )
}

function Tile({ k, v, sub, alert }: { k: string; v: string; sub?: string; alert?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border-[1.5px] border-line bg-card px-3 py-2.5">
      <span className="text-[11px] font-extrabold text-ink-deep">{k}</span>
      <span className="font-display text-lg leading-tight font-extrabold">{v}</span>
      {sub && <span className={`text-xs ${alert ? 'font-bold text-alert' : 'text-ink-muted'}`}>{sub}</span>}
    </div>
  )
}

export function Summary() {
  const { household, members } = useReadyHousehold()
  const hid = household.id
  const now = useNow()
  const today = ukNow(now).date
  const [date, setDate] = useState(today)
  const from = ukToIso(date, '00:00')
  const to = ukToIso(addDaysIso(date, 1), '00:00')

  const logs = useLiveQuery(hid, ['feeds', 'nappies', 'medicine_given', 'notes', 'obs', 'exercise_logs', 'tummy_time', 'tube_changes'], (h) => loadDayLogs(h, from, to), date)
  const given = useLiveQuery(hid, ['medicine_given'], (h) => loadGivenBetween(h, from, to), date)
  const plans = useLiveQuery(hid, ['feed_plans'], loadFeedPlans)
  const meds = useLiveQuery(hid, ['medicines', 'medicine_doses'], loadMedicines)
  const routines = useLiveQuery(hid, ['settings'], loadRoutines)
  const weights = useLiveQuery(hid, ['weights'], loadWeights)
  const error = logs.error ?? given.error ?? plans.error ?? meds.error ?? routines.error ?? weights.error
  const ready = logs.data && given.data && plans.data && meds.data && routines.data && weights.data

  const s = ready
    ? daySummary({
        date,
        logs: logs.data!,
        given: given.data!,
        plans: plans.data!,
        medicines: meds.data!,
        tummyGoal: routines.data!.tummyGoalMin,
        range: tempRangeOf(routines.data),
        weights: weights.data!,
        now,
      })
    : null
  const who = (id: string) => members.find((m) => m.id === id)

  return (
    <>
      <ScreenHeader title="Daily summary" subtitle="Midnight to midnight" tint="bg-bella-plan" guide={<Hippo size={56} />} back={{ to: '/', label: 'Today' }} backPhoneOnly />
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4 md:max-w-3xl md:px-7">
        <div className="flex items-center justify-between rounded-[14px] border-[1.5px] border-line bg-card px-1 py-0.5">
          <button type="button" aria-label="Previous day" onClick={() => setDate(addDaysIso(date, -1))} className="h-11 w-11 text-xl font-extrabold">
            ‹
          </button>
          <span className="text-[15px] font-extrabold">{date === today ? `Today · ${longDay(date)}` : longDay(date)}</span>
          <button type="button" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDaysIso(date, 1))} className="h-11 w-11 text-xl font-extrabold disabled:opacity-30">
            ›
          </button>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        {!s && !error && <EmptyNote>Loading…</EmptyNote>}
        {s && (
          <>
            <section className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Tile k="MILK" v={s.milk.target ? `${formatNumber(s.milk.total)} / ${formatNumber(s.milk.target)} ml` : `${formatNumber(s.milk.total)} ml`} sub={`${s.milk.count} feed${s.milk.count === 1 ? '' : 's'}`} />
              <Tile k="BY MOUTH" v={`${formatNumber(s.milk.oral)} ml`} sub={`${s.milk.pctByMouth}% of total`} />
              <Tile k="NAPPIES" v={`${s.nappies.wet} wet · ${s.nappies.dirty} dirty`} sub={s.nappies.last ? `last ${s.nappies.last}` : 'none logged'} />
              <Tile
                k="MEDICINES"
                v={`${s.meds.given} / ${s.meds.scheduled} given`}
                sub={s.meds.scheduled === 0 ? 'none scheduled' : s.meds.missed ? `${s.meds.missed} missed` : 'none missed'}
                alert={s.meds.missed > 0}
              />
              <Tile k="TUMMY TIME" v={`${s.tummy.minutes} min`} sub={s.tummy.goal ? `goal ${s.tummy.goal} min` : undefined} />
              <Tile
                k="SICK / REFLUX"
                v={s.sick.possets + s.sick.sick === 0 ? 'None' : [s.sick.possets ? `${s.sick.possets} posset${s.sick.possets === 1 ? '' : 's'}` : '', s.sick.sick ? `${s.sick.sick} sick` : ''].filter(Boolean).join(' · ')}
                sub={s.sick.large ? `${s.sick.large} large` : 'no large vomits'}
                alert={s.sick.large > 0}
              />
              {s.weight && <Tile k="WEIGHT" v={formatKg(s.weight.weight_g)} sub="weighed this day" />}
            </section>

            <Card className="flex flex-col gap-2 px-4 py-3.5">
              <div className="flex items-baseline justify-between">
                <h2 className="m-0 text-lg font-bold">Feeds through the day</h2>
                <span className="flex gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
                    Mouth
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[#B7CEDB]" />
                    Tube
                  </span>
                </span>
              </div>
              {s.bars.length ? <FeedChart bars={s.bars} /> : <EmptyNote>No feeds logged.</EmptyNote>}
            </Card>

            <Card className={`flex items-center gap-3 px-4 py-3 ${s.obs.flagged ? 'border-alert' : ''}`}>
              <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${s.obs.flagged ? 'bg-alert' : 'bg-obs-accent'}`} />
              <span className="flex flex-1 flex-col">
                <span className="text-sm font-extrabold">
                  {s.obs.count === 0 ? 'No obs logged' : `Obs: ${s.obs.normal} of ${s.obs.count} normal`}
                  {s.obs.flagged ? ` · ${s.obs.flagged} highlighted` : ''}
                </span>
                {s.obs.tempMin !== null && (
                  <span className="text-xs text-ink-muted">
                    {s.obs.tempMin === s.obs.tempMax ? `${s.obs.tempMin.toFixed(1)} °C` : `${s.obs.tempMin.toFixed(1)}–${s.obs.tempMax!.toFixed(1)} °C`}
                  </span>
                )}
              </span>
            </Card>

            <section aria-labelledby="notes" className="flex flex-col gap-2">
              <h2 id="notes" className="m-0 text-lg font-bold">
                Notes
              </h2>
              {logs.data!.notes.length === 0 ? (
                <EmptyNote>No notes this day.</EmptyNote>
              ) : (
                [...logs.data!.notes].reverse().map((n) => {
                  const m = who(n.logged_by)
                  return (
                    <Card key={n.id} className="flex flex-col gap-1 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-ink-muted">{ukParts(n.logged_at).time}</span>
                        {m && <NamePill member={m} />}
                      </div>
                      <p className="m-0 text-sm">{n.text}</p>
                    </Card>
                  )
                })
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
