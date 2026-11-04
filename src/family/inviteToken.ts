import { useCallback, useState } from 'react'

const KEY = 'bella.inviteToken'
const JOIN = /^#\/join\/([A-Za-z0-9]{16,128})\/?$/

/**
 * An invite link opens the app at #/join/<token>. Keep the token while the
 * person signs in (the page reloads around sign-in), then tidy the address.
 */
export function captureInviteToken(loc: Location = window.location): string | null {
  const m = JOIN.exec(loc.hash)
  try {
    if (m) {
      localStorage.setItem(KEY, m[1])
      window.history.replaceState(null, '', `${loc.pathname}${loc.search}#/`)
      return m[1]
    }
    return localStorage.getItem(KEY)
  } catch {
    return m?.[1] ?? null
  }
}

export function clearInviteToken() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function useInviteToken(): [string | null, () => void] {
  const [token, setToken] = useState(() => captureInviteToken())
  const clear = useCallback(() => {
    clearInviteToken()
    setToken(null)
  }, [])
  return [token, clear]
}
