/// <reference lib="webworker" />
// Service worker: offline app shell (precache) plus push reminders.
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts', plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })] }),
)

// New versions take over straight away (same behaviour as before).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

type Payload = {
  kind: 'reminder' | 'alarm' | 'done' | 'test'
  title: string
  body?: string
  url?: string
  tag?: string
  silent?: boolean
  /** For Stop / Snooze buttons on alarm notifications (works without signing in). */
  alarm_token?: string
}

// Supabase address and public key, for the Stop / Snooze buttons.
const SUPABASE_URL = (() => {
  try {
    return new URL(String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()).origin
  } catch {
    return ''
  }
})()
const ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

async function alarmAction(token: string, action: 'stop' | 'snooze') {
  if (!SUPABASE_URL || !ANON_KEY) return
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/alarm_action`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_action: action }),
  }).catch(() => {})
}

const BASE = new URL(self.registration.scope).pathname

self.addEventListener('push', (event) => {
  let p: Payload
  try {
    p = event.data?.json() as Payload
  } catch {
    p = { kind: 'reminder', title: "Bella's Safari", body: event.data?.text() }
  }
  // "done" replaces the earlier reminder with the same tag, quietly.
  // "alarm" stays on screen, buzzes hard and re-alerts each time it repeats
  // (vibration and buttons work on Android; iPhone shows it as a normal notification).
  const alarm = p.kind === 'alarm'
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[]; actions?: { action: string; title: string }[]; requireInteraction?: boolean } = {
    body: p.body,
    tag: p.tag,
    silent: !!p.silent,
    icon: `${BASE}pwa-192.png`,
    badge: `${BASE}pwa-192.png`,
    data: { url: p.url ?? '#/', alarmToken: p.alarm_token ?? null },
  }
  if (alarm) {
    options.requireInteraction = true
    options.renotify = true
    options.vibrate = [600, 250, 600, 250, 600, 250, 1000]
    if (p.alarm_token) {
      options.actions = [
        { action: 'snooze', title: 'Snooze 5 min' },
        { action: 'stop', title: 'Stop' },
      ]
    }
  }
  event.waitUntil(self.registration.showNotification(p.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const token = event.notification.data?.alarmToken as string | null | undefined
  if (token && (event.action === 'stop' || event.action === 'snooze')) {
    event.waitUntil(alarmAction(token, event.action))
    return
  }
  const target = `${BASE}${(event.notification.data?.url as string | undefined) ?? '#/'}`
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = wins.find((w) => new URL(w.url).pathname.startsWith(BASE))
      if (open) {
        await open.focus()
        await open.navigate(target).catch(() => {})
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})

// The app asks to tidy notifications away when it's opened.
self.addEventListener('message', (event) => {
  if (event.data === 'clear-notifications') {
    event.waitUntil(self.registration.getNotifications().then((ns) => ns.forEach((n) => n.close())))
  }
})
