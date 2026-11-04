import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Card } from '../components/Card'
import { ErrorNote, primaryButtonClass } from '../components/Field'
import { acceptInvite, invitePreview, type InvitePreview } from '../family/api'
import { useHousehold } from '../household/HouseholdContext'
import { InviteBanner } from './SignIn'
import { WelcomeLayout } from './WelcomeLayout'

/** Signed in with an invite link but not yet in the household: join it. */
export function JoinInvite({ token, onDone }: { token: string; onDone: () => void }) {
  const { session, signOut } = useAuth()
  const { reload } = useHousehold()
  const [preview, setPreview] = useState<InvitePreview | null | 'loading'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    invitePreview(token).then(setPreview, () => setPreview(null))
  }, [token])

  async function join() {
    setBusy(true)
    setError(null)
    try {
      await acceptInvite(token)
      onDone()
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <WelcomeLayout title="Welcome" subtitle="Joining Bella's Safari">
      {preview && preview !== 'loading' && <InviteBanner preview={preview} />}
      {preview === null && <ErrorNote>This invite link isn't valid. Ask a parent to send a new one.</ErrorNote>}
      <Card className="flex flex-col gap-3 px-4 py-4">
        <p className="m-0 text-sm">
          Signed in as <strong>{session?.user.email}</strong>.
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="button" disabled={busy || preview === 'loading' || preview === null || preview.status !== 'ok'} onClick={join} className={primaryButtonClass}>
          {busy ? 'Joining…' : "Join Bella's Safari"}
        </button>
        <button type="button" onClick={signOut} className="min-h-11 text-sm font-bold text-primary">
          Use a different email
        </button>
      </Card>
    </WelcomeLayout>
  )
}
