import type { Member } from '../data/types'
import type { PlanChange } from '../plan/api'
import type { PlanChangeSeen } from './types'

type MemberWithJoin = Member & { created_at?: string }

/** People who should see a change: active members other than the one who made it, who'd joined by then. */
export function audience(change: PlanChange, members: MemberWithJoin[]): MemberWithJoin[] {
  return members.filter((m) => m.active && m.id !== change.changed_by && (!m.created_at || m.created_at <= change.created_at))
}

/** Changes the "plan has changed" banner shows to `me`: told-everyone, by someone else, not yet seen. */
export function unseenFor(me: MemberWithJoin, changes: (PlanChange & { notify?: boolean })[], seen: PlanChangeSeen[]): PlanChange[] {
  const mine = new Set(seen.filter((s) => s.member_id === me.id).map((s) => s.plan_change_id))
  return changes.filter((c) => c.notify !== false && c.changed_by !== me.id && !mine.has(c.id) && (!me.created_at || me.created_at <= c.created_at))
}

/** "Grandad hasn't seen it yet" / "seen by everyone" */
export function seenWords(change: PlanChange, members: MemberWithJoin[], seen: PlanChangeSeen[]): string {
  const who = audience(change, members)
  if (who.length === 0) return ''
  const seenBy = new Set(seen.filter((s) => s.plan_change_id === change.id).map((s) => s.member_id))
  const notYet = who.filter((m) => !seenBy.has(m.id)).map((m) => m.display_name)
  if (notYet.length === 0) return 'seen by everyone'
  const names = notYet.length === 1 ? notYet[0] : `${notYet.slice(0, -1).join(', ')} and ${notYet[notYet.length - 1]}`
  return `${names} ${notYet.length === 1 ? "hasn't" : "haven't"} seen it yet`
}
