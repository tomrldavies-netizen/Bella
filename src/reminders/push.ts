import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type PushState = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? ''

export const pushConfigured = () => VAPID.length > 0

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}
function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

/** Can this phone get reminders, and are they on? */
export async function pushState(): Promise<PushState> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // iPhone only offers push to apps opened from the Home Screen.
    return isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Asks permission (must follow a tap), subscribes this phone and saves it for this person. */
export async function turnOnPush(householdId: string, memberId: string): Promise<PushState> {
  if (!supabase) throw new Error('Not connected')
  if (!VAPID) throw new Error('Reminders aren’t set up yet (the VAPID public key is missing).')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }))
  const json = sub.toJSON()
  // One row per phone. Replace any older row for this phone (e.g. after signing in as someone else).
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  const { error } = await supabase
    .from('push_subscriptions')
    .insert({ household_id: householdId, member_id: memberId, endpoint: sub.endpoint, keys: json.keys ?? {} })
  if (error) throw new Error(error.message)
  return 'on'
}

export async function turnOffPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Asks the server to send a test notification to this person's phones. */
export async function sendTest(): Promise<string> {
  if (!supabase) throw new Error('Not connected')
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { test: true } })
  if (error) throw new Error(await explainFunctionError(error))
  const r = data as { sent?: number; error?: string }
  if (r.error) throw new Error(r.error)
  return `Sent to ${r.sent} phone${r.sent === 1 ? '' : 's'}`
}

export async function saveReminderSettings(householdId: string, settings: object) {
  if (!supabase) throw new Error('Not connected')
  const { error } = await supabase.rpc('update_my_reminders', { p_household: householdId, p_settings: settings })
  if (error) throw new Error(error.message)
}

/** When the app is opened, tidy away notifications already on the phone. */
export function clearNotificationsOnOpen() {
  if (!('serviceWorker' in navigator)) return
  const clear = () => document.visibilityState === 'visible' && navigator.serviceWorker.controller?.postMessage('clear-notifications')
  clear()
  document.addEventListener('visibilitychange', clear)
}

/** Plain-English reasons for the usual set-up problems with the send-reminders function. */
export async function explainFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response
    let detail = ''
    try {
      const body = await res.clone().json()
      detail = body.error ?? body.msg ?? body.message ?? ''
    } catch {
      detail = await res.text().catch(() => '')
    }
    if (res.status === 404) return 'The send-reminders function wasn’t found. Check it’s deployed with exactly that name.'
    if (res.status === 401 && /jwt|authorization/i.test(detail) && !/Not allowed/.test(detail))
      return 'The send-reminders function has “Enforce JWT verification” turned on. Turn it off in its settings.'
    return `The reminders server said: ${detail || `error ${res.status}`}`
  }
  if (error instanceof FunctionsRelayError) return 'Supabase couldn’t start the send-reminders function. Check its Logs for a boot error.'
  if (error instanceof FunctionsFetchError)
    return 'Couldn’t reach the send-reminders function. Usually this means “Enforce JWT verification” is still on, it isn’t deployed with exactly that name, or it failed to start (see its Logs in Supabase).'
  return error instanceof Error ? error.message : String(error)
}
