import { useCallback, useState } from 'react'
import { Giraffe } from '../animals'
import { addLog, deleteLog, loadWeights, updateLog } from '../care/api'
import type { WeightLog } from '../care/types'
import { BottomSheet, Toast } from '../components/BottomSheet'
import { Card, EmptyNote } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { fieldClass } from '../components/PlanEditLayout'
import { ScreenHeader } from '../components/ScreenHeader'
import { ageCards, chartPoints, chartScale, formatKg, pmaDays, signedGrams, weightGain, type ChartPoint } from '../growth/growth'
import { useReadyHousehold } from '../household/HouseholdContext'
import { useLiveQuery } from '../lib/useLiveQuery'
import { useNow } from '../lib/useNow'
import { shortDate, ukNow } from '../lib/ukTime'

const label = 'text-[13px] font-extrabold'

/** Bella's weights by post-menstrual age. No centile lines until official reference data is added. */
function GrowthChart({ points, todayWeeks, birthWeeks }: { points: ChartPoint[]; todayWeeks: number; birthWeeks: number }) {
  const W = 380
  const H = 210
  const L = 40
  const R = 340
  const T = 20
  const B = 180
  const { minW, maxW, minK, maxK } = chartScale(points, todayWeeks, birthWeeks)
  const x = (w: number) => L + ((w - minW) / (maxW - minW)) * (R - L)
  const y = (k: number) => B - ((k - minK) / (maxK - minK)) * (B - T)
  const xTicks = Array.from({ length: Math.floor((maxW - minW) / 2) + 1 }, (_, i) => minW + i * 2)
  const kStep = maxK - minK > 3 ? 1 : 0.5
  const yTicks = Array.from({ length: Math.floor((maxK - minK) / kStep) + 1 }, (_, i) => minK + i * kStep)
  const latest = points[points.length - 1]
  const summary = latest ? `Bella's weight: ${points.length} weigh-ins, latest ${latest.kg.toFixed(2)} kg at ${Math.floor(latest.weeks)} weeks post-menstrual age.` : 'No weigh-ins yet.'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={summary} className="block">
      {yTicks.map((k) => (
        <g key={k}>
          <line x1={L} x2={R} y1={y(k)} y2={y(k)} stroke="#F3EADC" strokeWidth="1" />
          <text x={L - 6} y={y(k) + 4} textAnchor="end" fontFamily="Nunito, sans-serif" fontSize="11" fill="#5C5146">
            {Number.isInteger(k) ? k : k.toFixed(1)}
          </text>
        </g>
      ))}
      {xTicks.map((w) => (
        <text key={w} x={x(w)} y={198} textAnchor="middle" fontFamily="Nunito, sans-serif" fontSize="11" fill="#5C5146">
          {w === 40 ? '40 wks' : w}
        </text>
      ))}
      {40 <= maxW && <line x1={x(40)} x2={x(40)} y1={T} y2={B} stroke="#D9B45A" strokeWidth="1" strokeDasharray="2 3" />}
      <line x1={x(todayWeeks)} x2={x(todayWeeks)} y1={T} y2={B} stroke="#7FA9C1" strokeWidth="1" strokeDasharray="3 3" />
      {points.length > 1 && (
        <polyline points={points.map((p) => `${x(p.weeks)},${y(p.kg)}`).join(' ')} fill="none" stroke="#3F6B4B" strokeWidth="2.5" strokeLinejoin="round" />
      )}
      {points.map((p, i) => (
        <circle
          key={p.date}
          cx={x(p.weeks)}
          cy={y(p.kg)}
          r={i === points.length - 1 ? 6 : 4}
          fill="#3F6B4B"
          stroke={i === points.length - 1 ? '#FFFFFF' : 'none'}
          strokeWidth="2"
        />
      ))}
    </svg>
  )
}

