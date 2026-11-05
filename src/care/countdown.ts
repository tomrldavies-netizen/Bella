/** "25 min", "1 hr 5 min", "Now", "10 min ago" */
export function countdown(targetIso: string, now: Date): string {
  const mins = Math.round((Date.parse(targetIso) - now.getTime()) / 60000)
  const abs = Math.abs(mins)
  const h = Math.floor(abs / 60)
  const d = Math.floor(abs / 1440)
  const text =
    abs >= 1440
      ? `${d} day${d === 1 ? '' : 's'}${h % 24 ? ` ${h % 24} hr` : ''}`
      : abs < 60
        ? `${abs} min`
        : abs % 60
          ? `${h} hr ${abs % 60} min`
          : `${h} hr${h === 1 ? '' : 's'}`
  if (mins === 0) return 'Now'
  return mins > 0 ? text : `${text} ago`
}
