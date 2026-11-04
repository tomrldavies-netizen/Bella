import { useEffect, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { Card, EmptyNote } from '../components/Card'
import { ErrorNote } from '../components/Field'
import { fieldClass } from '../components/PlanEditLayout'
import { useLiveQuery } from '../lib/useLiveQuery'
import { shortDate, ukNow } from '../lib/ukTime'
import { addMilestone, deleteMilestone, deletePhoto, loadMilestones, photoUrl, updateMilestone, uploadPhoto } from '../organise/api'
import type { Milestone } from '../organise/types'

/** Shows a private photo through a short-lived link. */
function Photo({ path, className, alt }: { path: string; className: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    photoUrl(path).then(
      (u) => live && setSrc(u),
      () => live && setSrc(null),
    )
    return () => {
      live = false
    }
  }, [path])
  return src ? <img src={src} alt={alt} className={className} /> : <span className={`${className} bg-growth`} aria-hidden="true" />
}

function FirstSheet({ first, householdId, onDone, onClose }: { first: Milestone | null; householdId: string; onDone: (msg: string) => void; onClose: () => void }) {
  const today = ukNow().date
  const [title, setTitle] = useState(first?.title ?? '')
  const [date, setDate] = useState(first?.date ?? today)
  const [file, setFile] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const preview = file ? URL.createObjectURL(file) : null
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      let photo = removePhoto ? null : (first?.photo_url ?? null)
      if (file) photo = await uploadPhoto(householdId, file)
      if (first) await updateMilestone(first.id, { title: title.trim(), date, photo_url: photo })
      else await addMilestone(householdId, { title: title.trim(), date, photo_url: photo })
      // Tidy up a replaced or removed photo.
      if (first?.photo_url && first.photo_url !== photo) await deletePhoto(first.photo_url).catch(() => {})
      onDone(first ? 'Saved' : 'First added')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const hasPhoto = !!file || (!!first?.photo_url && !removePhoto)
  return (
    <BottomSheet title={first ? 'Edit first' : 'Add a first'} onClose={onClose}>
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-extrabold">What happened</span>
        <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. First full bottle" className={fieldClass} />
      </label>
      <label className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold">Date</span>
        <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${fieldClass} !w-44`} />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-extrabold">Photo (optional, only your family can see it)</span>
        {preview && <img src={preview} alt="Chosen photo" className="max-h-56 w-full rounded-2xl object-cover" />}
        {!file && first?.photo_url && !removePhoto && <Photo path={first.photo_url} alt={first.title} className="max-h-56 w-full rounded-2xl object-cover" />}
        <div className="flex flex-wrap gap-2">
          <label className="flex h-11 cursor-pointer items-center rounded-full border-[1.5px] border-growth-accent bg-growth px-4 text-sm font-extrabold">
            {hasPhoto ? 'Choose a different photo' : 'Choose a photo'}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setRemovePhoto(false)
              }}
            />
          </label>
          {hasPhoto && (
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setRemovePhoto(true)
              }}
              className="min-h-11 px-2 text-sm font-extrabold text-ink-muted"
            >
              No photo
            </button>
          )}
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      <button type="button" disabled={busy || !title.trim()} onClick={save} className="h-12 rounded-full bg-primary font-extrabold text-white disabled:opacity-50">
        {busy ? (file ? 'Uploading…' : 'Saving…') : first ? 'Save' : 'Add first'}
      </button>
      {first &&
        (confirm ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await deleteMilestone(first.id)
              if (first.photo_url) await deletePhoto(first.photo_url).catch(() => {})
              onDone('First deleted')
            }}
            className="h-11 rounded-full bg-alert text-sm font-extrabold text-white"
          >
            Yes, delete it
          </button>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="min-h-11 text-sm font-extrabold text-alert">
            Delete this first
          </button>
        ))}
    </BottomSheet>
  )
}

/** Bella's firsts: free-text milestones with dates and an optional private photo (SPEC §4.4). */
export function Firsts({ householdId, babyName, onToast }: { householdId: string; babyName: string; onToast: (m: string) => void }) {
  const q = useLiveQuery(householdId, ['milestones'], loadMilestones)
  const [sheet, setSheet] = useState<Milestone | 'new' | null>(null)
  return (
    <section aria-labelledby="firsts" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 id="firsts" className="m-0 text-xl font-bold">
          {babyName}'s firsts
        </h2>
        <button type="button" onClick={() => setSheet('new')} className="min-h-11 text-[13px] font-extrabold text-primary">
          + Add a first
        </button>
      </div>
      {q.error && <ErrorNote>{q.error}</ErrorNote>}
      {q.data?.length === 0 && (
        <Card className="px-4 py-3.5">
          <EmptyNote>First cuddle, first bath, first full bottle… keep them here.</EmptyNote>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {(q.data ?? []).map((m) => (
          <button key={m.id} type="button" onClick={() => setSheet(m)} className="flex flex-col overflow-hidden rounded-2xl border-[1.5px] border-line bg-card text-left">
            {m.photo_url ? <Photo path={m.photo_url} alt={m.title} className="aspect-[4/3] w-full object-cover" /> : <span className="flex aspect-[4/3] w-full items-center justify-center bg-growth text-3xl" aria-hidden="true">⭐</span>}
            <span className="flex flex-col px-3 py-2">
              <span className="text-sm leading-tight font-extrabold">{m.title}</span>
              <span className="text-xs text-ink-muted">{shortDate(m.date)}</span>
            </span>
          </button>
        ))}
      </div>
      {sheet && (
        <FirstSheet
          first={sheet === 'new' ? null : sheet}
          householdId={householdId}
          onClose={() => setSheet(null)}
          onDone={(msg) => {
            setSheet(null)
            onToast(msg)
            q.reload()
          }}
        />
      )}
    </section>
  )
}
