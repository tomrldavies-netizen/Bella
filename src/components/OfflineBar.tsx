import { useEffect, useState } from 'react'
import { flush, outbox, useOutbox } from '../offline/outbox'

/**
 * Top-of-screen status: offline, changes waiting to sync, just synced, and
 * any warnings from syncing (e.g. a dose someone else also gave).
 */
export function OfflineBar() {
  const { ops, notices, syncing, online } = useOutbox()
  const [justSynced, setJustSynced] = useState(false)
  const [lastCount, setLastCount] = useState(ops.length)

  // Show "All synced" briefly when the queue empties.
  if (ops.length !== lastCount) {
    setLastCount(ops.length)
    if (lastCount > 0 && ops.length === 0) setJustSynced(true)
  }
  useEffect(() => {
    if (!justSynced) return
    const t = setTimeout(() => setJustSynced(false), 3000)
    return () => clearTimeout(t)
  }, [justSynced])

  const waiting = ops.length
  const show = !online || waiting > 0 || justSynced || notices.length > 0
  if (!show) return null
  const changes = `${waiting} change${waiting === 1 ? '' : 's'}`

  return (
    <div className="sticky top-0 z-30 flex flex-col gap-1 px-3 pt-[max(6px,env(safe-area-inset-top))] pb-1.5 md:px-7">
      {(!online || waiting > 0 || justSynced) && (
        <div role="status" className={`flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-[13px] font-bold ${!online ? 'bg-ink text-white' : justSynced && !waiting ? 'bg-primary-tint text-primary' : 'bg-banner text-ink'}`}>
          <span>
            {!online
              ? `Offline. ${waiting ? `${changes} saved on this phone` : 'Anything you log is saved on this phone'}.`
              : waiting
                ? syncing
                  ? `Syncing ${changes}…`
                  : `${changes} waiting to sync`
                : '✓ All synced'}
          </span>
          {online && waiting > 0 && !syncing && (
            <button type="button" onClick={() => void flush()} className="min-h-9 px-2 text-[13px] font-extrabold underline">
              Try now
            </button>
          )}
        </div>
      )}
      {notices.map((n) => (
        <div key={n.id} role="alert" className={`flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-[13px] font-bold ${n.tone === 'error' ? 'bg-meds text-alert' : 'border-[1.5px] border-meds-accent bg-meds text-ink'}`}>
          <span>{n.text}</span>
          <button type="button" onClick={() => outbox.dismiss(n.id)} className="min-h-9 shrink-0 px-2 text-[13px] font-extrabold">
            OK
          </button>
        </div>
      ))}
    </div>
  )
}
