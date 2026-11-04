import { useEffect, useRef } from 'react'
import { formatNumber } from '../lib/ukTime'

type Props = {
  /** Spoken name, e.g. "Dose" or "06:00 feed amount". */
  label: string
  value: number
  onChange: (value: number) => void
  step: number
  /** Press-and-hold step, e.g. 1 ml for feeds or 0.1 ml for doses. */
  fineStep?: number
  min?: number
  max?: number
  unit?: string
  readOnly?: boolean
  size?: 'sm' | 'md'
}

const HOLD_MS = 450
const REPEAT_MS = 180

const round = (n: number) => Math.round(n * 100) / 100

/**
 * −/+ stepper (no keyboard). Tap moves by `step`; press and hold moves by
 * `fineStep`, repeating while held.
 */
export function AmountStepper({ label, value, onChange, step, fineStep, min = 0, max = 9999, unit = 'ml', readOnly, size = 'md' }: Props) {
  const valueRef = useRef(value)
  useEffect(() => {
    valueRef.current = value
  })
  const timers = useRef<{ hold?: number; repeat?: number; held: boolean }>({ held: false })

  const clamp = (n: number) => round(Math.min(max, Math.max(min, n)))
  const bump = (by: number) => {
    const next = clamp(valueRef.current + by)
    valueRef.current = next
    onChange(next)
  }
  const stop = () => {
    window.clearTimeout(timers.current.hold)
    window.clearInterval(timers.current.repeat)
  }
  useEffect(() => stop, [])

  const text = `${formatNumber(value)} ${unit}`
  if (readOnly) {
    return <span className="font-display text-lg font-extrabold">{text}</span>
  }

  const btn = size === 'sm' ? 'h-9 w-9 text-lg' : 'h-11 w-11 text-xl'
  const handlers = (dir: 1 | -1) => ({
    onPointerDown: () => {
      timers.current.held = false
      if (!fineStep) return
      timers.current.hold = window.setTimeout(() => {
        timers.current.held = true
        bump(dir * fineStep)
        timers.current.repeat = window.setInterval(() => bump(dir * fineStep), REPEAT_MS)
      }, HOLD_MS)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (timers.current.held) {
        timers.current.held = false
        return
      }
      bump(dir * step)
    },
  })

  const fine = fineStep ? `, hold for ${formatNumber(fineStep)} ${unit}` : ''
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${formatNumber(step)} ${unit} less${fine}`}
        disabled={value <= min}
        className={`${btn} flex shrink-0 touch-manipulation items-center justify-center rounded-full bg-line-soft font-extrabold text-ink select-none disabled:opacity-40`}
        {...handlers(-1)}
      >
        −
      </button>
      <output
        aria-live="polite"
        className={`${size === 'sm' ? 'min-w-[60px] text-lg' : 'min-w-[84px] text-2xl'} text-center font-display font-extrabold`}
      >
        {text}
      </output>
      <button
        type="button"
        aria-label={`${formatNumber(step)} ${unit} more${fine}`}
        disabled={value >= max}
        className={`${btn} flex shrink-0 touch-manipulation items-center justify-center rounded-full bg-line-soft font-extrabold text-ink select-none disabled:opacity-40`}
        {...handlers(1)}
      >
        +
      </button>
    </div>
  )
}
