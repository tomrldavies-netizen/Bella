import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from './Icons'

/** A sheet that slides up from the bottom (centred dialog on tablets). Escape or the backdrop closes it. */
export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    panel.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-ink/30" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[90dvh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-[26px] bg-sand px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] outline-none motion-safe:animate-[sheet-up_180ms_ease-out] md:rounded-[26px] md:pb-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-xl font-bold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft">
            <CloseIcon size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Small message at the bottom with an optional Undo. */
export function Toast({ message, onUndo, onDone }: { message: string; onUndo?: () => void; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 6000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div role="status" className="fixed inset-x-4 bottom-[calc(92px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-2.5 text-sm font-bold text-white motion-safe:animate-pop md:bottom-6">
      <span className="flex items-center gap-2">
        {!/^(couldn|could not|you're offline)|error/i.test(message) && (
          <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs motion-safe:animate-pop">✓</span>
        )}
        {message}
      </span>
      {onUndo && (
        <button type="button" onClick={onUndo} className="min-h-11 px-2 font-extrabold text-growth">
          Undo
        </button>
      )}
    </div>
  )
}

/** Big tappable choice used in sheets (Wet / Dirty / Both). */
export function ChoiceButton({ label, onClick, icon, className = '' }: { label: string; onClick: () => void; icon?: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-[72px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-line bg-card text-[15px] font-extrabold ${className}`}>
      {icon}
      {label}
    </button>
  )
}
