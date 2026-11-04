import { useCallback, useEffect, useState } from 'react'

/** Feed timer kept on this phone only (agreed: not shared between devices). */
type TimerState = { startedAt: string; pausedAt: string | null; pausedMs: number }

const KEY = 'bella.feedTimer'

function read(): TimerState | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TimerState) : null
  } catch {
    return null
  }
}

function write(s: TimerState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    // Private mode etc.: the timer still works until the app is closed.
  }
}

export function elapsedMs(s: TimerState, now: number): number {
  const end = s.pausedAt ? Date.parse(s.pausedAt) : now
  return Math.max(0, end - Date.parse(s.startedAt) - s.pausedMs)
}

/** "08:42" or "1:08:42" */
export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function useFeedTimer() {
  const [state, setState] = useState<TimerState | null>(read)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!state || state.pausedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [state])

  const update = useCallback((s: TimerState | null) => {
    write(s)
    setState(s)
    setNow(Date.now())
  }, [])

  return {
    running: !!state && !state.pausedAt,
    paused: !!state?.pausedAt,
    startedAt: state?.startedAt ?? null,
    elapsed: state ? elapsedMs(state, now) : 0,
    start: () => update({ startedAt: new Date().toISOString(), pausedAt: null, pausedMs: 0 }),
    pause: () => state && !state.pausedAt && update({ ...state, pausedAt: new Date().toISOString() }),
    resume: () =>
      state?.pausedAt && update({ ...state, pausedAt: null, pausedMs: state.pausedMs + (Date.now() - Date.parse(state.pausedAt)) }),
    /** Stops the timer, returning when it started and ended. */
    finish: (): { startedAt: string; endedAt: string } | null => {
      if (!state) return null
      const endedAt = state.pausedAt ?? new Date().toISOString()
      update(null)
      return { startedAt: state.startedAt, endedAt }
    },
    clear: () => update(null),
  }
}
