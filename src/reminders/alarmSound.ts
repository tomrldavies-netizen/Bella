/**
 * A gentle-but-insistent two-tone alarm made with the Web Audio API (no sound
 * file), plus vibration where the phone supports it (Android). Browsers only
 * allow sound after the person has touched the page, so this may stay silent
 * until the first tap; the alarm screen still shows.
 */
let ctx: AudioContext | null = null
let timer: number | null = null

function beep(at: number, freq: number) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + 0.4)
}

export function startAlarmSound() {
  stopAlarmSound()
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC) {
      ctx = ctx ?? new AC()
      void ctx.resume()
    }
  } catch {
    ctx = null
  }
  const ring = () => {
    if (ctx) {
      const t = ctx.currentTime
      beep(t, 880)
      beep(t + 0.45, 660)
      beep(t + 0.9, 880)
    }
    navigator.vibrate?.([500, 200, 500, 200, 800])
  }
  ring()
  timer = window.setInterval(ring, 2500)
}

export function stopAlarmSound() {
  if (timer !== null) window.clearInterval(timer)
  timer = null
  navigator.vibrate?.(0)
}

/** A tap anywhere lets the browser play sound (needed after opening from a notification). */
export function unlockAlarmSound() {
  try {
    void ctx?.resume()
  } catch {
    // ignore
  }
}
