import { Elephant } from '../animals'
import { useAuth } from '../auth/AuthContext'
import { Card } from '../components/Card'
import { primaryButtonClass } from '../components/Field'
import { WelcomeLayout } from './WelcomeLayout'

export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <div className="flex flex-col items-center gap-3 motion-safe:animate-pulse">
        <Elephant size={72} bg="#DCEBF2" cheeks />
        <span className="text-sm font-bold text-ink-muted">Loading…</span>
      </div>
    </div>
  )
}

export function NotConnected() {
  return (
    <WelcomeLayout title="Bella's Safari" subtitle="Almost ready">
      <Card className="flex flex-col gap-2 px-4 py-4">
        <h2 className="m-0 text-xl font-bold">Not connected yet</h2>
        <p className="m-0 text-sm text-ink-muted">
          The app isn't linked to its database. Add the Supabase URL and anon key as GitHub secrets (or in{' '}
          <code>.env.local</code> when running locally), then deploy again.
        </p>
      </Card>
    </WelcomeLayout>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { signOut } = useAuth()
  return (
    <WelcomeLayout title="Bella's Safari" subtitle="Something went wrong">
      <Card className="flex flex-col gap-3 px-4 py-4">
        <h2 className="m-0 text-xl font-bold">Couldn't load Bella's details</h2>
        <p className="m-0 text-sm text-ink-muted">{message}</p>
        <button type="button" className={primaryButtonClass} onClick={onRetry}>
          Try again
        </button>
        <button type="button" className="min-h-11 text-sm font-bold text-primary" onClick={signOut}>
          Sign out
        </button>
      </Card>
    </WelcomeLayout>
  )
}
