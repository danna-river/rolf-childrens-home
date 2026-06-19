"use client"
import { useRef, useState } from "react"
import { getUploadUrl } from "@/lib/storageActions"

const MAX_MB = { photo: 15, video: 100 }
const ACCEPT = { photo: "image/*", video: "video/*" }

interface MediaPickerProps {
  type: "photo" | "video"
  value: string | null
  onChange: (url: string | null) => void
  existingUrl?: string | null
  onError?: (msg: string | null) => void
  onUploadStart?: () => void
  onUploadEnd?: () => void
}

export function MediaPicker({
  type, value, onChange, existingUrl, onError, onUploadStart, onUploadEnd,
}: MediaPickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const isPhoto = type === "photo"

  const previewSrc = localPreview ?? value

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

    const ext = file.name.split(".").pop() ?? (isPhoto ? "jpg" : "mp4")
    const path = `${type}s/${crypto.randomUUID()}.${ext}`
    const { signedUrl, publicUrl, error } = await getUploadUrl(path)

    if (error || !signedUrl || !publicUrl) {
      onError?.(error ?? "Upload failed.")
      setLocalPreview(null)
      setUploading(false)
      onUploadEnd?.()
      return
    }

    const res = await fetch(signedUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    })

    if (!res.ok) {
      onError?.("Upload failed. Please try again.")
      setLocalPreview(null)
      setUploading(false)
      onUploadEnd?.()
      return
    }

    setLocalPreview(null)
    setUploading(false)
    onUploadEnd?.()
    onChange(publicUrl)
  }

  const handleRemove = () => {
    onChange(null)
    setLocalPreview(null)
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
              <img src={previewSrc} alt="preview" className="h-36 w-36 rounded-full object-cover border-4 border-blue-100" />
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <span className="text-sm text-white font-medium">Uploading…</span>
                </div>
              )}
            </div>
            {!uploading && <button type="button" onClick={handleRemove} className="text-sm text-red-500">Remove photo</button>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {uploading ? (
              <div className="w-full aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                <p className="text-sm text-blue-500 font-medium">Uploading video…</p>
              </div>
            ) : (
              <video src={previewSrc} controls className="w-full rounded-xl max-h-48" />
            )}
            {!uploading && <button type="button" onClick={handleRemove} className="text-sm text-red-500">Remove video</button>}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {isPhoto && existingUrl && (
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Existing photo on file — select below to replace it.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-300 transition-colors">
              <span className="text-2xl">{isPhoto ? "📷" : "🎥"}</span>
              <span className="text-sm font-medium text-gray-600">
                {isPhoto ? (existingUrl ? "Retake Photo" : "Take Photo") : "Record Video"}
              </span>
            </button>
            <button type="button" onClick={() => uploadRef.current?.click()}
              className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-300 transition-colors">
              <span className="text-2xl">{isPhoto ? "🖼️" : "📁"}</span>
              <span className="text-sm font-medium text-gray-600">
                {isPhoto ? (existingUrl ? "Replace File" : "Upload File") : "Upload File"}
              </span>
            </button>
          </div>
          {!isPhoto && (
            <p className="text-sm text-gray-600 text-center">Child states their name, then does an activity</p>
          )}
        </div>
      )}
    </>
  )
}
