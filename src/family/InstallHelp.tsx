import { useState } from 'react'
import { Elephant } from '../animals'
import { BottomSheet } from '../components/BottomSheet'
import { INSTALL_STEPS, detectPlatform, installHelpSeen, isInstalled, markInstallHelpSeen } from './install'

/**
 * On first open in the browser (not yet on the home screen), shows the steps
 * for this phone once. They're always in Family & sharing too.
 */
export function InstallHelp() {
  const platform = detectPlatform()
  const [open, setOpen] = useState(() => platform !== 'other' && !isInstalled() && !installHelpSeen())
  if (!open || platform === 'other') return null
  const close = () => {
    markInstallHelpSeen()
    setOpen(false)
  }
  return (
    <BottomSheet title="Put Bella's Safari on your home screen" onClose={close}>
      <div className="flex items-center gap-3">
        <Elephant size={48} bg="#DCEBF2" cheeks />
        <p className="m-0 text-sm">It opens like an app, works one-handed, and (soon) can send you reminders.</p>
      </div>
      <ol className="m-0 flex list-decimal flex-col gap-1.5 rounded-2xl border-[1.5px] border-line bg-card py-3 pr-3 pl-8 text-[15px]">
        {INSTALL_STEPS[platform].map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {platform === 'ios' && <p className="m-0 text-xs text-ink-muted">On iPhone this needs Safari. Reminders only work once it's opened from the Home Screen.</p>}
      <button type="button" onClick={close} className="h-12 rounded-full bg-primary font-extrabold text-white">
        Got it
      </button>
    </BottomSheet>
  )
}
