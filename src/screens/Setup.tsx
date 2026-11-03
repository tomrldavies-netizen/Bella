import { useState, type FormEvent } from 'react'
import { Card } from '../components/Card'
import { MEMBER_COLOURS } from '../data/colours'
import { ErrorNote, Field, inputClass, primaryButtonClass } from '../components/Field'
import { Stepper } from '../components/Stepper'
import { useHousehold } from '../household/HouseholdContext'
import { dueDateFrom, ukToday } from '../lib/age'
import { WelcomeLayout } from './WelcomeLayout'

/** "Tuesday 10 November 2026" (no comma, matching the rest of the app). */
function longDate(iso: string) {
  const d = new Date(iso + 'T12:00:00Z')
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
  const rest = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  return `${weekday} ${rest}`
}

/** First run: the signed-in parent creates the household and enters Bella's details. */
export function Setup() {
  const { createHousehold } = useHousehold()
  const today = ukToday()
  const [displayName, setDisplayName] = useState('')
  const [colour, setColour] = useState<string>(MEMBER_COLOURS[1].hex)
  const [babyName, setBabyName] = useState('Bella')
  const [birthDate, setBirthDate] = useState('')
  const [weeks, setWeeks] = useState(32)
  const [days, setDays] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dueDate = birthDate ? dueDateFrom(birthDate, weeks, days) : null
  const birthInFuture = birthDate > today
  const canSave = displayName.trim() && babyName.trim() && birthDate && !birthInFuture && !busy

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!dueDate || !canSave) return
    setBusy(true)
    setError(null)
    const err = await createHousehold({
      displayName: displayName.trim(),
      colour,
      babyName: babyName.trim(),
      birthDate,
      gestationWeeks: weeks,
      gestationDays: days,
      dueDate,
    })
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <WelcomeLayout title="Welcome" subtitle="Let's set up Bella's safari">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4 px-4 py-4">
          <h2 className="m-0 text-xl font-bold">About you</h2>
          <Field label="Your name" hint="As everyone will see it, e.g. Dad.">
            <input
              required
              maxLength={40}
              autoComplete="nickname"
              className={inputClass}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1.5 p-0 text-sm font-extrabold">Your colour</legend>
            <div className="grid grid-cols-4 gap-2">
              {MEMBER_COLOURS.map((c) => (
                <label
                  key={c.hex}
                  className={`flex min-h-12 cursor-pointer items-center justify-center rounded-[14px] border-2 text-sm font-bold ${
                    colour === c.hex ? 'border-primary' : 'border-transparent'
                  }`}
                  style={{ background: c.hex }}
                >
                  <input
                    type="radio"
                    name="colour"
                    value={c.hex}
                    checked={colour === c.hex}
                    onChange={() => setColour(c.hex)}
                    className="sr-only"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="m-0 text-[13px] text-ink-muted">
            You'll be a parent: you can change Bella's plan and invite family later.
          </p>
        </Card>

        <Card className="flex flex-col gap-4 px-4 py-4">
          <h2 className="m-0 text-xl font-bold">About Bella</h2>
          <Field label="Her name">
            <input
              required
              maxLength={40}
              className={inputClass}
              value={babyName}
              onChange={(e) => setBabyName(e.target.value)}
            />
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              required
              max={today}
              className={inputClass}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>
          {birthInFuture && <ErrorNote>The date of birth can't be in the future.</ErrorNote>}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-extrabold">Born at</span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Stepper label="Weeks" value={weeks} min={22} max={42} unit="wks" onChange={setWeeks} />
              <Stepper label="Days" value={days} min={0} max={6} unit="days" onChange={setDays} />
            </div>
            <span className="text-[13px] text-ink-muted">
              Weeks and days of pregnancy when she was born, e.g. 31 wks 2 days for 31+2.
            </span>
          </div>
          {dueDate && (
            <div className="rounded-[14px] bg-growth px-3.5 py-2.5 text-sm">
              <span className="font-extrabold">Due date: </span>
              {longDate(dueDate)}
            </div>
          )}
        </Card>

        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" className={primaryButtonClass} disabled={!canSave}>
          {busy ? 'Setting up…' : "Start Bella's safari"}
        </button>
      </form>
    </WelcomeLayout>
  )
}
