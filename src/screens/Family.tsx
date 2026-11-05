import { useCallback, useState } from 'react'
import { Zebra } from '../animals'
import { BottomSheet, Toast } from '../components/BottomSheet'
import { Card } from '../components/Card'
import { ErrorNote, Field, inputClass } from '../components/Field'
import { ScreenHeader } from '../components/ScreenHeader'
import { Segmented } from '../components/Segmented'
import { MEMBER_COLOURS } from '../data/colours'
import type { Member, Role } from '../data/types'
import { cancelInvite, createInvite, inviteMessage, loadPendingInvites, resendInvite, updateMember, updateMyProfile, type Invite } from '../family/api'
import { INSTALL_STEPS, detectPlatform } from '../family/install'
import { useHousehold, useReadyHousehold } from '../household/HouseholdContext'
import { RemindersCard } from '../reminders/RemindersCard'
import { useLiveQuery } from '../lib/useLiveQuery'
import { useNow } from '../lib/useNow'
import { shortDate, ukParts } from '../lib/ukTime'

const ROLE_LABEL: Record<Role, string> = { parent: 'Parent', helper: 'Helper' }
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
const btn = 'h-11 rounded-full px-4 text-sm font-extrabold'

function Avatar({ name, colour }: { name: string; colour: string }) {
  return (
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-extrabold" style={{ background: colour }}>
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

/** Opens the phone's share sheet (WhatsApp, Messages…), or copies the message if sharing isn't available. */
async function shareInvite(text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  await navigator.clipboard?.writeText(text)
  return 'copied'
}

function InviteSheet({ householdId, babyName, onDone, onClose }: { householdId: string; babyName: string; onDone: (msg: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('helper')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [made, setMade] = useState<{ token: string } | null>(null)
  const valid = name.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const message = made ? inviteMessage(name.trim(), babyName, email.trim().toLowerCase(), made.token) : ''

  if (made) {
    return (
      <BottomSheet title="Send the invite" onClose={() => onDone('Invite ready')}>
        <p className="m-0 text-sm">Send this to {name.trim()} by text or WhatsApp. It only works for {email.trim().toLowerCase()}.</p>
        <p className="m-0 rounded-xl border-[1.5px] border-line bg-card p-3 text-sm break-words">{message}</p>
        <button
          type="button"
          onClick={async () => {
            const r = await shareInvite(message)
            if (r !== 'cancelled') onDone(r === 'copied' ? 'Invite copied, paste it into a message' : 'Invite sent')
          }}
          className="h-12 rounded-full bg-primary font-extrabold text-white"
        >
          Share invite
        </button>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(message)
            onDone('Invite copied')
          }}
          className="min-h-11 text-sm font-extrabold text-primary"
        >
          Copy instead
        </button>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title="Invite someone" onClose={onClose}>
      <Field label="Their name" hint="As everyone will see it, e.g. Grandma.">
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Their email" hint="They sign in with this. The link won't work for anyone else.">
        <input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold">They'll be a</span>
        <Segmented<Role>
          label="Role"
          value={role}
          onChange={setRole}
          options={[
            { value: 'helper', label: 'Helper' },
            { value: 'parent', label: 'Parent' },
          ]}
        />
        <span className="text-xs text-ink-muted">
          {role === 'helper' ? 'Helpers see everything and log care, but cannot change the plan or invite people.' : 'Parents can change the plan and invite or remove people.'}
        </span>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <button
        type="button"
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            setMade(await createInvite(householdId, name.trim(), role, email.trim()))
          } catch (e) {
            setError(errorText(e))
          } finally {
            setBusy(false)
          }
        }}
        className="h-12 rounded-full bg-primary font-extrabold text-white disabled:opacity-50"
      >
        {busy ? 'Making invite…' : 'Make invite link'}
      </button>
    </BottomSheet>
  )
}

