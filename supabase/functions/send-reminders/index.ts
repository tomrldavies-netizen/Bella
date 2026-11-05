// Bella's Safari: send-reminders Edge Function (Supabase, Deno).
//
// Two ways in:
//   1. Every minute from Supabase Cron, with the header  x-cron-secret: <CRON_SECRET>
//      → runs reminder_run() in the database and sends what it returns.
//   2. "Send a test" from the app, with the signed-in person's token
//      → sends a test notification to that person's own phones only.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com), CRON_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// Deploy with "Verify JWT" turned OFF (this function checks callers itself).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:bella-safari@example.com'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

type Target = { subscription_id: string; endpoint: string; keys: { p256dh: string; auth: string }; payload: Record<string, unknown> }

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function send(targets: Target[]) {
  let sent = 0
  let gone = 0
  const errors: string[] = []
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: t.keys }, JSON.stringify(t.payload), {
          TTL: 60 * 60,
          urgency: t.payload.kind === 'done' ? 'low' : 'high',
        })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          // The phone unsubscribed or the app was removed: forget it.
          gone++
          await admin.rpc('forget_subscription', { p_endpoint: t.endpoint })
        } else {
          errors.push(`${status ?? ''} ${(e as Error).message}`.trim())
        }
      }
    }),
  )
  return { sent, gone, errors }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  // Self-check: open the function's URL in a browser. Shows which secrets are set (never their values).
  if (req.method === 'GET') {
    return json({ ok: true, vapidPublicKey: !!VAPID_PUBLIC, vapidPrivateKey: !!VAPID_PRIVATE, vapidSubject: !!Deno.env.get('VAPID_SUBJECT'), cronSecret: !!CRON_SECRET })
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'VAPID keys are not set in Edge Function secrets' }, 500)
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  // 1. The every-minute run.
  if (CRON_SECRET && req.headers.get('x-cron-secret') === CRON_SECRET) {
    const { data, error } = await admin.rpc('reminder_run')
    if (error) return json({ error: error.message }, 500)
    const result = await send((data ?? []) as Target[])
    if (new Date().getUTCMinutes() === 0 && new Date().getUTCHours() === 3) await admin.rpc('reminder_cleanup')
    return json({ due: (data ?? []).length, ...result })
  }

  // 2. "Send a test" from the app: only to the caller's own phones.
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Not allowed' }, 401)
  const { data: who, error: authError } = await admin.auth.getUser(token)
  if (authError || !who.user) return json({ error: 'Not allowed' }, 401)
  const { data: members } = await admin.from('members').select('id').eq('user_id', who.user.id).eq('active', true)
  const ids = (members ?? []).map((m) => m.id)
  if (!ids.length) return json({ error: 'Not in a household' }, 403)
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, keys').in('member_id', ids)
  const targets: Target[] = (subs ?? []).map((s) => ({
    subscription_id: s.id,
    endpoint: s.endpoint,
    keys: s.keys,
    payload: { kind: 'test', title: "Bella's Safari", body: 'Reminders are working on this phone.', url: '#/', tag: `test:${Date.now()}`, silent: false },
  }))
  if (!targets.length) return json({ error: 'No phones with reminders turned on' }, 404)
  return json(await send(targets))
})
