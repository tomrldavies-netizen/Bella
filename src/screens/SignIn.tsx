import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Card } from '../components/Card'
import { ErrorNote, Field, inputClass, primaryButtonClass } from '../components/Field'
import { invitePreview, type InvitePreview } from '../family/api'
import { WelcomeLayout } from './WelcomeLayout'

/** Shows who an invite is for, before signing in. */
export function InviteBanner({ preview }: { preview: InvitePreview }) {
  if (preview.status !== 'ok') {
    return (
      <p role="alert" className="m-0 rounded-2xl bg-meds px-4 py-3 text-sm font-bold text-alert">
        This invite {preview.status === 'used' ? 'has already been used' : 'has expired'}. Ask a parent to send a new one.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1 rounded-2xl border-[1.5px] border-banner-accent bg-banner px-4 py-3">
      <span className="font-display text-lg font-extrabold">
        {preview.display_name}, you've been invited{preview.baby_name ? ` to help with ${preview.baby_name}` : ''}
      </span>
      <span className="text-sm">
        As a {preview.role === 'parent' ? 'parent' : 'helper'}.{' '}
        {preview.email_hint ? `Sign in with the email the invite was sent to: ${preview.email_hint}` : ''}
      </span>
    </div>
  )
}

export function SignIn({ inviteToken = null }: { inviteToken?: string | null }) {
  const { sendCode, verifyCode } = useAuth()
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  useEffect(() => {
    if (!inviteToken) return
    invitePreview(inviteToken).then(setPreview, () => setPreview(null))
  }, [inviteToken])
  const newAccount = preview?.status === 'ok'
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  async function submitEmail(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await sendCode(email.trim(), { newAccount })
    setBusy(false)
    if (err) setError(err)
    else setStep('code')
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await verifyCode(email.trim(), code.replace(/\s/g, ''))
    setBusy(false)
    if (err) setError(err)
  }

  async function resend() {
    setBusy(true)
    setError(null)
    const err = await sendCode(email.trim(), { newAccount })
    setBusy(false)
    if (err) setError(err)
    else setResent(true)
  }

  return (
    <WelcomeLayout title="Bella's Safari" subtitle="Sign in to see Bella's day">
      {preview && <InviteBanner preview={preview} />}
      {step === 'email' ? (
        <Card className="px-4 py-4">
          <form onSubmit={submitEmail} className="flex flex-col gap-4">
            <h2 className="m-0 text-xl font-bold">Sign in</h2>
            <Field label="Your email" hint="We'll email you a sign-in code. No password needed.">
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <button type="submit" className={primaryButtonClass} disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </form>
        </Card>
      ) : (
        <Card className="px-4 py-4">
          <form onSubmit={submitCode} className="flex flex-col gap-4">
            <h2 className="m-0 text-xl font-bold">Check your email</h2>
            <p className="m-0 text-sm text-ink-muted">
              We sent a code to <strong className="text-ink">{email.trim()}</strong>. Type it here.
            </p>
            <Field label="Sign-in code">
              <input
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9 ]{6,12}"
                maxLength={12}
                className={`${inputClass} text-center font-display text-[28px] font-extrabold tracking-[0.3em]`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            {resent && !error && <p className="m-0 text-sm font-bold text-primary">New code sent.</p>}
            <button type="submit" className={primaryButtonClass} disabled={busy || code.trim().length < 6}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <div className="flex justify-between gap-2">
              <button
                type="button"
                className="min-h-11 text-sm font-bold text-primary"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                  setResent(false)
                }}
              >
                Use a different email
              </button>
              <button type="button" className="min-h-11 text-sm font-bold text-primary" disabled={busy} onClick={resend}>
                Send a new code
              </button>
            </div>
          </form>
        </Card>
      )}
      <p className="m-0 px-1 text-[13px] leading-snug text-ink-muted">
        Using Bella's Safari from your home screen? Type the code here rather than tapping the link in the email, so
        you're signed in to the app and not just your browser.
      </p>
    </WelcomeLayout>
  )
}
