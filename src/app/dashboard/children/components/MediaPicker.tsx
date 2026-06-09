"use client"
import { useRef } from "react"

const MAX_MB = { photo: 15, video: 100 }
const ACCEPT = { photo: "image/*", video: "video/*" }

interface MediaPickerProps {
  type: "photo" | "video"
  preview: string | null
  onPreviewChange: (url: string | null) => void
  existingUrl?: string | null
  onError?: (msg: string | null) => void
}

export function MediaPicker({ type, preview, onPreviewChange, existingUrl, onError }: MediaPickerProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const isPhoto = type === "photo"

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_MB[type] * 1024 * 1024) {
      onError?.(`${isPhoto ? "Photo" : "Video"} must be under ${MAX_MB[type]} MB.`)
      e.target.value = ""
      return
    }
    onError?.(null)
    onPreviewChange(URL.createObjectURL(file))
  }

  const handleRemove = () => {
    onPreviewChange(null)
    if (cameraRef.current) cameraRef.current.value = ""
    if (uploadRef.current) uploadRef.current.value = ""
  }

  return (
    <>
      <input ref={cameraRef} type="file" accept={ACCEPT[type]} capture="environment" onChange={handleFile} className="hidden" />
      <input ref={uploadRef} type="file" accept={ACCEPT[type]} onChange={handleFile} className="hidden" />

      {preview ? (
        isPhoto ? (
          <div className="flex flex-col items-center gap-2">
            <img src={preview} alt="preview" className="h-36 w-36 rounded-full object-cover border-4 border-blue-100" />
            <button type="button" onClick={handleRemove} className="text-xs text-red-500">Remove photo</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <video src={preview} controls className="w-full rounded-xl max-h-48" />
            <button type="button" onClick={handleRemove} className="text-xs text-red-500">Remove video</button>
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
          {!isPhoto && (
            <p className="text-xs text-gray-400 text-center">Child states their name, then does an activity</p>
          )}
        </div>
      )}
    </>
  )
}
