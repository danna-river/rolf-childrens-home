"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { updateChildAction, checkRolfIdForEdit, getLatestIdPreviewForEdit, deleteLibraryItemAction } from "./actions"
import type { UpdateChildInput } from "./actions"
import type { Child } from "@/lib/types"
import { calcAge, toDateString, SUBJECTS, Field, inputClass } from "../../components/form-utils"
import { MediaPicker } from "../../components/MediaPicker"
import { resolvePhotoSrc, resolveVideoThumbnail } from "@/lib/childMedia"
import { AlertTriangleIcon, CornerUpLeftIcon, UploadCloudIcon, CheckCircle2Icon, Loader2Icon, FilmIcon, ImageIcon, Trash2Icon, PlayCircleIcon } from "lucide-react"

interface Props {
  child: Child
  availableCountries: string[]
  isAdmin: boolean 
  initialLibrary: Array<{ id: string; url: string; media_type: string; usage_type: string; filename: string }>
}

export function EditChildForm({ child, availableCountries, isAdmin, initialLibrary }: Props) {
  const router = useRouter()
  const libraryFileRef = useRef<HTMLInputElement>(null)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stagedDriveFileIds, setStagedDriveFileIds] = useState<string[]>([])
  const [libraryUploading, setLibraryUploading] = useState(false)
  const [lastUploadedFilename, setLastUploadedFilename] = useState<string | null>(null)
  
  const [libraryItems, setLibraryItems] = useState(initialLibrary)
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([])

  const [form, setForm] = useState({
    id_rolf: child.id_rolf ?? "",
    first_name: child.first_name ?? "",
    last_name: child.last_name ?? "",
    birthdate: toDateString(child.birth_year, child.birth_month, child.birth_day),
    year_joined: child.date_joined ?? (child.year_joined ? `${child.year_joined}-01-01` : ""),
    country: child.country ?? availableCountries[0] ?? "",
    career_aspiration: child.career_aspiration ?? "",
    favorite_subject: child.favorite_subject ?? "",
    hobby: child.hobby ?? "",
    bio: child.bio ?? "",
    notes: child.notes ?? "",
    status: child.status as 'active' | 'inactive',
  })

  const [photoUrl, setPhotoUrl] = useState<string | null>(child.profile_photo ?? null)
  const [videoUrl, setVideoUrl] = useState<string | null>(child.profile_video ?? null)
  const [initialGeneratedId, setInitialGeneratedId] = useState<string>(child.id_rolf ?? "")

  useEffect(() => {
    if (form.country === child.country) {
      setForm(f => ({ ...f, id_rolf: child.id_rolf ?? "" }))
      setInitialGeneratedId(child.id_rolf ?? "")
      return
    }

    async function syncCountryChangeId() {
      setLoadingPreview(true)
      const { previewId } = await getLatestIdPreviewForEdit(form.country)
      setLoadingPreview(false)

      if (previewId) {
        setInitialGeneratedId(previewId)
        setForm(f => ({ ...f, id_rolf: previewId }))
      }
    }
    syncCountryChangeId()
  }, [form.country, child.country, child.id_rolf])

  const set = (field: keyof typeof form, value: string) => {
    setError(null)
    setForm(f => ({ ...f, [field]: value }))
  }

  const handleProfileMediaChange = (type: "photo" | "video", url: string | null) => {
    if (type === "photo") setPhotoUrl(url)
    if (type === "video") setVideoUrl(url)

    if (url && url.includes("/d/")) {
      const extractedId = url.split("/d/")[1]?.split("/")[0]
      if (extractedId) {
        setStagedDriveFileIds(prev => [...prev, extractedId])
      }
    }
  }

  const handleLibraryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isPhoto = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")
    const maxBytes = (isPhoto ? 15 : 50) * 1024 * 1024

    if (file.size > maxBytes) {
      setError(`${isPhoto ? "Photo" : "Video"} must be under ${isPhoto ? 15 : 50} MB.`)
      return
    }

    setLibraryUploading(true)
    setLastUploadedFilename(null)
    setError(null)

    const body = new FormData()
    body.append("file", file)
    body.append("type", isPhoto ? "photo" : "video")
    body.append("usageType", "library") 
    body.append("childId", child.id)    

    if (form.id_rolf) body.append("idRolf", form.id_rolf)
    if (form.first_name) body.append("firstName", form.first_name)
    if (form.last_name) body.append("lastName", form.last_name)
    if (form.country) body.append("country", form.country)

    const res = await fetch("/api/upload", { method: "POST", body })
    setLibraryUploading(false)

    if (!res.ok) {
      const { error: apiError } = await res.json().catch(() => ({ error: "Upload failed." }))
      setError(apiError ?? "Upload failed. Please try again.")
      return
    }

    const result = await res.json()
    setLastUploadedFilename(file.name)
    
    if (result.fileId) {
      setStagedDriveFileIds(prev => [...prev, result.fileId])
    }

    if (result.dbRecord) {
      setLibraryItems(prev => [result.dbRecord, ...prev])
    } else if (result.fileId && result.url) {
      setLibraryItems(prev => [{
        id: result.id || result.fileId,
        url: result.url,
        media_type: isPhoto ? 'photo' : 'video',
        usage_type: 'library',
        filename: file.name
      }, ...prev])
    }

    if (libraryFileRef.current) libraryFileRef.current.value = ""
  }

  const stageLibraryItemRemoval = (itemId: string) => {
    const targetItem = libraryItems.find(item => item.id === itemId)
    setPendingDeletions(prev => [...prev, itemId])

    if (targetItem) {
      if (targetItem.media_type === 'photo' && photoUrl === targetItem.url) setPhotoUrl(null)
      if (targetItem.media_type === 'video' && videoUrl === targetItem.url) setVideoUrl(null)
    }
  }

  const isFormValid = () => {
    return !!(
      form.first_name.trim() &&
      form.last_name.trim() &&
      form.birthdate &&
      form.year_joined &&
      form.country &&
      form.id_rolf.trim() &&
      form.career_aspiration.trim() &&
      form.favorite_subject.trim() &&
      form.hobby.trim()
    )
  }

  const handleSubmit = async () => {
    setError(null)
    const targetIdCode = form.id_rolf.trim().toUpperCase()

    if (!isFormValid()) {
      setError("All fields marked with * are strictly mandatory fields before updates can be committed.")
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSubmitting(true)

    try {
      if (pendingDeletions.length > 0) {
        for (const deletionId of pendingDeletions) {
          await deleteLibraryItemAction(deletionId)
        }
      }

      const { isValid, error: validationError } = await checkRolfIdForEdit(targetIdCode, form.country, child.id)

      if (!isValid) {
        setError(validationError)
        setSubmitting(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return 
      }

      const [birthYear, birthMonth, birthDay] = form.birthdate.split("-").map(Number)
      const [joinedYear] = form.year_joined ? form.year_joined.split("-").map(Number) : [undefined]

      const input: UpdateChildInput = {
        id_rolf: targetIdCode,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        birth_year: birthYear,
        birth_month: birthMonth,
        birth_day: birthDay,
        year_joined: joinedYear,
        date_joined: form.year_joined || undefined,
        country: form.country,
        career_aspiration: form.career_aspiration.trim(),
        favorite_subject: form.favorite_subject.trim(),
        hobby: form.hobby.trim(),
        bio: form.bio.trim() || undefined,
        notes: form.notes.trim() || undefined,
        profile_photo: photoUrl,
        profile_video: videoUrl,
        status: form.status,
      }

      const targetSessionStagedIds = Array.from(new Set(stagedDriveFileIds))

      const { error: actionError } = await updateChildAction(child.id, input, targetSessionStagedIds)
      if (actionError) {
        setError(actionError)
        setSubmitting(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      router.push("/dashboard/children")
    } catch (err) {
      setError("An unexpected network fault occurred while attempting to write updates to the child record.")
      setSubmitting(false)
    }
  }

  const presets = SUBJECTS.filter(s => s !== "Other")
  const isOther = form.favorite_subject !== "" && !presets.includes(form.favorite_subject)

  const activeLibraryRows = libraryItems.filter(item => !pendingDeletions.includes(item.id))
  const photoLibraryItems = activeLibraryRows.filter(item => item.media_type === 'photo')
  const videoLibraryItems = activeLibraryRows.filter(item => item.media_type === 'video')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* STICKY NAVIGATION HEADER */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-100 shadow-xs">
        <div className="px-4 py-4 flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm font-medium cursor-pointer" disabled={submitting}>
            <CornerUpLeftIcon className="size-4" />
            <span>Cancel</span>
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Modifying Profile Records</p>
            <h1 className="text-base font-bold text-gray-900">{child.first_name} {child.last_name}</h1>
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl leading-relaxed animate-fade-in flex items-start gap-2 shadow-xs">
            <AlertTriangleIcon className="size-4 text-red-500 shrink-0 mt-0.5" />
            <div><strong className="font-semibold block mb-0.5">Validation Stop</strong>{error}</div>
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-6 space-y-5 max-w-lg mx-auto w-full pb-32">

        {/* Basic Info */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">Basic Info</h2>
          <Field label="Country *" htmlFor="country">
            <select id="country" value={form.country} onChange={e => set("country", e.target.value)} className={inputClass} required>
              <option value="" disabled>Select active region...</option>
              {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={isAdmin ? "ROLF ID *" : "ROLF ID"} htmlFor="id_rolf">
            {loadingPreview ? (
              <div className="py-3 px-4 bg-gray-50 text-xs text-gray-400 font-medium italic border border-gray-100 rounded-xl">Syncing code identifier sequence...</div>
            ) : isAdmin ? (
              <input id="id_rolf" value={form.id_rolf} onChange={e => set("id_rolf", e.target.value.toUpperCase())} className={inputClass + " font-mono tracking-wider bg-white border-blue-200 focus:border-blue-600 font-semibold text-gray-800"} />
            ) : (
              <input id="id_rolf_locked" value={form.id_rolf} disabled className={inputClass + " bg-gray-100 border-gray-200 text-gray-500 font-mono tracking-wider select-none cursor-not-allowed font-semibold"} />
            )}
          </Field>
          <Field label="First Name *" htmlFor="first_name">
            <input id="first_name" value={form.first_name} onChange={e => set("first_name", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Last Name *" htmlFor="last_name">
            <input id="last_name" value={form.last_name} onChange={e => set("last_name", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Date of Birth *" htmlFor="birthdate">
            <input id="birthdate" type="date" value={form.birthdate} onChange={e => set("birthdate", e.target.value)} max={new Date().toISOString().split("T")[0]} className={inputClass} />
          </Field>
          <Field label="Date Joined Home *" htmlFor="year_joined">
            <input id="year_joined" type="date" value={form.year_joined} onChange={e => set("year_joined", e.target.value)} max={new Date().toISOString().split("T")[0]} className={inputClass} />
          </Field>
        </section>

        {/* About Them */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">About Them</h2>
          <Field label="What do you want to be when you grow up? *" htmlFor="career">
            <input id="career" value={form.career_aspiration} onChange={e => set("career_aspiration", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Favorite Subject *" htmlFor="subject">
            <div className="grid grid-cols-2 gap-2">
              {presets.map(s => (
                <button key={s} type="button" onClick={() => set("favorite_subject", s)} className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left cursor-pointer ${form.favorite_subject === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"}`}>{s}</button>
              ))}
              <button type="button" onClick={() => set("favorite_subject", " ")} className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left cursor-pointer ${isOther ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"}`}>Other</button>
            </div>
            {isOther && <input autoFocus value={form.favorite_subject.trim()} onChange={e => set("favorite_subject", e.target.value)} className={inputClass + " mt-2"} />}
          </Field>
          <Field label="Hobbies *" htmlFor="hobby">
            <textarea id="hobby" value={form.hobby} onChange={e => set("hobby", e.target.value)} rows={3} className={inputClass + " resize-none"} />
          </Field>
          <Field label="Bio (Optional)" htmlFor="bio">
            <textarea id="bio" value={form.bio} onChange={e => set("bio", e.target.value)} rows={4} className={inputClass + " resize-none"} />
          </Field>
        </section>

        {/* Photo & Video (Assignment Area) */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">Active Profile Media</h2>
          
          <Field label="Profile Photo" htmlFor="photo">
            <MediaPicker
              type="photo"
              value={photoUrl}
              onChange={url => handleProfileMediaChange("photo", url)}
              existingUrl={photoUrl}
              onError={setError}
              onUploadStart={() => setMediaUploading(true)}
              onUploadEnd={() => setMediaUploading(false)}
              childMeta={{ idRolf: form.id_rolf, firstName: form.first_name, lastName: form.last_name, country: form.country }}
            />
          </Field>
          
          <Field label="Short Video (~30 sec)" htmlFor="video">
            <MediaPicker
              type="video"
              value={videoUrl}
              onChange={url => handleProfileMediaChange("video", url)}
              existingUrl={videoUrl}
              onError={setError}
              onUploadStart={() => setMediaUploading(true)}
              onUploadEnd={() => setMediaUploading(false)}
              childMeta={{ idRolf: form.id_rolf, firstName: form.first_name, lastName: form.last_name, country: form.country }}
            />
          </Field>
        </section>

        {/* LIBRARY MODULE */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-5 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">Media Library Portfolio</h2>
          
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 bg-gray-50/50 rounded-xl transition-all hover:bg-gray-50">
            {libraryUploading ? (
              <div className="flex flex-col items-center gap-2 py-4 animate-pulse">
                <Loader2Icon className="size-8 text-blue-600 animate-spin" />
                <p className="text-xs font-medium text-gray-600">Uploading file directly via API stream...</p>
              </div>
            ) : (
              <button type="button" onClick={() => libraryFileRef.current?.click()} className="flex flex-col items-center gap-2 w-full text-center cursor-pointer group">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-full group-hover:bg-blue-100 transition-colors">
                  <UploadCloudIcon className="size-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Add asset to child library</p>
                  <p className="text-xs text-gray-400 mt-0.5">Supports images up to 15MB, videos up to 50MB</p>
                </div>
              </button>
            )}

            <input type="file" ref={libraryFileRef} accept="image/*,video/*" onChange={handleLibraryUpload} className="hidden" />
          </div>

          {lastUploadedFilename && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-xl flex items-center gap-2.5 animate-fade-in">
              <CheckCircle2Icon className="size-4 text-green-600 shrink-0" />
              <div className="text-xs text-green-800 leading-normal">
                <span className="font-semibold block text-green-900">Upload Secured</span> Stored <code className="font-mono bg-white px-1 py-0.5 border border-green-200 rounded text-[11px]">{lastUploadedFilename}</code> on Drive.
              </div>
            </div>
          )}

          {activeLibraryRows.length === 0 ? (
            <div className="py-8 text-center border border-gray-100 rounded-xl bg-gray-50/40">
              <p className="text-xs font-medium text-gray-400">No media files in library</p>
            </div>
          ) : (
            <div className="space-y-6 pt-1 max-w-full overflow-hidden">
              
              {/* --- PHOTOS TRACK --- */}
              <div>
                <div className="flex items-center gap-1.5 mb-2.5 border-b border-gray-50 pb-1">
                  <ImageIcon className="size-3.5 text-gray-400" />
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Photos ({photoLibraryItems.length})</p>
                </div>
                {photoLibraryItems.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic pl-1">No photographs loaded.</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin snap-x scroll-smooth">
                    {photoLibraryItems.map((item) => {
                      const isCurrentProfile = photoUrl === item.url
                      const resolvedImageSrc = resolvePhotoSrc(item.url) || item.url

                      return (
                        <div key={item.id} className={`relative flex-none w-32 aspect-square rounded-xl border bg-gray-50 overflow-hidden group snap-start shadow-xs transition-transform ${isCurrentProfile ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-100'}`}>
                          <img src={resolvedImageSrc} alt={item.filename} className="w-full h-full object-cover" />
                          
                          <div className="absolute top-0 inset-x-0 p-1.5 bg-black/60 backdrop-blur-xs flex flex-col gap-0.5">
                            <p className="text-[9px] font-medium text-white truncate max-w-full px-0.5" title={item.filename}>{item.filename}</p>
                            {isCurrentProfile && (
                              <span className="text-[7px] font-black text-blue-400 tracking-wider uppercase block mt-0.5">Profile Photo</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => stageLibraryItemRemoval(item.id)}
                            className="absolute inset-0 bg-red-600/90 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-bold text-[11px] rounded-xl"
                          >
                            <Trash2Icon className="size-4 text-white" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* --- VIDEOS TRACK --- */}
              <div>
                <div className="flex items-center gap-1.5 mb-2.5 border-b border-gray-50 pb-1">
                  <FilmIcon className="size-3.5 text-gray-400" />
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Videos ({videoLibraryItems.length})</p>
                </div>
                {videoLibraryItems.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic pl-1">No video segments loaded.</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin snap-x scroll-smooth">
                    {videoLibraryItems.map((item) => {
                      const isCurrentVideo = videoUrl === item.url
                      const resolvedVideoThumb = resolveVideoThumbnail(item.url) || ''

                      return (
                        // ⚡ DIMS SYNCED FIX: Forced video elements into identical w-32 aspect-square frame dimensions
                        <div key={item.id} className={`relative flex-none w-32 aspect-square rounded-xl border bg-slate-950 overflow-hidden group snap-start shadow-xs transition-transform ${isCurrentVideo ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-100'}`}>
                          
                          {resolvedVideoThumb ? (
                            <div className="relative w-full h-full">
                              <img src={resolvedVideoThumb} alt={item.filename} className="w-full h-full object-cover opacity-75" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <PlayCircleIcon className="size-7 text-white/90 drop-shadow-md" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-900">
                              <FilmIcon className="size-5 text-slate-600" />
                            </div>
                          )}
                          
                          <div className="absolute top-0 inset-x-0 p-1.5 bg-black/60 backdrop-blur-xs flex flex-col gap-0.5">
                            <p className="text-[9px] font-medium text-white truncate max-w-full px-0.5" title={item.filename}>{item.filename}</p>
                            {isCurrentVideo && (
                              <span className="text-[7px] font-black text-blue-400 tracking-wider uppercase block mt-0.5">Profile Video</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => stageLibraryItemRemoval(item.id)}
                            className="absolute inset-0 bg-red-600/90 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-bold text-[11px] rounded-xl z-20"
                          >
                            <Trash2Icon className="size-4 text-white" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {pendingDeletions.length > 0 && (
                <p className="text-[11px] text-red-500 font-semibold italic animate-pulse">
                  ⚠️ {pendingDeletions.length} media asset(s) marked for permanent removal. Click "Save Changes" below to write deletions to disk.
                </p>
              )}

            </div>
          )}
        </section>

        {/* Status */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">Status</h2>
          <Field label="Child Status" htmlFor="status">
            <div className="flex gap-3">
              {(['active', 'inactive'] as const).map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))} className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors capitalize cursor-pointer ${form.status === s ? s === 'active' ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"}`}>{s}</button>
              ))}
            </div>
          </Field>
        </section>

        {/* Notes */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">Internal Notes (Optional)</h2>
          <Field label="Internal Notes" htmlFor="notes">
            <textarea id="notes" value={form.notes} onChange={e => set("notes", e.target.value)} rows={4} className={inputClass + " resize-none"} />
          </Field>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 max-w-lg mx-auto z-40">
        <button
          onClick={handleSubmit}
          disabled={!isFormValid() || mediaUploading || submitting || loadingPreview || libraryUploading}
          className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm transition-colors duration-150 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400"
        >
          {submitting ? "Saving Changes..." : mediaUploading || libraryUploading ? "Processing Media..." : "Save Changes"}
        </button>
      </div>
    </div>
  )
}