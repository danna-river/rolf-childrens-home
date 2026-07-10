"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { updateChildAction, checkRolfIdForEdit, getLatestIdPreviewForEdit, deleteLibraryItemAction } from "./actions"
import type { UpdateChildInput } from "./actions"
import type { Child } from "@/lib/types"
import { calcAge, toDateString, SUBJECTS, Field, inputClass } from "../../components/form-utils"
import { MediaPicker } from "../../components/MediaPicker"
import { enrollChildProfilePhoto } from "@/lib/face/enroll"
import { resolvePhotoSrc, resolveVideoThumbnail } from "@/lib/childMedia"
import { AlertTriangleIcon, CornerUpLeftIcon, UploadCloudIcon, CheckCircle2Icon, Loader2Icon, FilmIcon, ImageIcon, Trash2Icon, PlayCircleIcon } from "lucide-react"
import { useTranslations } from "@/i18n/client"
import type { MessageKey } from "@/i18n/locales/en"

interface Props {
  child: Child
  availableCountries: string[]
  isAdmin: boolean 
  initialLibrary: Array<{ id: string; url: string; media_type: string; usage_type: string; filename: string }>
}

const MEDIA_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function mediaThumbnailSrc(item: Props['initialLibrary'][number]): string {
  if (MEDIA_ID_PATTERN.test(item.id)) {
    return `/api/media/${item.id}/thumbnail`
  }

  if (item.media_type === 'photo') {
    return resolvePhotoSrc(item.url) || item.url
  }

  return resolveVideoThumbnail(item.url) || ''
}

