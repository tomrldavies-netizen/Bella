import type { Member } from '../data/types'

/** Small coloured name tag showing who did something (SPEC §3). */
export function NamePill({ member, className = '' }: { member: Pick<Member, 'display_name' | 'colour'>; className?: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold text-ink ${className}`}
      style={{ background: member.colour }}
    >
      {member.display_name}
    </span>
  )
}
