import { supabase } from '../lib/supabase'
import { friendlyError } from '../offline/network'

function db() {
  if (!supabase) throw new Error('Not connected')
  return supabase
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(friendlyError(res.error.message))
  return res.data as T
}

export type Invite = {
  id: string
  display_name: string
  role: 'parent' | 'helper'
  email: string | null
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export type InvitePreview = { display_name: string; role: 'parent' | 'helper'; baby_name: string | null; email_hint: string | null; status: 'ok' | 'used' | 'expired' }

/** The link a parent sends. Opens the app at #/join/<token>. */
export const inviteLink = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL}#/join/${token}`

/** The message sent with an invite link (by text, WhatsApp, etc). */
export function inviteMessage(name: string, babyName: string, email: string | null, token: string) {
  return `Hi ${name}, here's your invite to ${babyName}'s Safari, where we log ${babyName}'s care. Open this link on your phone: ${inviteLink(token)}${
    email ? ` and sign in with ${email}.` : '.'
  } The link works for 7 days.`
}

/** Invites not yet accepted (parents only; RLS hides them from helpers). */
export async function loadPendingInvites(householdId: string): Promise<Invite[]> {
  return check<Invite[]>(
    await db().from('invites').select('*').eq('household_id', householdId).is('accepted_at', null).order('created_at', { ascending: false }),
  )
}

export async function createInvite(householdId: string, name: string, role: 'parent' | 'helper', email: string) {
  const rows = check<{ id: string; token: string; expires_at: string }[]>(
    await db().rpc('create_invite', { p_household: householdId, p_display_name: name, p_role: role, p_email: email }),
  )
  return rows[0]
}

export async function resendInvite(inviteId: string) {
  const rows = check<{ id: string; token: string; expires_at: string }[]>(await db().rpc('resend_invite', { p_invite_id: inviteId }))
  return rows[0]
}

export async function cancelInvite(inviteId: string) {
  check(await db().from('invites').delete().eq('id', inviteId))
}

export async function invitePreview(token: string): Promise<InvitePreview | null> {
  const rows = check<InvitePreview[]>(await db().rpc('invite_preview', { p_token: token }))
  return rows[0] ?? null
}

export async function acceptInvite(token: string): Promise<void> {
  check(await db().rpc('accept_invite', { p_token: token }))
}

export async function updateMyProfile(householdId: string, name: string, colour: string) {
  check(await db().rpc('update_my_profile', { p_household: householdId, p_display_name: name, p_colour: colour }))
}

/** Parents only (RLS): change someone's role, or remove them (keeps their history). */
export async function updateMember(memberId: string, patch: { role?: 'parent' | 'helper'; active?: boolean }) {
  check(await db().from('members').update(patch).eq('id', memberId))
}
