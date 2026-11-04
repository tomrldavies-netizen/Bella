import { useState } from 'react'
import { AmountStepper } from '../../components/AmountStepper'
import { Card } from '../../components/Card'
import { ErrorNote } from '../../components/Field'
import { fieldClass } from '../../components/PlanEditLayout'
import { useLiveQuery } from '../../lib/useLiveQuery'
import { shortDate, ukNow, ukParts, ukToIso } from '../../lib/ukTime'
import { loadPrescriptions, openBottle, updatePrescription } from '../../organise/api'
import { currentPrescription, prescriptionStatus } from '../../organise/prescriptions'
import type { Medicine } from '../../plan/api'

const label = 'text-[13px] font-extrabold'

/**
 * Bottle size, when it was opened and when to warn about reordering, for one
 * medicine. Saved on its own (it isn't a change to the dose plan).
 */
export function PrescriptionCard({ householdId, medicine, readOnly }: { householdId: string; medicine: Medicine; readOnly: boolean }) {
  const q = useLiveQuery(householdId, ['prescriptions'], loadPrescriptions)
  if (!q.data) return null
  const rx = currentPrescription(q.data, medicine.id)
  return <Editor key={rx?.id ?? 'none'} householdId={householdId} medicine={medicine} readOnly={readOnly} rx={rx} onSaved={q.reload} />
}

function Editor({
  householdId,
  medicine,
  readOnly,
  rx,
  onSaved,
}: {
  householdId: string
  medicine: Medicine
  readOnly: boolean
  rx: ReturnType<typeof currentPrescription>
  onSaved: () => void
}) {
  const today = ukNow().date
  const [bottle, setBottle] = useState(rx?.bottle_volume ?? 0)
  const [opened, setOpened] = useState(rx ? ukParts(rx.opened_at).date : today)
  const [warnDays, setWarnDays] = useState(rx?.reorder_threshold_days ?? 7)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const status = rx ? prescriptionStatus({ ...rx, bottle_volume: bottle, opened_at: ukToIso(opened, '12:00'), reorder_threshold_days: warnDays }, medicine, today) : null
  const dirty = !rx ? bottle > 0 : bottle !== rx.bottle_volume || opened !== ukParts(rx.opened_at).date || warnDays !== rx.reorder_threshold_days

  if (readOnly) {
    return rx ? (
      <Card className="flex flex-col gap-0.5 px-4 py-3">
        <span className={label}>Prescription</span>
        <span className="text-sm">
          {rx.bottle_volume} ml bottle, opened {shortDate(ukParts(rx.opened_at).date)}
          {status ? ` · about ${status.daysLeft} days left` : ''}
        </span>
      </Card>
    ) : null
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (rx) await updatePrescription(rx.id, { bottle_volume: bottle, opened_at: ukToIso(opened, '12:00'), reorder_threshold_days: warnDays })
      else await openBottle(householdId, medicine.id, bottle, warnDays, ukToIso(opened, '12:00'))
      setSaved(true)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 px-4 py-3.5">
      <div className="flex flex-col">
        <span className="text-base font-extrabold">Prescription</span>
        <span className="text-xs text-ink-muted">For the "days left" estimate and reorder reminder.</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={label}>Bottle size</span>
        <AmountStepper label="Bottle size" value={bottle} onChange={setBottle} step={5} fineStep={1} max={1000} size="sm" />
      </div>
      <label className="flex items-center justify-between gap-2">
        <span className={label}>Opened</span>
        <input type="date" value={opened} max={today} onChange={(e) => e.target.value && setOpened(e.target.value)} className={`${fieldClass} !w-44`} />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-col">
          <span className={label}>Warn me to reorder</span>
          <span className="text-xs text-ink-muted">days before it runs out</span>
        </span>
        <AmountStepper label="Reorder warning" value={warnDays} onChange={setWarnDays} step={1} max={60} unit="days" size="sm" />
      </div>
      {status && <p className={`m-0 text-sm font-bold ${status.low ? 'text-alert' : ''}`}>About {status.daysLeft} days left at the planned dose.</p>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {saved && !dirty && <p className="m-0 text-sm font-bold text-primary">Prescription saved.</p>}
      <button type="button" disabled={busy || !dirty || bottle <= 0} onClick={save} className="h-11 rounded-full border-[1.5px] border-meds-accent bg-meds text-sm font-extrabold disabled:opacity-50">
        {rx ? 'Save prescription' : 'Add prescription'}
      </button>
    </Card>
  )
}
