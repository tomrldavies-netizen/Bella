/** Shown wherever something needs signal (plan edits, invites, photos). */
export const OFFLINE_MESSAGE = "You're offline. Try again when you have signal."

/** Fetch failures (no signal, DNS, dropped connection) as opposed to the server saying no. */
export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  return (
    msg.includes(OFFLINE_MESSAGE) ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|the internet connection appears to be offline/i.test(msg)
  )
}

/** A friendly message for any error from the database. */
export function friendlyError(message: string): string {
  return isNetworkError(message) ? OFFLINE_MESSAGE : message
}

/** fetch() that turns a lost connection into the friendly offline message. */
export const offlineAwareFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new TypeError(OFFLINE_MESSAGE)
  }
}