export function EditChildForm({ child, availableCountries, isAdmin, initialLibrary }: Props) {
  const t = useTranslations()
  const router = useRouter()
  const libraryFileRef = useRef<HTMLInputElement>(null)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [indexingFace, setIndexingFace] = useState(false)
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

  const handleCountryChange = (value: string) => {
    setError(null)
    if (value === child.country) {
      setInitialGeneratedId(child.id_rolf ?? "")
      setForm(f => ({ ...f, country: value, id_rolf: child.id_rolf ?? "" }))
      return
    }
    setForm(f => ({ ...f, country: value }))
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
      setError(t('children.edit.requiredError'))
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

      // Best-effort face-search enrollment when the profile photo changed
      // (replacing/removing a photo already invalidates the old template in
      // the database). Failures never block the save — the admin backfill
      // queue picks the child up later.
      if (photoUrl && photoUrl !== (child.profile_photo ?? null)) {
        setIndexingFace(true)
        await enrollChildProfilePhoto(child.id)
        setIndexingFace(false)
      }

      router.push("/dashboard/children")
    } catch {
      setError(t('children.edit.networkError'))
      setSubmitting(false)
    }
  }

  const presets = SUBJECTS.filter(s => s !== "Other")
  const isOther = form.favorite_subject !== "" && !presets.includes(form.favorite_subject)
  const subjectLabel = (subject: string): string => {
    const labels: Record<string, MessageKey> = {
      Math: 'children.subject.math',
      Language: 'children.subject.language',
      Science: 'children.subject.science',
      'Social Studies': 'children.subject.socialStudies',
      'Gym / PE': 'children.subject.gym',
      Music: 'children.subject.music',
      Art: 'children.subject.art',
      History: 'children.subject.history',
      Other: 'children.subject.other',
    }
    return labels[subject] ? t(labels[subject]) : subject
  }

  const activeLibraryRows = libraryItems.filter(item => !pendingDeletions.includes(item.id))
  const photoLibraryItems = activeLibraryRows.filter(item => item.media_type === 'photo')
  const videoLibraryItems = activeLibraryRows.filter(item => item.media_type === 'video')

  return (
    <div className="google-sans-registry min-h-screen bg-ice flex flex-col">
      {/* STICKY NAVIGATION HEADER */}
      <div className="sticky top-16 z-40 bg-white border-b border-stone shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={submitting}
            className="text-navy/60 hover:text-navy text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <CornerUpLeftIcon className="size-4" />
            <span>{t('children.edit.cancel')}</span>
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/45">{t('children.edit.header')}</p>
            <h1 className="text-base font-bold text-navy">
              {child.first_name} {child.last_name}
            </h1>
          </div>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl leading-relaxed animate-fade-in flex items-start gap-2 shadow-xs">
            <AlertTriangleIcon className="size-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold block mb-0.5">{t('children.register.validationStop')}</strong>
              {error}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 px-4 py-6 space-y-5 max-w-lg mx-auto w-full pb-32">

        {/* Basic Info */}
        <section className="bg-white rounded-xl border border-stone divide-y divide-stone/60 shadow-2xs">
          <div className="p-5 space-y-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-navy/45 border-b border-stone/60 pb-2">{t('children.edit.basicInfo')}</h2>

            <Field label={t('children.register.country')} htmlFor="country">
              <select
                id="country"
                value={form.country}
                onChange={e => handleCountryChange(e.target.value)}
                className={inputClass}
                required
              >
                <option value="" disabled>{t('children.edit.selectRegion')}</option>
                {availableCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label={isAdmin ? t('children.register.rolfIdRequired') : t('children.register.rolfId')} htmlFor="id_rolf">
              {loadingPreview ? (
                <div className="py-3 px-4 bg-ice text-xs text-navy/40 font-medium italic border border-stone rounded-xl">
                  {t('children.edit.syncingId')}
                </div>
              ) : isAdmin ? (
                <input
                  id="id_rolf"
                  value={form.id_rolf}
                  onChange={e => set("id_rolf", e.target.value.toUpperCase())}
                  className={inputClass + " font-mono tracking-wider bg-white border-teal/40 focus:border-teal font-semibold text-navy"}
                />
              ) : (
                <input
                  id="id_rolf_locked"
                  value={form.id_rolf}
                  disabled
                  className={inputClass + " bg-ice border-stone text-navy/70 font-mono tracking-wider select-none cursor-not-allowed font-semibold"}
                />
              )}

              {isAdmin && form.id_rolf && form.id_rolf !== initialGeneratedId && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 text-[11px] text-amber-700 rounded-xl leading-normal animate-fade-in flex items-start gap-1.5">
                  <AlertTriangleIcon className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>{t('children.register.idNoticeLabel')}</strong> {t('children.edit.idNotice')}
                  </div>
                </div>
              )}

              <p className="text-xs text-navy/45 mt-1.5">
                {isAdmin
                  ? t('children.register.idHelpAdmin')
                  : t('children.edit.idHelpStaff')}
              </p>
            </Field>

            <Field label={t('children.register.firstName')} htmlFor="first_name">
              <input id="first_name" value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="e.g. Grace" className={inputClass} />
            </Field>

            <Field label={t('children.register.lastName')} htmlFor="last_name">
              <input id="last_name" value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="e.g. Nakato" className={inputClass} />
            </Field>

            <Field label={t('children.register.dateOfBirth')} htmlFor="birthdate">
              <input
                id="birthdate"
                type="date"
                value={form.birthdate}
                onChange={e => set("birthdate", e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                min="2000-01-01"
                className={inputClass}
              />
              {form.birthdate && (
                <div className="mt-2 inline-flex items-baseline gap-1.5 bg-sky/50 border border-sky rounded-xl px-4 py-2">
                  <span className="text-sm font-semibold text-navy">{calcAge(form.birthdate)}</span>
                  <span className="text-sm text-navy/50">{t('children.register.yearsOld')}</span>
                </div>
              )}
            </Field>

            <Field label={t('children.register.dateJoinedHome')} htmlFor="year_joined">
              <input
                id="year_joined"
                type="date"
                value={form.year_joined}
                onChange={e => set("year_joined", e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                min="2000-01-01"
                className={inputClass}
              />
              {form.year_joined && (
                <div className="mt-2 inline-flex items-baseline gap-1.5 bg-sky/50 border border-sky rounded-xl px-4 py-2">
                  <span className="text-sm font-semibold text-navy">{calcAge(form.year_joined)}</span>
                  <span className="text-sm text-navy/50">{t('children.edit.yearsInHome')}</span>
                </div>
              )}
            </Field>
          </div>
        </section>

        {/* About Them */}
        <section className="bg-white rounded-xl border border-stone divide-y divide-stone/60 shadow-2xs">
          <div className="p-5 space-y-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-navy/45 border-b border-stone/60 pb-2">{t('children.edit.aboutThem')}</h2>
            <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium leading-relaxed text-amber-700">
              {t('children.edit.englishOnlyHelp')}
            </p>

            <Field label={t('children.register.careerQuestion')} htmlFor="career">
              <input
                id="career"
                value={form.career_aspiration}
                onChange={e => set("career_aspiration", e.target.value)}
                placeholder={t('children.edit.careerPlaceholder')}
                className={inputClass}
              />
            </Field>

            <Field label={t('children.register.favoriteSubject')} htmlFor="subject">
              <div className="grid grid-cols-2 gap-2">
                {presets.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("favorite_subject", s)}
                    className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left cursor-pointer ${
                      form.favorite_subject === s
                        ? "bg-navy text-white border-navy"
                        : "bg-white text-navy/70 border-stone hover:border-teal"
                    }`}
                  >
                    {subjectLabel(s)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => set("favorite_subject", " ")}
                  className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left cursor-pointer ${
                    isOther
                      ? "bg-navy text-white border-navy"
                      : "bg-white text-navy/70 border-stone hover:border-teal"
                  }`}
                >
                  {t('children.subject.other')}
                </button>
              </div>
              {isOther && (
                <input
                  autoFocus
                  value={form.favorite_subject.trim()}
                  onChange={e => set("favorite_subject", e.target.value)}
                  placeholder={t('children.edit.customSubjectPlaceholder')}
                  className={inputClass + " mt-2"}
                />
              )}
            </Field>

            <Field label={t('children.register.hobbies')} htmlFor="hobby">
              <textarea
                id="hobby"
                value={form.hobby}
                onChange={e => set("hobby", e.target.value)}
                placeholder={t('children.edit.hobbiesPlaceholder')}
                rows={3}
                className={inputClass + " resize-none"}
              />
            </Field>

            <Field label={t('children.edit.bioOptional')} htmlFor="bio">
              <textarea
                id="bio"
                value={form.bio}
                onChange={e => set("bio", e.target.value)}
                placeholder={t('children.edit.bioPlaceholder')}
                rows={4}
                className={inputClass + " resize-none"}
              />
            </Field>
          </div>
        </section>

        {/* Photo & Video Assignment */}
        <section className="bg-white rounded-xl border border-stone divide-y divide-stone/60 shadow-2xs">
          <div className="p-5 space-y-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-navy/45 border-b border-stone/60 pb-2">{t('children.edit.photoVideo')}</h2>
            <p className="text-xs text-navy/45">{t('children.register.mediaLimit')}</p>
            <Field label={t('children.register.profilePhoto')} htmlFor="photo">
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
            <Field label={t('children.register.shortVideo')} htmlFor="video">
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
          </div>
        </section>

        {/* Library Module */}
        <section className="bg-white rounded-xl border border-stone divide-y divide-stone/60 shadow-2xs">
          <div className="p-5 space-y-5">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-navy/45 border-b border-stone/60 pb-2">Media Library Portfolio</h2>
            
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-stone bg-ice/50 rounded-xl transition-all hover:bg-ice">
              {libraryUploading ? (
                <div className="flex flex-col items-center gap-2 py-4 animate-pulse">
                  <Loader2Icon className="size-8 text-teal animate-spin" />
                  <p className="text-xs font-medium text-navy/60">Uploading file directly via API stream...</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => libraryFileRef.current?.click()}
                  className="flex flex-col items-center gap-2 w-full text-center cursor-pointer group"
                >
                  <div className="p-3 bg-teal/10 text-teal rounded-full group-hover:bg-teal/20 transition-colors">
                    <UploadCloudIcon className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">Add asset to child library</p>
                    <p className="text-xs text-navy/45 mt-0.5">Supports images up to 15MB, videos up to 50MB</p>
                  </div>
                </button>
              )}

              <input type="file" ref={libraryFileRef} accept="image/*,video/*" onChange={handleLibraryUpload} className="hidden" />
            </div>

            {lastUploadedFilename && (
              <div className="p-3 bg-teal/10 border border-teal/20 rounded-xl flex items-center gap-2.5 animate-fade-in">
                <CheckCircle2Icon className="size-4 text-teal shrink-0" />
                <div className="text-xs text-navy leading-normal">
                  <span className="font-semibold block text-navy">Upload Secured</span>
                  Stored <code className="font-mono bg-white px-1 py-0.5 border border-teal/20 rounded text-[11px]">{lastUploadedFilename}</code> on Drive.
                </div>
              </div>
            )}

            {activeLibraryRows.length === 0 ? (
              <div className="py-8 text-center border border-stone rounded-xl bg-ice/50">
                <p className="text-xs font-medium text-navy/40">No media files in library</p>
              </div>
            ) : (
              <div className="space-y-6 pt-1 max-w-full overflow-hidden">
                
                {/* Photos */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5 border-b border-stone/60 pb-1">
                    <ImageIcon className="size-3.5 text-navy/40" />
                    <p className="text-[11px] font-bold text-navy/40 uppercase tracking-wide">Photos ({photoLibraryItems.length})</p>
                  </div>
                  {photoLibraryItems.length === 0 ? (
                    <p className="text-[11px] text-navy/40 italic pl-1">No photographs loaded.</p>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin snap-x scroll-smooth">
                      {photoLibraryItems.map((item) => {
                        const isCurrentProfile = photoUrl === item.url
                        const resolvedImageSrc = mediaThumbnailSrc(item)

                        return (
                          <div
                            key={item.id}
                            className={`relative flex-none w-32 aspect-square rounded-xl border bg-stone/20 overflow-hidden group snap-start shadow-xs transition-transform ${
                              isCurrentProfile ? 'border-teal ring-2 ring-teal/20' : 'border-stone'
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={resolvedImageSrc} alt={item.filename} className="w-full h-full object-cover" />
                            
                            <div className="absolute top-0 inset-x-0 p-1.5 bg-navy/60 backdrop-blur-xs flex flex-col gap-0.5">
                              <p className="text-[9px] font-medium text-white truncate max-w-full px-0.5" title={item.filename}>{item.filename}</p>
                              {isCurrentProfile && (
                                <span className="text-[7px] font-black text-teal tracking-wider uppercase block mt-0.5">Profile Photo</span>
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

                {/* Videos */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2.5 border-b border-stone/60 pb-1">
                    <FilmIcon className="size-3.5 text-navy/40" />
                    <p className="text-[11px] font-bold text-navy/40 uppercase tracking-wide">Videos ({videoLibraryItems.length})</p>
                  </div>
                  {videoLibraryItems.length === 0 ? (
                    <p className="text-[11px] text-navy/40 italic pl-1">No video segments loaded.</p>
                  ) : (
                    <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin snap-x scroll-smooth">
                      {videoLibraryItems.map((item) => {
                        const isCurrentVideo = videoUrl === item.url
                        const resolvedVideoThumb = mediaThumbnailSrc(item)

                        return (
                          <div
                            key={item.id}
                            className={`relative flex-none w-32 aspect-square rounded-xl border bg-slate-950 overflow-hidden group snap-start shadow-xs transition-transform ${
                              isCurrentVideo ? 'border-teal ring-2 ring-teal/20' : 'border-stone'
                            }`}
                          >
                            {resolvedVideoThumb ? (
                              <div className="relative w-full h-full">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                            
                            <div className="absolute top-0 inset-x-0 p-1.5 bg-navy/60 backdrop-blur-xs flex flex-col gap-0.5">
                              <p className="text-[9px] font-medium text-white truncate max-w-full px-0.5" title={item.filename}>{item.filename}</p>
                              {isCurrentVideo && (
                                <span className="text-[7px] font-black text-teal tracking-wider uppercase block mt-0.5">Profile Video</span>
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
                  <p className="text-[11px] text-red-500 font-semibold italic animate-pulse flex items-center gap-1">
                    <AlertTriangleIcon className="size-3 text-red-500" />
                    {pendingDeletions.length} media asset(s) marked for permanent removal. Click &quot;Save Changes&quot; below to write deletions to disk.
                  </p>
                )}

              </div>
            )}
          </div>
        </section>

        {/* Status */}
        <section className="bg-white rounded-xl border border-stone divide-y divide-stone/60 shadow-2xs">
          <div className="p-5 space-y-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-navy/45 border-b border-stone/60 pb-2">{t('children.edit.status')}</h2>
            <Field label={t('children.edit.childStatus')} htmlFor="status">
              <div className="flex gap-3">
                {(['active', 'inactive'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: s }))}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors capitalize cursor-pointer ${
                      form.status === s
                        ? s === 'active'
                          ? "bg-navy text-white border-navy"
                          : "bg-red-500 text-white border-red-500"
                        : "bg-white text-navy/70 border-stone hover:border-teal"
                    }`}
                  >
                    {s === 'active' ? t('children.registry.active') : t('children.registry.inactive')}
                  </button>
                ))}
              </div>
              {form.status === 'inactive' && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2 leading-relaxed">
                  {t('children.edit.inactiveHelp')}
                </p>
              )}
            </Field>
          </div>
        </section>

        {/* Notes */}
        <section className="bg-white rounded-xl border border-stone divide-y divide-stone/60 shadow-2xs">
          <div className="p-5 space-y-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-navy/45 border-b border-stone/60 pb-2">{t('children.edit.internalNotesTitle')}</h2>
            <Field label={t('children.detail.internalNotes')} htmlFor="notes">
              <textarea
                id="notes"
                value={form.notes}
                onChange={e => set("notes", e.target.value)}
                placeholder={t('children.edit.notesPlaceholder')}
                rows={4}
                className={inputClass + " resize-none"}
              />
            </Field>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 bg-white border-t border-stone px-4 py-4 mt-auto z-40">
        <button
          onClick={handleSubmit}
          disabled={!isFormValid() || mediaUploading || submitting || loadingPreview || libraryUploading}
          className="w-full py-3.5 rounded-xl bg-teal text-white font-semibold text-sm transition-colors duration-150 cursor-pointer hover:bg-teal/90 disabled:bg-stone disabled:text-navy/35 disabled:cursor-not-allowed"
        >
          {indexingFace ? t('children.faceSearch.indexing') : submitting ? t('children.register.saving') : mediaUploading ? t('children.register.processingMedia') : t('children.edit.saveChanges')}
        </button>
      </div>
    </div>
  )
}