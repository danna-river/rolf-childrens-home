"use client"

// Face search entry point on the children registry toolbar (admins + staff).
// Captures a camera frame or uploaded photo, derives one embedding on-device
// (see src/lib/face/embedding.ts), and matches it via the scoped RPC. The
// query photo never leaves the device; only the embedding is sent, and it is
// discarded after the match.

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CameraIcon, ImageUpIcon, Loader2Icon, ScanFaceIcon, UserRoundIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTranslations } from "@/i18n/client"
import type { MessageKey } from "@/i18n/locales/en"
import { matchChildFace, type FaceMatchCandidate } from "@/lib/face/actions"
import {
  extractFaceEmbeddingFromBlob,
  extractFaceEmbeddingFromVideoFrame,
  preloadFaceEngine,
} from "@/lib/face/embedding"
import type { FaceExtraction } from "@/lib/face/validation"
import {
  FACE_CANDIDATE_MAX_DISTANCE,
  FACE_DIRECT_MAX_DISTANCE,
  FACE_DIRECT_MIN_MARGIN,
  FACE_DIRECT_OPEN_ENABLED,
} from "@/lib/face/config"

type Phase = "choose" | "camera" | "processing" | "results"

const ISSUE_MESSAGE: Record<string, MessageKey> = {
  "no-face": "children.faceSearch.error.noFace",
  "multiple-faces": "children.faceSearch.error.multipleFaces",
  "low-quality": "children.faceSearch.error.lowQuality",
}

