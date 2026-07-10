"use client"

// Admin-only backfill for face search: walks every child whose current
// profile photo has no template for the active model version, pulls the photo
// bytes through the authenticated media proxy, runs the face model on this
// device, and stores only the embedding/status. The queue is recomputed from
// database state, so the run is resumable after a refresh, stop, or failure,
// and photos with no usable face are recorded once as unsearchable instead of
// being retried forever.
//
// Initial counts arrive as props from the server page (repo convention);
// after a run they are re-fetched from the event handler.

import { useRef, useState } from "react"
import { Loader2Icon, PauseIcon, PlayIcon, ScanFaceIcon } from "lucide-react"
import { useTranslations } from "@/i18n/client"
import {
  getFaceBackfillQueue,
  getFaceTemplateStats,
  type FaceTemplateStats,
} from "@/lib/face/actions"
import { enrollChildProfilePhoto } from "@/lib/face/enroll"
import { preloadFaceEngine } from "@/lib/face/embedding"

type RunCounters = { enrolled: number; unsearchable: number; failed: number }
type FailureEntry = { displayName: string; message: string }

const IDLE_COUNTERS: RunCounters = { enrolled: 0, unsearchable: 0, failed: 0 }

interface FaceSearchViewProps {
  initialStats: FaceTemplateStats | null
  initialPending: number
  initialError: string | null
}

export function FaceSearchView({ initialStats, initialPending, initialError }: FaceSearchViewProps) {
  const t = useTranslations()

  const [stats, setStats] = useState<FaceTemplateStats | null>(initialStats)
  const [pending, setPending] = useState<number>(initialPending)
  const [loadError, setLoadError] = useState<string | null>(initialError)

  const [running, setRunning] = useState(false)
  const [currentName, setCurrentName] = useState<string | null>(null)
  const [counters, setCounters] = useState<RunCounters>(IDLE_COUNTERS)
  const [failures, setFailures] = useState<FailureEntry[]>([])

  // Stop requests take effect between items; a ref avoids stale-closure reads
  // inside the processing loop.
  const stopRequested = useRef(false)

  const refresh = async () => {
    const [statsResult, queueResult] = await Promise.all([
      getFaceTemplateStats(),
      getFaceBackfillQueue(),
    ])
    if (statsResult.error || queueResult.error) {
      setLoadError(statsResult.error ?? queueResult.error)
    } else {
      setLoadError(null)
      setStats(statsResult.stats)
      setPending(queueResult.items.length)
    }
  }

  const startBackfill = async () => {
    setRunning(true)
    stopRequested.current = false
    setCounters(IDLE_COUNTERS)
    setFailures([])
    preloadFaceEngine()

    // Fetch a fresh queue at start: anything enrolled meanwhile (by staff
    // saving a photo, or a previous partial run) has already dropped out.
    const { items, error } = await getFaceBackfillQueue()
    if (error) {
      setLoadError(error)
      setRunning(false)
      return
    }

    // One photo at a time: keeps memory bounded and the media proxy load low.
    for (const item of items) {
      if (stopRequested.current) break
      setCurrentName(item.displayName)

      const outcome = await enrollChildProfilePhoto(item.childId, item.mediaId)
      if (outcome.status === 'enrolled') {
        setCounters((c) => ({ ...c, enrolled: c.enrolled + 1 }))
      } else if (outcome.status === 'unsearchable') {
        setCounters((c) => ({ ...c, unsearchable: c.unsearchable + 1 }))
      } else {
        // 'failed' (and the never-expected 'no-photo'): nothing was recorded,
        // so the child stays queued for the next run.
        setCounters((c) => ({ ...c, failed: c.failed + 1 }))
        setFailures((f) => [...f, {
          displayName: item.displayName,
          message: outcome.status === 'failed' ? outcome.message : t('settings.faceSearch.noPhoto'),
        }])
      }
    }

    setCurrentName(null)
    setRunning(false)
    await refresh()
  }

  const statCard = (label: string, value: number | null) => (
    <div className="rounded-md border border-stone bg-white p-4">
      <p className="text-2xl font-bold text-navy">{value ?? '—'}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-navy/60">{label}</p>
    </div>
  )

  return (
    <section className="google-sans-registry space-y-5">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-bold text-navy">
          <ScanFaceIcon className="size-5 text-teal" aria-hidden />
          {t('settings.faceSearch.title')}
        </h2>
        <p className="mt-1 text-sm font-semibold text-navy/60">
          {t('settings.faceSearch.description')}
        </p>
      </header>

      {loadError && (
        <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {loadError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCard(t('settings.faceSearch.stats.withPhoto'), stats?.childrenWithPhoto ?? null)}
        {statCard(t('settings.faceSearch.stats.enrolled'), stats?.templatesActive ?? null)}
        {statCard(t('settings.faceSearch.stats.unsearchable'), stats?.templatesUnsearchable ?? null)}
        {statCard(t('settings.faceSearch.stats.pending'), pending)}
      </div>

      <div className="rounded-md border border-stone bg-white p-4">
        {running ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <Loader2Icon className="size-4 animate-spin text-teal" aria-hidden />
              {currentName
                ? t('settings.faceSearch.processing').replace('{name}', currentName)
                : t('settings.faceSearch.starting')}
            </div>
            <p className="text-xs font-semibold text-navy/60">
              {t('settings.faceSearch.runSummary')
                .replace('{enrolled}', String(counters.enrolled))
                .replace('{unsearchable}', String(counters.unsearchable))
                .replace('{failed}', String(counters.failed))}
            </p>
            <button
              type="button"
              onClick={() => { stopRequested.current = true }}
              className="inline-flex items-center gap-2 rounded-md border border-stone px-4 py-2 text-sm font-semibold text-navy/70 transition-colors hover:text-navy"
            >
              <PauseIcon className="size-4" aria-hidden />
              {t('settings.faceSearch.stop')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={startBackfill}
              disabled={pending === 0}
              className="inline-flex items-center gap-2 rounded-md bg-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlayIcon className="size-4" aria-hidden />
              {pending === 0
                ? t('settings.faceSearch.allDone')
                : t('settings.faceSearch.start')}
            </button>
            {(counters.enrolled > 0 || counters.unsearchable > 0 || counters.failed > 0) && (
              <p className="text-xs font-semibold text-navy/60">
                {t('settings.faceSearch.runSummary')
                  .replace('{enrolled}', String(counters.enrolled))
                  .replace('{unsearchable}', String(counters.unsearchable))
                  .replace('{failed}', String(counters.failed))}
              </p>
            )}
            <p className="text-xs font-medium leading-relaxed text-navy/55">
              {t('settings.faceSearch.help')}
            </p>
          </div>
        )}
      </div>

      {failures.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
            {t('settings.faceSearch.failuresTitle')}
          </p>
          <ul className="mt-2 space-y-1">
            {failures.map((failure, index) => (
              <li key={index} className="text-xs font-semibold text-amber-800">
                {failure.displayName} — {failure.message}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] font-medium text-amber-700">
            {t('settings.faceSearch.failuresHelp')}
          </p>
        </div>
      )}
    </section>
  )
}