function WeighInSheet({
  existing,
  lastGrams,
  householdId,
  onDone,
  onClose,
}: {
  existing: WeightLog | null
  lastGrams: number | null
  householdId: string
  onDone: (msg: string) => void
  onClose: () => void
}) {
  const today = ukNow().date
  const [date, setDate] = useState(existing?.measured_on ?? today)
  const [grams, setGrams] = useState(existing ? String(existing.weight_g) : '')
  const [length, setLength] = useState(existing?.length_cm ? String(existing.length_cm) : '')
  const [head, setHead] = useState(existing?.head_cm ? String(existing.head_cm) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const g = Number(grams)
  const validWeight = Number.isInteger(g) && g >= 200 && g <= 30000
  const optional = (v: string) => (v.trim() === '' ? null : Number(v))
  const badOptional = [length, head].some((v) => v.trim() !== '' && !(Number(v) > 0))
  const bump = (by: number) => setGrams(String(Math.max(0, (Number(grams) || lastGrams || 0) + by)))

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const row = { measured_on: date, weight_g: g, length_cm: optional(length), head_cm: optional(head) }
      if (existing) await updateLog('weights', existing.id, row)
      else await addLog('weights', householdId, row)
      onDone(existing ? 'Weigh-in updated' : `Weigh-in saved · ${formatKg(g)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <BottomSheet title={existing ? 'Edit weigh-in' : 'Add weigh-in'} onClose={onClose}>
      <label className="flex items-center justify-between gap-2">
        <span className={label}>Date</span>
        <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${fieldClass} w-44`} />
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="weight-g" className={label}>
          Weight (grams)
        </label>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="10 g less" onClick={() => bump(-10)} className="h-11 w-11 shrink-0 rounded-full bg-line-soft text-xl font-extrabold">
            −
          </button>
          <input
            id="weight-g"
            inputMode="numeric"
            value={grams}
            placeholder={lastGrams ? String(lastGrams) : 'e.g. 2310'}
            onChange={(e) => setGrams(e.target.value.replace(/[^0-9]/g, ''))}
            className={`${fieldClass} text-center font-display text-2xl font-extrabold`}
          />
          <button type="button" aria-label="10 g more" onClick={() => bump(10)} className="h-11 w-11 shrink-0 rounded-full bg-line-soft text-xl font-extrabold">
            +
          </button>
        </div>
        <span className="text-xs text-ink-muted">{validWeight ? `${formatKg(g)}${lastGrams && !existing ? ` · ${signedGrams(g - lastGrams)} since last` : ''}` : 'Type it, or use −/+ for 10 g steps.'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={label}>Length (cm)</span>
          <input inputMode="decimal" value={length} placeholder="Optional" onChange={(e) => setLength(e.target.value.replace(/[^0-9.]/g, ''))} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Head (cm)</span>
          <input inputMode="decimal" value={head} placeholder="Optional" onChange={(e) => setHead(e.target.value.replace(/[^0-9.]/g, ''))} className={fieldClass} />
        </label>
      </div>
      {grams && !validWeight && <ErrorNote>Enter the weight in grams, e.g. 2310.</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}
      <button type="button" disabled={busy || !validWeight || badOptional} onClick={save} className="h-12 rounded-full bg-primary font-extrabold text-white disabled:opacity-50">
        {busy ? 'Saving…' : existing ? 'Save changes' : 'Save weigh-in'}
      </button>
      {existing &&
        (confirmDelete ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)} className="h-11 flex-1 rounded-full border-[1.5px] border-line bg-card text-sm font-extrabold">
              Keep it
            </button>
            <button
              type="button"
              onClick={async () => {
                await deleteLog('weights', existing.id)
                onDone('Weigh-in deleted')
              }}
              className="h-11 flex-1 rounded-full bg-alert text-sm font-extrabold text-white"
            >
              Delete
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 text-sm font-extrabold text-alert">
            Delete weigh-in
          </button>
        ))}
    </BottomSheet>
  )
}