export function FaceSearchButton() {
  const t = useTranslations()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>("choose")
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<FaceMatchCandidate[]>([])

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // Always release the camera when the dialog closes or the component unmounts.
  useEffect(() => {
    if (!open) stopCamera()
    return stopCamera
  }, [open, stopCamera])

  const resetToChoose = () => {
    stopCamera()
    setPhase("choose")
    setError(null)
    setCandidates([])
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      preloadFaceEngine()
      setPhase("choose")
      setError(null)
      setCandidates([])
    } else {
      stopCamera()
    }
  }

  const runSearch = async (extraction: FaceExtraction) => {
    if (!extraction.ok) {
      setError(t(ISSUE_MESSAGE[extraction.reason]))
      setPhase("choose")
      return
    }

    const { candidates: matches, error: matchError } = await matchChildFace(extraction.embedding)
    if (matchError) {
      setError(matchError)
      setPhase("choose")
      return
    }

    const usable = matches.filter((match) => match.distance <= FACE_CANDIDATE_MAX_DISTANCE)

    // Auto-open only behind the calibration gate: a clear best match that is
    // well separated from the runner-up (or has no runner-up at all).
    if (FACE_DIRECT_OPEN_ENABLED && usable.length > 0) {
      const [best, second] = usable
      const separated = !second || second.distance - best.distance >= FACE_DIRECT_MIN_MARGIN
      if (best.distance <= FACE_DIRECT_MAX_DISTANCE && separated) {
        setOpen(false)
        router.push(`/dashboard/children/${best.childId}`)
        return
      }
    }

    setCandidates(usable)
    setPhase("results")
  }

  const startCamera = async () => {
    setError(null)
    setPhase("camera")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      stopCamera()
      setError(t("children.faceSearch.error.camera"))
      setPhase("choose")
    }
  }

  const captureFrame = async () => {
    const video = videoRef.current
    if (!video) return
    setPhase("processing")
    try {
      const extraction = await extractFaceEmbeddingFromVideoFrame(video)
      stopCamera()
      await runSearch(extraction)
    } catch {
      stopCamera()
      setError(t("children.faceSearch.error.engine"))
      setPhase("choose")
    }
  }

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setError(null)
    setPhase("processing")
    try {
      const extraction = await extractFaceEmbeddingFromBlob(file)
      await runSearch(extraction)
    } catch {
      setError(t("children.faceSearch.error.engine"))
      setPhase("choose")
    }
  }

  const actionButtonClass =
    "flex flex-col items-center gap-2 rounded-md border border-stone bg-ice px-4 py-5 text-sm font-semibold text-navy transition-colors hover:border-teal hover:bg-teal/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className="inline-flex min-h-14 shrink-0 items-center gap-2 rounded-md border border-stone bg-ice px-4 text-base font-semibold text-navy outline-none motion-safe:transition-colors hover:border-teal hover:text-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        <ScanFaceIcon className="size-5" aria-hidden />
        <span className="hidden sm:inline">{t("children.faceSearch.button")}</span>
        <span className="sr-only sm:hidden">{t("children.faceSearch.button")}</span>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-navy">
              <ScanFaceIcon className="size-5 text-teal" aria-hidden />
              {t("children.faceSearch.title")}
            </DialogTitle>
            <DialogDescription>{t("children.faceSearch.description")}</DialogDescription>
          </DialogHeader>

          {error && (
            <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </p>
          )}

          {phase === "choose" && (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={startCamera} className={actionButtonClass}>
                <CameraIcon className="size-6 text-teal" aria-hidden />
                {t("children.faceSearch.useCamera")}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={actionButtonClass}
              >
                <ImageUpIcon className="size-6 text-teal" aria-hidden />
                {t("children.faceSearch.uploadPhoto")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          )}

          {phase === "camera" && (
            <div className="space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[4/3] w-full rounded-md bg-navy/90 object-cover"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={captureFrame}
                  className="flex-1 rounded-md bg-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal/90"
                >
                  {t("children.faceSearch.capture")}
                </button>
                <button
                  type="button"
                  onClick={resetToChoose}
                  className="rounded-md border border-stone px-4 py-2.5 text-sm font-semibold text-navy/70 transition-colors hover:text-navy"
                >
                  {t("children.media.cancel")}
                </button>
              </div>
            </div>
          )}

          {phase === "processing" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2Icon className="size-8 animate-spin text-teal" aria-hidden />
              <p className="text-sm font-semibold text-navy/70">
                {t("children.faceSearch.searching")}
              </p>
            </div>
          )}

          {phase === "results" && (
            <div className="space-y-3">
              {candidates.length === 0 ? (
                <div className="rounded-md border border-stone bg-ice px-4 py-6 text-center">
                  <p className="text-sm font-bold text-navy">
                    {t("children.faceSearch.results.none")}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-navy/60">
                    {t("children.faceSearch.results.noneHelp")}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-navy/60">
                    {t("children.faceSearch.results.help")}
                  </p>
                  <ul className="space-y-2">
                    {candidates.map((candidate, index) => (
                      <li key={candidate.childId}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false)
                            router.push(`/dashboard/children/${candidate.childId}`)
                          }}
                          className="flex w-full items-center gap-3 rounded-md border border-stone bg-white p-3 text-left transition-colors hover:border-teal hover:bg-teal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
                        >
                          {candidate.photoMediaId ? (
                            /* eslint-disable-next-line @next/next/no-img-element -- authenticated media proxy URL resolved at runtime. */
                            <img
                              src={`/api/media/${candidate.photoMediaId}/thumbnail`}
                              alt=""
                              className="size-14 shrink-0 rounded-full border border-stone object-cover"
                            />
                          ) : (
                            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-stone/60 text-navy/50">
                              <UserRoundIcon className="size-6" aria-hidden />
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-navy">
                              {candidate.displayName}
                            </span>
                            <span className="block truncate text-xs font-semibold text-navy/60">
                              {candidate.idRolf ?? t("children.card.rolfIdUnknown")}
                              {candidate.country ? ` · ${candidate.country}` : ""}
                            </span>
                          </span>
                          {index === 0 && (
                            <span className="shrink-0 rounded-md bg-teal/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-teal">
                              {t("children.faceSearch.results.best")}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button
                type="button"
                onClick={resetToChoose}
                className="w-full rounded-md border border-stone px-4 py-2.5 text-sm font-semibold text-navy/70 transition-colors hover:text-navy"
              >
                {t("children.faceSearch.tryAgain")}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
