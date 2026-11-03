/** "Thursday 22 October" */
export function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Greeting for the tablet Today header. */
export function greeting(d: Date): string {
  const h = d.getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 18) return 'Good afternoon'
  return 'Good evening'
}
