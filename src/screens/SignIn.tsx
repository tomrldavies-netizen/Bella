import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Card } from '../components/Card'
import { ErrorNote, Field, inputClass, primaryButtonClass } from '../components/Field'
import { WelcomeLayout } from './WelcomeLayout'

export function SignIn() {
  const { sendCode, verifyCode } = useAuth()
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
    const err = await sendCode(email.trim())
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
    const err = await sendCode(email.trim())
    setBusy(false)
    if (err) setError(err)
    else setResent(true)
  }

  return (
    <WelcomeLayout title="Bella's Safari" subtitle="Sign in to see Bella's day">
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
