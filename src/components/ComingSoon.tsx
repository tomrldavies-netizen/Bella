import { Card } from './Card'

/** Placeholder body for screens that later phases will fill in. */
export function ComingSoon({ items }: { items: string[] }) {
  return (
    <div className="px-4 pt-3.5 md:px-7">
      <Card className="flex flex-col gap-2 px-4 py-3.5">
        <h2 className="m-0 text-xl font-bold">Coming soon</h2>
        <p className="m-0 text-sm text-ink-muted">This screen is still being built. It will have:</p>
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
