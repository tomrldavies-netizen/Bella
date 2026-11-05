import { useState } from 'react'
import { Zebra } from '../animals'
import { Card } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { ScreenHeader } from '../components/ScreenHeader'
import { useReadyHousehold } from '../household/HouseholdContext'

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

type Keys = { publicKey: string; privateKey: string; cronSecret: string }

/** Makes the push (VAPID) key pair in this browser, so the private key never passes through anyone else. */
async function makeKeys(): Promise<Keys> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const cronSecret = b64url(crypto.getRandomValues(new Uint8Array(24)))
  return { publicKey, privateKey: jwk.d!, cronSecret }
}

function Row({ name, value, where, secret }: { name: string; value: string; where: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1 border-b border-line-soft py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[13px] font-bold">{name}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(value)
            setCopied(true)
          }}
          className="h-9 rounded-full border-[1.5px] border-line bg-card px-3 text-xs font-extrabold"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code className={`rounded-lg bg-field p-2 text-xs break-all ${secret ? 'text-alert' : ''}`}>{value}</code>
      <span className="text-xs text-ink-muted">{where}</span>
    </div>
  )
}

export function ReminderKeys() {
  const { me } = useReadyHousehold()
  const [keys, setKeys] = useState<Keys | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <ScreenHeader title="Reminder keys" subtitle="One-off setup for push reminders" tint="bg-plan" guide={<Zebra size={56} />} back={{ to: '/bellas-plan/family', label: 'Family & sharing' }} />
      <div className="flex flex-col gap-3 px-4 pt-3.5 pb-6 md:max-w-3xl md:px-7">
        {me.role !== 'parent' ? (
          <ErrorNote>Only parents set up reminders.</ErrorNote>
        ) : (
          <>
            <Card className="flex flex-col gap-2 px-4 py-3.5 text-sm">
              <p className="m-0">
                This makes the keys that let Supabase send reminders to your phones. They're made here, on this device, and aren't sent anywhere.
              </p>
              <p className="m-0 font-bold">Do this once, on a computer if you can (copying is easier), with the reminders setup guide open beside it.</p>
              <p className="m-0 text-ink-muted">Making new keys later means everyone has to turn reminders on again.</p>
              {error && <ErrorNote>{error}</ErrorNote>}
              {!keys && (
                <button
                  type="button"
                  onClick={() => makeKeys().then(setKeys, (e) => setError(e instanceof Error ? e.message : String(e)))}
                  className="h-12 rounded-full bg-primary font-extrabold text-white"
                >
                  Make the keys
                </button>
              )}
            </Card>
            {keys && (
              <Card className="flex flex-col px-4 py-1.5">
                <Row name="VAPID_PUBLIC_KEY" value={keys.publicKey} where="Supabase Edge Function secret, and GitHub secret VITE_VAPID_PUBLIC_KEY. This one is safe to share." />
                <Row name="VAPID_PRIVATE_KEY" value={keys.privateKey} where="Supabase Edge Function secret only. Never put it in GitHub or send it to anyone." secret />
                <Row name="CRON_SECRET" value={keys.cronSecret} where="Supabase Edge Function secret, and the x-cron-secret header of the Cron job." secret />
              </Card>
            )}
          </>
        )}
      </div>
    </>
  )
}
