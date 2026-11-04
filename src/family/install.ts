export type Platform = 'ios' | 'android' | 'other'

/** iPhone/iPad (including iPadOS, which reports itself as a Mac), Android, or something else. */
export function detectPlatform(ua: string = navigator.userAgent, touchPoints: number = navigator.maxTouchPoints ?? 0): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}

/** Opened from the home screen (installed) rather than in the browser. */
export function isInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

export const INSTALL_STEPS: Record<'ios' | 'android', string[]> = {
  ios: ['Open the link in Safari', 'Tap Share, then Add to Home Screen', 'Open it from the Home Screen and allow alerts'],
  android: ['Open the link in Chrome', 'Tap Install app (or menu ⋮, Add to Home screen)', 'Allow alerts'],
}

const SEEN = 'bella.installHelpSeen'
export function installHelpSeen(): boolean {
  try {
    return localStorage.getItem(SEEN) === '1'
  } catch {
    return true
  }
}
export function markInstallHelpSeen() {
  try {
    localStorage.setItem(SEEN, '1')
  } catch {
    // ignore
  }
}