export function Growth() {
  const { household, baby } = useReadyHousehold()
  const now = useNow()
  const today = ukNow(now).date
  const q = useLiveQuery(household.id, ['weights'], loadWeights)
  const [sheet, setSheet] = useState<WeightLog | 'new' | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [setToast])

  const weights = q.data ?? []
  const latest = weights[weights.length - 1] ?? null
  const gain = weightGain(weights)
  const cards = ageCards(baby.birth_date, baby.gestation_weeks, baby.gestation_days, baby.due_date, today)
  const points = chartPoints(weights, baby.birth_date, baby.gestation_weeks, baby.gestation_days)
  const todayWeeks = pmaDays(baby.birth_date, baby.gestation_weeks, baby.gestation_days, today) / 7
  const birthWeeks = baby.gestation_weeks + baby.gestation_days / 7

  return (
    <>
      <ScreenHeader
        title="Growth"
        subtitle={latest ? `Last weighed ${shortDate(latest.measured_on)}` : 'No weigh-ins yet'}
        tint="bg-growth"
        guide={<Giraffe size={56} />}
        action={
          <button type="button" onClick={() => setSheet('new')} className="min-h-11 rounded-full bg-card px-3 text-xs font-extrabold text-ink">
            Add weigh-in
          </button>
        }
      />
      <div className="flex flex-col gap-3 px-4 pt-3.5 md:max-w-3xl md:px-7">
        {q.error && <ErrorNote>Couldn't load weigh-ins: {q.error}</ErrorNote>}
        <section className="grid grid-cols-3 gap-2">
          {[
            ['ACTUAL AGE', cards.actual],
            [cards.correctedLabel, cards.corrected],
            ['DUE DATE', cards.due],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 rounded-2xl border-[1.5px] border-line bg-card px-2.5 py-2.5">
              <span className="text-[11px] font-extrabold text-ink-deep">{k}</span>
              <span className="font-display text-lg leading-tight font-extrabold">{v}</span>
            </div>
          ))}
        </section>

        <Card className="flex flex-col gap-2 px-4 py-3.5">
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col">
              <span className={label}>Weight</span>
              <span className="font-display text-[30px] leading-none font-extrabold">{latest ? formatKg(latest.weight_g) : '—'}</span>
            </div>
            {gain && (
              <div className="flex flex-col items-end text-right">
                <span className="text-sm font-extrabold">
                  {signedGrams(gain.grams)} {gain.weekly ? 'this week' : `since ${shortDate(gain.since)}`}
                </span>
                <span className="text-xs text-ink-muted">about {gain.perDay} g a day</span>
              </div>
            )}
          </div>
          {q.data && weights.length === 0 ? (
            <EmptyNote>Add Bella's weigh-ins to see them on the chart.</EmptyNote>
          ) : (
            <GrowthChart points={points} todayWeeks={todayWeeks} birthWeeks={birthWeeks} />
          )}
          <span className="text-xs text-ink-muted">
            kg by post-menstrual weeks · blue line is today · centile lines will be added once the official preterm reference data is set up
          </span>
        </Card>

        {weights.length > 0 && (
          <section aria-labelledby="weigh-ins" className="flex flex-col gap-2">
            <h2 id="weigh-ins" className="m-0 text-xl font-bold">
              Weigh-ins
            </h2>
            <Card className="flex flex-col px-3.5 py-1">
              {[...weights].reverse().map((w, i, all) => {
                const prev = all[i + 1]
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSheet(w)}
                    className="flex min-h-12 items-center gap-2.5 border-b border-line-soft py-1.5 text-left last:border-b-0"
                  >
                    <span className="w-[56px] shrink-0 text-[13px] font-extrabold">{shortDate(w.measured_on)}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      {formatKg(w.weight_g)}
                      {w.length_cm ? ` · ${w.length_cm} cm long` : ''}
                      {w.head_cm ? ` · head ${w.head_cm} cm` : ''}
                    </span>
                    {prev && <span className="shrink-0 text-xs font-bold text-ink-muted">{signedGrams(w.weight_g - prev.weight_g)}</span>}
                  </button>
                )
              })}
            </Card>
          </section>
        )}
        <p className="m-0 text-xs text-ink-muted">Bella's firsts are coming in a later update.</p>
      </div>

      {sheet && (
        <WeighInSheet
          existing={sheet === 'new' ? null : sheet}
          lastGrams={latest?.weight_g ?? null}
          householdId={household.id}
          onClose={() => setSheet(null)}
          onDone={(msg) => {
            setSheet(null)
            setToast(msg)
            q.reload()
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}