function InviteRowSheet({ invite, babyName, onDone, onClose }: { invite: Invite; babyName: string; onDone: (msg: string) => void; onClose: () => void }) {
  const now = useNow()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    try {
      const msg = await fn()
      if (msg) onDone(msg)
      else setBusy(false)
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }
  return (
    <BottomSheet title={`Invite for ${invite.display_name}`} onClose={onClose}>
      <p className="m-0 text-sm text-ink-muted">
        {ROLE_LABEL[invite.role]} · {invite.email} · {Date.parse(invite.expires_at) < now.getTime() ? 'expired' : `works until ${shortDate(ukParts(invite.expires_at).date)}`}
      </p>
      {error && <ErrorNote>{error}</ErrorNote>}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const fresh = await resendInvite(invite.id)
            const r = await shareInvite(inviteMessage(invite.display_name, babyName, invite.email, fresh.token))
            return r === 'cancelled' ? 'New link made (the old one no longer works)' : r === 'copied' ? 'New invite copied' : 'Invite resent'
          })
        }
        className="h-12 rounded-full bg-primary font-extrabold text-white disabled:opacity-50"
      >
        Resend (new link, 7 more days)
      </button>
      {confirmCancel ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirmCancel(false)} className={`${btn} flex-1 border-[1.5px] border-line bg-card`}>
            Keep it
          </button>
          <button type="button" disabled={busy} onClick={() => run(async () => (await cancelInvite(invite.id), 'Invite cancelled'))} className={`${btn} flex-1 bg-alert text-white`}>
            Cancel invite
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmCancel(true)} className="min-h-11 text-sm font-extrabold text-alert">
          Cancel this invite
        </button>
      )}
    </BottomSheet>
  )
}

function MemberSheet({ member, isMe, canManage, onDone, onClose }: { member: Member; isMe: boolean; canManage: boolean; onDone: (msg: string) => void; onClose: () => void }) {
  const { household } = useReadyHousehold()
  const [name, setName] = useState(member.display_name)
  const [colour, setColour] = useState(member.colour)
  const [role, setRole] = useState<Role>(member.role)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      if (isMe && (name.trim() !== member.display_name || colour !== member.colour)) await updateMyProfile(household.id, name.trim(), colour)
      if (canManage && role !== member.role) await updateMember(member.id, { role })
      onDone('Saved')
    } catch (e) {
      setError(/at least one parent/i.test(errorText(e)) ? 'There must always be at least one parent.' : errorText(e))
      setBusy(false)
    }
  }

  return (
    <BottomSheet title={isMe ? 'You' : member.display_name} onClose={onClose}>
      {isMe && (
        <>
          <Field label="Your name">
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 p-0 text-sm font-extrabold">Your colour</legend>
            <div className="grid grid-cols-4 gap-2">
              {MEMBER_COLOURS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  aria-pressed={colour === c.hex}
                  onClick={() => setColour(c.hex)}
                  className={`min-h-12 rounded-[14px] border-2 text-sm font-bold ${colour === c.hex ? 'border-primary' : 'border-transparent'}`}
                  style={{ background: c.hex }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {canManage ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-extrabold">Role</span>
          <Segmented<Role>
            label="Role"
            value={role}
            onChange={setRole}
            options={[
              { value: 'parent', label: 'Parent' },
              { value: 'helper', label: 'Helper' },
            ]}
          />
        </div>
      ) : (
        <p className="m-0 text-sm text-ink-muted">{ROLE_LABEL[member.role]}</p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      {(isMe || canManage) && (
        <button type="button" disabled={busy || !name.trim()} onClick={save} className="h-12 rounded-full bg-primary font-extrabold text-white disabled:opacity-50">
          Save
        </button>
      )}
      {canManage &&
        !isMe &&
        (confirmRemove ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-meds p-3">
            <span className="text-sm font-bold">Remove {member.display_name}? They lose access straight away. Everything they logged is kept.</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmRemove(false)} className={`${btn} flex-1 border-[1.5px] border-line bg-card`}>
                Keep
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await updateMember(member.id, { active: false })
                    onDone(`${member.display_name} removed`)
                  } catch (e) {
                    setError(/at least one parent/i.test(errorText(e)) ? 'There must always be at least one parent.' : errorText(e))
                    setBusy(false)
                  }
                }}
                className={`${btn} flex-1 bg-alert text-white`}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmRemove(true)} className="min-h-11 text-sm font-extrabold text-alert">
            Remove {member.display_name}
          </button>
        ))}
    </BottomSheet>
  )
}

