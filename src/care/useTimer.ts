import { useCallback, useEffect, useState } from 'react'

/** A start/pause timer kept on this phone only, surviving app restarts. */
type TimerState = { startedAt: string; pausedAt: string | null; pausedMs: number }

function read(key: string): TimerState | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as TimerState) : null
  } catch {
    return null
  }
}

function write(key: string, s: TimerState | null) {
  try {
    if (s) localStorage.setItem(key, JSON.stringify(s))
    else localStorage.removeItem(key)
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
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function useTimer(key: string) {
  const [state, setState] = useState<TimerState | null>(() => read(key))
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!state || state.pausedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [state])

  const update = useCallback(
    (s: TimerState | null) => {
      write(key, s)
      setState(s)
      setNow(Date.now())
    },
    [key],
  )

  return {
    running: !!state && !state.pausedAt,
    paused: !!state?.pausedAt,
    startedAt: state?.startedAt ?? null,
    elapsed: state ? elapsedMs(state, now) : 0,
    start: () => update({ startedAt: new Date().toISOString(), pausedAt: null, pausedMs: 0 }),
    pause: () => state && !state.pausedAt && update({ ...state, pausedAt: new Date().toISOString() }),
    resume: () =>
      state?.pausedAt && update({ ...state, pausedAt: null, pausedMs: state.pausedMs + (Date.now() - Date.parse(state.pausedAt)) }),
    clear: () => update(null),
  }
}
