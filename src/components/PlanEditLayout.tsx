import { useEffect, type ReactNode } from 'react'
import { useBlocker } from 'react-router-dom'
import { ErrorNote } from './Field'
import { LockIcon } from './Icons'
import { ScreenHeader } from './ScreenHeader'
import { Toggle } from './Toggle'

export const fieldClass =
  'h-11 w-full min-w-0 rounded-xl border-[1.5px] border-line bg-field px-3 text-[15px] text-ink placeholder:text-ink-soft/70 focus:border-primary focus:outline-none'

export function ReadOnlyNote() {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-line bg-card px-3 py-2.5">
      <LockIcon className="shrink-0 text-primary" />
      <span className="text-[13px] leading-snug font-bold">
        Only Mum and Dad can change the plan. Helpers can see it and log care.
      </span>
    </div>
  )
}

type Props = {
  title: string
  subtitle?: string
  tint: string
  guide: ReactNode
  children: ReactNode
  readOnly: boolean
  /** True when there's something to save. */
  dirty: boolean
  saving: boolean
  error: string | null
  saveLabel: string
  canSave?: boolean
  onSave: () => void
  notify: boolean
  onNotifyChange: (on: boolean) => void
  /** Shown above Save, e.g. the change summary or a saved message. */
  status?: ReactNode
}

/**
 * Plan edit screen: back link to Bella's plan, content, and a fixed bottom bar
 * with "Tell everyone about this change" and Save (SPEC §6). Warns before
 * leaving with unsaved changes. Helpers get the same screen without controls.
 */
export function PlanEditLayout(p: Props) {
  const guard = p.dirty && !p.saving && !p.readOnly
  const blocker = useBlocker(({ currentLocation, nextLocation }) => guard && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (!guard) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [guard])

  return (
    <div className="md:max-w-3xl">
      <ScreenHeader
        title={p.title}
        subtitle={p.subtitle}
        tint={p.tint}
        guide={p.guide}
        back={{ to: '/bellas-plan', label: "Bella's plan" }}
      />
      <div className={`flex flex-col gap-3 px-4 pt-3 md:px-7 ${p.readOnly ? 'pb-8' : 'pb-[calc(170px+env(safe-area-inset-bottom))]'}`}>
        {p.readOnly && <ReadOnlyNote />}
        {p.children}
      </div>

      {!p.readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-line bg-card px-4 pt-2.5 pb-[max(18px,env(safe-area-inset-bottom))] md:left-24 md:px-7 lg:left-[228px]">
          <div className="flex flex-col gap-2 md:max-w-[calc(48rem-3.5rem)]">
          {p.error && <ErrorNote>{p.error}</ErrorNote>}
          {p.status && <div className="text-[13px] leading-snug text-ink-muted">{p.status}</div>}
          <Toggle on={p.notify} onChange={p.onNotifyChange} label="Tell everyone about this change" />
          <button
            type="button"
            onClick={p.onSave}
            disabled={!p.dirty || p.saving || p.canSave === false}
            className="h-[52px] rounded-2xl bg-primary font-display text-lg font-extrabold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {p.saving ? 'Saving…' : p.saveLabel}
          </button>
          </div>
        </div>
      )}

      {blocker.state === 'blocked' && (
        <div role="dialog" aria-modal="true" aria-labelledby="leave-title" className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 p-4 md:items-center">
          <div className="flex w-full max-w-sm flex-col gap-3 rounded-[22px] bg-card p-5">
            <h2 id="leave-title" className="m-0 text-xl font-bold">
              Leave without saving?
            </h2>
            <p className="m-0 text-sm text-ink-muted">Your changes to {p.title.toLowerCase()} haven't been saved.</p>
            <button type="button" onClick={() => blocker.reset()} className="h-12 rounded-full bg-primary font-extrabold text-white">
              Keep editing
            </button>
            <button type="button" onClick={() => blocker.proceed()} className="min-h-11 text-sm font-extrabold text-alert">
              Leave and lose changes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
