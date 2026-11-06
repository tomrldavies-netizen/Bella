import { Link, useRouteError } from 'react-router-dom'

/** Shown in place of a screen that crashed, so the tabs still work and nothing technical fills the screen. */
export function RouteError() {
  const error = useRouteError()
  const detail = error instanceof Error ? error.message : String(error)
  return (
    <div role="alert" className="flex flex-col gap-3 px-4 pt-6 md:px-7">
      <h1 className="m-0 font-display text-2xl font-extrabold">Something went wrong</h1>
      <p className="m-0 text-sm">This screen couldn't open. Nothing you logged has been lost.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-full bg-primary px-5 text-sm font-extrabold text-white">
          Try again
        </button>
        <Link to="/" className="flex min-h-11 items-center rounded-full border-[1.5px] border-primary px-5 text-sm font-extrabold text-primary">
          Back to Today
        </Link>
      </div>
      <details className="text-xs text-ink-muted">
        <summary className="min-h-11 cursor-pointer py-3">Technical details</summary>
        <p className="m-0 break-words">{detail}</p>
      </details>
    </div>
  )
}
