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

type Payload = { kind: 'reminder' | 'done' | 'test'; title: string; body?: string; url?: string; tag?: string; silent?: boolean }

const BASE = new URL(self.registration.scope).pathname

self.addEventListener('push', (event) => {
  let p: Payload
  try {
    p = event.data?.json() as Payload
  } catch {
    p = { kind: 'reminder', title: "Bella's Safari", body: event.data?.text() }
  }
  // "done" replaces the earlier reminder with the same tag, quietly.
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      tag: p.tag,
      silent: !!p.silent,
      icon: `${BASE}pwa-192.png`,
      badge: `${BASE}pwa-192.png`,
      data: { url: p.url ?? '#/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
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