export function InstallSteps() {
  const platform = detectPlatform()
  const order = platform === 'android' ? (['android', 'ios'] as const) : (['ios', 'android'] as const)
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {order.map((p) => (
        <Card key={p} className={`flex flex-col gap-1 px-4 py-3 ${p === platform ? 'border-primary' : ''}`}>
          <span className="text-sm font-extrabold">
            {p === 'ios' ? 'iPhone' : 'Android'}
            {p === platform ? ' (this phone)' : ''}
          </span>
          <ol className="m-0 flex list-decimal flex-col gap-0.5 pl-5 text-[13px]">
            {INSTALL_STEPS[p].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  )
}

export function Family() {
  const { household, me, members, baby } = useReadyHousehold()
  const { reload } = useHousehold()
  const isParent = me.role === 'parent'
  const now = useNow()
  // Helpers can't read invites (RLS), so only load them for parents.
  const invites = useLiveQuery(household.id, ['invites'], (h) => (isParent ? loadPendingInvites(h) : Promise.resolve([] as Invite[])))
  const [sheet, setSheet] = useState<'invite' | Member | Invite | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [setToast])
  const done = (msg: string) => {
    setSheet(null)
    setToast(msg)
    reload()
    invites.reload()
  }

  const sorted = [...members].sort((a, b) => (a.role === b.role ? 0 : a.role === 'parent' ? -1 : 1))
  const parents = members.filter((m) => m.role === 'parent').length
  const helpers = members.length - parents

  return (
    <>
      <ScreenHeader title="Family & sharing" subtitle="Works on iPhone and Android" tint="bg-plan" guide={<Zebra size={56} />} back={{ to: '/bellas-plan', label: "Bella's plan" }} />
      <div className="flex flex-col gap-3 px-4 pt-3.5 pb-6 md:max-w-3xl md:px-7">
        <Card className="flex flex-col px-3.5 py-1">
          {sorted.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSheet(m)}
              aria-label={`${m.display_name}${m.id === me.id ? ' (you)' : ''}, ${ROLE_LABEL[m.role]}`}
              className="flex min-h-14 items-center gap-3 border-b border-line-soft py-2 text-left last:border-b-0">
              <Avatar name={m.display_name} colour={m.colour} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-extrabold">
                  {m.display_name}
                  {m.id === me.id ? ' (you)' : ''}
                </span>
                <span className="text-xs text-ink-muted">{m.id === me.id ? 'Tap to change your name and colour' : ROLE_LABEL[m.role]}</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${m.role === 'parent' ? 'bg-primary-tint text-primary' : 'bg-tabs text-ink-deep'}`}>{ROLE_LABEL[m.role]}</span>
            </button>
          ))}
          {(invites.data ?? []).map((i) => {
            const expired = Date.parse(i.expires_at) < now.getTime()
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => setSheet(i)}
                aria-label={`${i.display_name}, ${expired ? 'invite expired' : 'invited, not set up yet'}. Resend or cancel`}
                className="flex min-h-14 items-center gap-3 border-b border-line-soft py-2 text-left last:border-b-0">
                <Avatar name={i.display_name} colour="#F3EADC" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-extrabold">{i.display_name}</span>
                  <span className={`text-xs ${expired ? 'font-bold text-alert' : 'text-ink-muted'}`}>{expired ? 'Invite expired' : 'Invited, not set up yet'}</span>
                </span>
                <span className="rounded-full border-[1.5px] border-line px-3 py-1 text-xs font-extrabold text-primary">Resend</span>
              </button>
            )
          })}
        </Card>
        <p className="m-0 text-xs text-ink-muted">
          {parents} parent{parents === 1 ? '' : 's'} · {helpers} helper{helpers === 1 ? '' : 's'} · tap someone to {isParent ? 'change their role or remove them' : 'see their role'}, or yourself to change your name and colour.
        </p>
        {invites.error && <ErrorNote>{invites.error}</ErrorNote>}

        {isParent && (
          <button type="button" onClick={() => setSheet('invite')} className="h-[52px] rounded-2xl border-[1.5px] border-dashed border-plan-accent bg-plan font-extrabold text-ink">
            + Invite someone (text or WhatsApp)
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Card className="flex flex-col gap-1 px-3.5 py-3">
            <span className="text-sm font-extrabold">Parents can</span>
            <span className="text-[13px] leading-snug">Change the plan<br />Log care<br />Invite or remove people</span>
          </Card>
          <Card className="flex flex-col gap-1 px-3.5 py-3">
            <span className="text-sm font-extrabold">Helpers can</span>
            <span className="text-[13px] leading-snug">See everything<br />Log feeds, nappies, meds<br />Not change doses or plan</span>
          </Card>
        </div>

        <RemindersCard />

        <h2 className="m-0 pt-1 text-xl font-bold">Getting the app on their phone</h2>
        <InstallSteps />
      </div>

      {sheet === 'invite' && <InviteSheet householdId={household.id} babyName={baby.name} onDone={done} onClose={() => setSheet(null)} />}
      {sheet && sheet !== 'invite' && 'token' in sheet && <InviteRowSheet invite={sheet} babyName={baby.name} onDone={done} onClose={() => setSheet(null)} />}
      {sheet && sheet !== 'invite' && 'user_id' in sheet && (
        <MemberSheet member={sheet} isMe={sheet.id === me.id} canManage={isParent} onDone={done} onClose={() => setSheet(null)} />
      )}
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  )
}
