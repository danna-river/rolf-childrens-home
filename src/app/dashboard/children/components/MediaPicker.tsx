"use client"
import { useRef, useState } from "react"
import {
  extractDriveFileId,
  getDriveVideoPreview,
  isGoogleDriveUrl,
  resolvePhotoSrc,
} from "@/lib/childMedia"
import { completeDriveUpload, createDriveUploadSession } from "@/lib/googleDrive"
import { useTranslations } from "@/i18n/client"

const MAX_MB = { photo: 15, video: 50 }
const ACCEPT = { photo: "image/*", video: "video/*" }
const UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024

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
  const t = useTranslations()
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
      onError?.(
        t(isPhoto ? "children.media.photoTooLarge" : "children.media.videoTooLarge").replace(
          "{size}",
          String(MAX_MB[type]),
        ),
      )
      e.target.value = ""
      return
    }
    onError?.(null)
    setLocalPreview(URL.createObjectURL(file))
    setUploading(true)
    onUploadStart?.()

    try {
      const uploadTarget = await createDriveUploadSession({
        type,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        meta: {
          idRolf: childMeta?.idRolf ?? null,
          firstName: childMeta?.firstName ?? null,
          lastName: childMeta?.lastName ?? null,
          country: childMeta?.country ?? null,
          folderOverride: "SYSTEM_TRASH",
        },
      })

      if (uploadTarget.error || !uploadTarget.uploadUrl) {
        throw new Error(uploadTarget.error ?? "Missing Google Drive upload session")
      }

      let uploadUrl = uploadTarget.uploadUrl
      let offset = 0
      let fileId: string | null = null

      while (offset < file.size) {
        const chunk = file.slice(offset, Math.min(offset + UPLOAD_CHUNK_BYTES, file.size))
        const end = offset + chunk.size - 1
        const uploadResponse = await fetch("/api/upload/drive-chunk", {
          method: "POST",
          headers: {
            "Content-Type": file.type,
            "Content-Range": `bytes ${offset}-${end}/${file.size}`,
            "X-Drive-Upload-Url": uploadUrl,
          },
          body: chunk,
        })
        const result = await uploadResponse.json().catch(() => null) as {
          done?: boolean
          fileId?: string
          nextOffset?: number
          uploadUrl?: string
        } | null

        if (!uploadResponse.ok || !result) {
          throw new Error("Google Drive chunk upload failed")
        }

        uploadUrl = result.uploadUrl ?? uploadUrl
        if (result.done) {
          fileId = result.fileId ?? null
          break
        }

        const nextOffset = result.nextOffset
        if (
          typeof nextOffset !== "number" ||
          !Number.isSafeInteger(nextOffset) ||
          nextOffset <= offset ||
          nextOffset > file.size
        ) {
          throw new Error("Google Drive returned an invalid upload offset")
        }
        offset = nextOffset
      }

      if (!fileId) {
        throw new Error("Google Drive did not return a file ID")
      }

      const completed = await completeDriveUpload(fileId)
      if (completed.error || !completed.url) {
        throw new Error(completed.error ?? "Google Drive file could not be finalized")
      }

      setLocalPreview(null)
      onChange(completed.url, { fileId })
    } catch (error) {
      console.error("[MediaPicker] Google Drive upload failed:", error)
      onError?.(t("children.media.uploadFailedRetry"))
      setLocalPreview(null)
    } finally {
      setUploading(false)
      onUploadEnd?.()
    }
  }

  const handleDriveApply = () => {
    const link = driveInput.trim()
    if (!extractDriveFileId(link) || !isGoogleDriveUrl(link)) {
      onError?.(t("children.media.invalidDriveLink"))
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
              {/* eslint-disable-next-line @next/next/no-img-element -- child media can be S3 or Google Drive URLs that are resolved at runtime. */}
              <img src={resolvePhotoSrc(previewSrc) ?? previewSrc} alt="preview" referrerPolicy="no-referrer" className="h-36 w-36 rounded-full object-cover border-4 border-blue-100" />
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <span className="text-xs text-white font-medium">{t("children.media.uploadingPhoto")}</span>
                </div>
              )}
            </div>
            {isDriveValue && <p className="text-xs text-gray-400">{t("children.media.driveLink")}</p>}
            {!uploading && <button type="button" onClick={handleRemove} className="text-xs text-red-500">{t("children.media.removePhoto")}</button>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {uploading ? (
              <div className="w-full aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                <p className="text-xs text-blue-500 font-medium">{t("children.media.uploadingVideo")}</p>
              </div>
            ) : isDriveValue ? (
              <iframe
                src={getDriveVideoPreview(extractDriveFileId(value) as string)}
                allow="autoplay"
                allowFullScreen
                title={t("children.media.videoPreviewTitle")}
                className="w-full aspect-video rounded-xl"
              />
            ) : (
              <video src={previewSrc} controls className="w-full rounded-xl max-h-48" />
            )}
            {isDriveValue && (
              <p className="text-xs text-gray-400">
                {t("children.media.driveVideoProcessing")}
              </p>
            )}
            {!uploading && <button type="button" onClick={handleRemove} className="text-xs text-red-500">{t("children.media.removeVideo")}</button>}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {isPhoto && existingUrl && (
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              {t("children.media.existingPhoto")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-300 transition-colors">
              <span className="text-2xl">{isPhoto ? "📷" : "🎥"}</span>
              <span className="text-xs font-medium text-gray-600">
                {isPhoto ? (existingUrl ? t("children.media.retakePhoto") : t("children.media.takePhoto")) : t("children.media.recordVideo")}
              </span>
            </button>
            <button type="button" onClick={() => uploadRef.current?.click()}
              className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-300 transition-colors">
              <span className="text-2xl">{isPhoto ? "🖼️" : "📁"}</span>
              <span className="text-xs font-medium text-gray-600">
                {isPhoto ? (existingUrl ? t("children.media.replaceFile") : t("children.media.uploadFile")) : t("children.media.uploadFile")}
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
                <p className="text-xs text-gray-400">{t("children.media.driveHint")}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={handleDriveApply}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors">
                    {t("children.media.useLink")}
                  </button>
                  <button type="button" onClick={() => { setShowDrive(false); setDriveInput(""); onError?.(null) }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">
                    {t("children.media.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowDrive(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white py-3 hover:border-blue-300 transition-colors">
                <span className="text-base">🔗</span>
                <span className="text-xs font-medium text-gray-600">{t("children.media.useDriveLink")}</span>
              </button>
            )
          )}

          {!isPhoto && !showDrive && (
            <p className="text-xs text-gray-400 text-center">{t("children.media.videoInstruction")}</p>
          )}
        </div>
      )}
    </>
  )
}
