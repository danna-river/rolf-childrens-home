"use client"
import { useRef, useState } from "react"
import {
  DRIVE_SHARE_HINT,
  extractDriveFileId,
  getDriveVideoPreview,
  isGoogleDriveUrl,
  resolvePhotoSrc,
} from "@/lib/childMedia"

const MAX_MB = { photo: 15, video: 50 }
const ACCEPT = { photo: "image/*", video: "video/*" }

type ChildMeta = {
  idRolf?: string | null
  firstName?: string | null
  lastName?: string | null
  country?: string | null
}

interface MediaPickerProps {
  type: "photo" | "video"
  value: string | null
  // ⚡ UPDATE: Allow passing metadata response variables up to parent component
  onChange: (url: string | null, metaData?: { fileId?: string }) => void
  existingUrl?: string | null
  onError?: (msg: string | null) => void
  onUploadStart?: () => void
  onUploadEnd?: () => void
  allowDriveLink?: boolean
  childMeta?: ChildMeta
}

export function MediaPicker({
  type, value, onChange, existingUrl, onError, onUploadStart, onUploadEnd,
  allowDriveLink = true, childMeta,
}: MediaPickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [showDrive, setShowDrive] = useState(false)
  const [driveInput, setDriveInput] = useState("")
  const isPhoto = type === "photo"

  const previewSrc = localPreview ?? value
  const isDriveValue = !localPreview && isGoogleDriveUrl(value)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_MB[type] * 1024 * 1024) {
      onError?.(`${isPhoto ? "Photo" : "Video"} must be under ${MAX_MB[type]} MB.`)
      e.target.value = ""
      return
    }
    onError?.(null)
    setLocalPreview(URL.createObjectURL(file))
    setUploading(true)
    onUploadStart?.()

    const body = new FormData()
    body.append("file", file)
    body.append("type", type)
    if (childMeta?.idRolf) body.append("idRolf", childMeta.idRolf)
    if (childMeta?.firstName) body.append("firstName", childMeta.firstName)
    if (childMeta?.lastName) body.append("lastName", childMeta.lastName)
    if (childMeta?.country) body.append("country", childMeta.country)

    const res = await fetch("/api/upload", { method: "POST", body })

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Upload failed." }))
      onError?.(error ?? "Upload failed. Please try again.")
      setLocalPreview(null)
      setUploading(false)
      onUploadEnd?.()
      return
    }

    // ⚡ UPDATE: Capture both url and fileId parameters from the backend route response
    const { url, fileId } = await res.json()
    setLocalPreview(null)
    setUploading(false)
    onUploadEnd?.()
    
    // ⚡ UPDATE: Pass both elements up to the parent form tracking hook
    onChange(url, { fileId })
  }

  const handleDriveApply = () => {
    const link = driveInput.trim()
    if (!extractDriveFileId(link) || !isGoogleDriveUrl(link)) {
      onError?.("Enter a valid Google Drive share link.")
      return
    }
    onError?.(null)
    setShowDrive(false)
    setDriveInput("")
    
    // If it's a manually pasted Drive link, parse out the file ID right here inline
    const fileId = extractDriveFileId(link) || undefined
    onChange(link, { fileId })
  }

  const handleRemove = () => {
    onChange(null)
    setLocalPreview(null)
    setShowDrive(false)
    setDriveInput("")
    if (cameraRef.current) cameraRef.current.value = ""
    if (uploadRef.current) uploadRef.current.value = ""
  }

  return (
    <>
      <input ref={cameraRef} type="file" accept={ACCEPT[type]} capture="environment" onChange={handleFile} className="hidden" />
      <input ref={uploadRef} type="file" accept={ACCEPT[type]} onChange={handleFile} className="hidden" />

      {previewSrc ? (
        isPhoto ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <img src={resolvePhotoSrc(previewSrc) ?? previewSrc} alt="preview" referrerPolicy="no-referrer" className="h-36 w-36 rounded-full object-cover border-4 border-blue-100" />
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <span className="text-xs text-white font-medium">Uploading…</span>
                </div>
              )}
            </div>
            {isDriveValue && <p className="text-xs text-gray-400">Google Drive link</p>}
            {!uploading && <button type="button" onClick={handleRemove} className="text-xs text-orange-500">Upload new profile photo</button>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {uploading ? (
              <div className="w-full aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                <p className="text-xs text-blue-500 font-medium">Uploading video…</p>
              </div>
            ) : isDriveValue ? (
              <iframe
                src={getDriveVideoPreview(extractDriveFileId(value) as string)}
                allow="autoplay"
                allowFullScreen
                title="video preview"
                className="w-full aspect-video rounded-xl"
              />
            ) : (
              <video src={previewSrc} controls className="w-full rounded-xl max-h-48" />
            )}
            {isDriveValue && <p className="text-xs text-gray-400">Google Drive link</p>}
            {!uploading && <button type="button" onClick={handleRemove} className="text-xs text-orange-500">Upload new profile video</button>}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {isPhoto && existingUrl && (
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Existing photo on file — select below to replace it.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-300 transition-colors">
              <span className="text-2xl">{isPhoto ? "📷" : "🎥"}</span>
              <span className="text-xs font-medium text-gray-600">
                {isPhoto ? (existingUrl ? "Retake Photo" : "Take Photo") : "Record Video"}
              </span>
            </button>
            <button type="button" onClick={() => uploadRef.current?.click()}
              className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-300 transition-colors">
              <span className="text-2xl">{isPhoto ? "🖼️" : "📁"}</span>
              <span className="text-xs font-medium text-gray-600">
                {isPhoto ? (existingUrl ? "Replace File" : "Upload File") : "Upload File"}
              </span>
            </button>
          </div>

          {allowDriveLink && (
            showDrive ? (
              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <input
                  type="url"
                  inputMode="url"
                  value={driveInput}
                  onChange={e => setDriveInput(e.target.value)}
                  placeholder="https://drive.google.com/file/d/…"
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300"
                />
                <p className="text-xs text-gray-400">{DRIVE_SHARE_HINT}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={handleDriveApply}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
                    Use link
                  </button>
                  <button type="button" onClick={() => { setShowDrive(false); setDriveInput(""); onError?.(null) }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowDrive(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white py-3 hover:border-blue-300 transition-colors">
                <span className="text-base">🔗</span>
                <span className="text-xs font-medium text-gray-600">Use Google Drive link</span>
              </button>
            )
          )}

          {!isPhoto && !showDrive && (
            <p className="text-xs text-gray-400 text-center">Child states their name, then does an activity</p>
          )}
        </div>
      )}
    </>
  )
}