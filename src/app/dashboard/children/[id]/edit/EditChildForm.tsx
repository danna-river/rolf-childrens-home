"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { updateChildAction, checkRolfIdForEdit, getLatestIdPreviewForEdit } from "./actions"
import type { UpdateChildInput } from "./actions"
import type { Child } from "@/lib/types"
import { calcAge, toDateString, SUBJECTS, Field, inputClass } from "../../components/form-utils"
import { MediaPicker } from "../../components/MediaPicker"

interface Props {
  child: Child
  availableCountries: string[]
  isAdmin: boolean // 🌟 Clearance boolean passed down from the page layout server client
}

export function EditChildForm({ child, availableCountries, isAdmin }: Props) {
  const router = useRouter()
  const [mediaUploading, setMediaUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // 🌟 Side effect listening to country changes to auto-generate identifiers for administrators
  useEffect(() => {
    // If country rolls back to the child's true original placement, restore initial ROLF ID
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
      // 🌟 ASYNCHRONOUS SECURITY BLOCK: Run live uniqueness & code format verification on submission
      const { isValid, error: validationError } = await checkRolfIdForEdit(targetIdCode, form.country, child.id)

      if (!isValid) {
        setError(validationError)
        setSubmitting(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return // Safely exits the pipeline; blocks the write update script entirely
      }

      const dob = form.birthdate ? new Date(form.birthdate) : null

      const input: UpdateChildInput = {
        id_rolf: targetIdCode,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        birth_year: dob?.getFullYear(),
        birth_month: dob ? dob.getMonth() + 1 : undefined,
        birth_day: dob?.getDate(),
        year_joined: form.year_joined ? new Date(form.year_joined).getFullYear() : undefined,
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

      const { error: actionError } = await updateChildAction(child.id, input)
      if (actionError) {
        setError(actionError)
        setSubmitting(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      // Revalidation happened on the server, just push the clean transition
      router.push("/dashboard/children")
    } catch (err) {
      setError("An unexpected network fault occurred while attempting to write updates to the child record.")
      setSubmitting(false)
    }
  }

  const presets = SUBJECTS.filter(s => s !== "Other")
  const isOther = form.favorite_subject !== "" && !presets.includes(form.favorite_subject)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* STICKY NAVIGATION HEADER */}
      <div className="sticky top-16 z-40 bg-white border-b border-gray-100 shadow-xs">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-800 text-sm font-medium cursor-pointer"
            disabled={submitting}
          >
            ← Cancel
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Modifying Profile Records</p>
            <h1 className="text-base font-bold text-gray-900">
              {child.first_name} {child.last_name}
            </h1>
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl leading-relaxed animate-fade-in flex items-start gap-2 shadow-xs">
            <span className="shrink-0">⚠️</span>
            <div>
              <strong className="font-semibold block mb-0.5">Validation Stop</strong>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Main Container Workspace Viewport */}
      <div className="flex-1 px-4 py-6 space-y-5 max-w-lg mx-auto w-full pb-32">

        {/* Basic Info */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">Basic Info</h2>

          <Field label="Country *" htmlFor="country">
            <select
              id="country"
              value={form.country}
              onChange={e => set("country", e.target.value)}
              className={inputClass}
              required
            >
              <option value="" disabled>Select active registration region...</option>
              {availableCountries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>

          {/* 🌟 REPLICATED AUTO-INCREMENT PREVIEW AND LOCKED FIELD SCHEME */}
          <Field label={isAdmin ? "ROLF ID *" : "ROLF ID"} htmlFor="id_rolf">
            {loadingPreview ? (
              <div className="py-3 px-4 bg-gray-50 text-xs text-gray-400 font-medium italic border border-gray-100 rounded-xl">
                Syncing next chronological identifier sequence for country choice...
              </div>
            ) : isAdmin ? (
              <input
                id="id_rolf"
                value={form.id_rolf}
                onChange={e => set("id_rolf", e.target.value.toUpperCase())}
                className={inputClass + " font-mono tracking-wider bg-white border-blue-200 focus:border-blue-600 font-semibold text-gray-800"}
              />
            ) : (
              <input
                id="id_rolf_locked"
                value={form.id_rolf}
                disabled
                className={inputClass + " bg-gray-100 border-gray-200 text-gray-500 font-mono tracking-wider select-none cursor-not-allowed font-semibold"}
              />
            )}

            {/* Inline warning notification banner if an administrator shifts the pre-calculated sequence string */}
            {isAdmin && form.id_rolf && form.id_rolf !== initialGeneratedId && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 text-[11px] text-amber-700 rounded-xl leading-normal animate-fade-in">
                <strong>Notice:</strong> You are overriding the auto-increment structure. Saving will verify formatting and look for duplicate key entries.
              </div>
            )}

            <p className="text-xs text-gray-400 mt-1.5">
              {isAdmin
                ? "Field auto-fills on region change. Administrators can modify values; progression is blocked if an ID collision is discovered."
                : "Staff accounts cannot alter unique registry codes. To shift this identifier, contact an administrator."}
            </p>
          </Field>

          <Field label="First Name *" htmlFor="first_name">
            <input id="first_name" value={form.first_name} onChange={e => set("first_name", e.target.value)}
              placeholder="e.g. Grace" className={inputClass} />
          </Field>

          <Field label="Last Name *" htmlFor="last_name">
            <input id="last_name" value={form.last_name} onChange={e => set("last_name", e.target.value)}
              placeholder="e.g. Nakato" className={inputClass} />
          </Field>

          <Field label="Date of Birth *" htmlFor="birthdate">
            <input id="birthdate" type="date" value={form.birthdate}
              onChange={e => set("birthdate", e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              min="2000-01-01"
              className={inputClass} />
            {form.birthdate && (
              <div className="mt-2 inline-flex items-baseline gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
                <span className="text-sm font-semibold text-blue-600">{calcAge(form.birthdate)}</span>
                <span className="text-sm text-blue-400">years old</span>
              </div>
            )}
          </Field>

          <Field label="Date Joined Home *" htmlFor="year_joined">
            <input id="year_joined" type="date" value={form.year_joined}
              onChange={e => set("year_joined", e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              min="2000-01-01"
              className={inputClass} />
            {form.year_joined && (
              <div className="mt-2 inline-flex items-baseline gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
                <span className="text-sm font-semibold text-blue-600">{calcAge(form.year_joined)}</span>
                <span className="text-sm text-blue-400">years in home</span>
              </div>
            )}
          </Field>
        </section>

        {/* About Them */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">About Them</h2>

          <Field label="What do you want to be when you grow up? *" htmlFor="career">
            <input id="career" value={form.career_aspiration}
              onChange={e => set("career_aspiration", e.target.value)}
              placeholder="e.g. Doctor, Teacher, Engineer..." className={inputClass} />
          </Field>

          <Field label="Favorite Subject *" htmlFor="subject">
            <div className="grid grid-cols-2 gap-2">
              {presets.map(s => (
                <button key={s} type="button" onClick={() => set("favorite_subject", s)}
                  className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left cursor-pointer ${form.favorite_subject === s
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                    }`}>{s}</button>
              ))}
              <button type="button" onClick={() => set("favorite_subject", " ")}
                className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left cursor-pointer ${isOther ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                  }`}>Other</button>
            </div>
            {isOther && (
              <input autoFocus value={form.favorite_subject.trim()} onChange={e => set("favorite_subject", e.target.value)}
                placeholder="Type custom subject details..." className={inputClass + " mt-2"} />
            )}
          </Field>

          <Field label="Hobbies *" htmlFor="hobby">
            <textarea id="hobby" value={form.hobby} onChange={e => set("hobby", e.target.value)}
              placeholder="Hobbies description..." rows={3} className={inputClass + " resize-none"} />
          </Field>

          <Field label="Bio (Optional)" htmlFor="bio">
            <textarea id="bio" value={form.bio} onChange={e => set("bio", e.target.value)}
              placeholder="A short description about this child..." rows={4} className={inputClass + " resize-none"} />
          </Field>
        </section>

        {/* Photo & Video */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">Photo &amp; Video</h2>
          <p className="text-xs text-gray-400">Max file limits: 15 MB for images, 100 MB for videos.</p>
          <Field label="Profile Photo" htmlFor="photo">
            <MediaPicker
              type="photo"
              value={photoUrl}
              onChange={photoUrl => setPhotoUrl(photoUrl)}
              existingUrl={child.profile_photo}
              onError={setError}
              onUploadStart={() => setMediaUploading(true)}
              onUploadEnd={() => setMediaUploading(false)}
            />
          </Field>
          <Field label="Short Video (~30 sec)" htmlFor="video">
            <MediaPicker
              type="video"
              value={videoUrl}
              onChange={videoUrl => setVideoUrl(videoUrl)}
              existingUrl={child.profile_video}
              onError={setError}
              onUploadStart={() => setMediaUploading(true)}
              onUploadEnd={() => setMediaUploading(false)}
            />
          </Field>
        </section>

        {/* Status */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">Status</h2>
          <Field label="Child Status" htmlFor="status">
            <div className="flex gap-3">
              {(['active', 'inactive'] as const).map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors capitalize cursor-pointer ${form.status === s
                    ? s === 'active' ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                    }`}>
                  {s}
                </button>
              ))}
            </div>
            {form.status === 'inactive' && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2 leading-relaxed">
                Please document explicitly in the Notes window below why this individual profile is moving to an inactive status.
              </p>
            )}
          </Field>
        </section>

        {/* Notes */}
        <section className="bg-white p-5 rounded-xl border border-gray-100 space-y-4 shadow-2xs">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-50 pb-2">Internal Notes (Optional)</h2>
          <Field label="Internal Notes" htmlFor="notes">
            <textarea id="notes" value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Staff-only internal ledger notes (special circumstances, family tracing variables...)"
              rows={4} className={inputClass + " resize-none"} />
          </Field>
        </section>
      </div>

      {/* Spaced & Styled Action Control Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 max-w-lg mx-auto z-40">
        <button
          onClick={handleSubmit}
          disabled={!isFormValid() || mediaUploading || submitting || loadingPreview}
          className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm transition-colors duration-150 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : mediaUploading ? "Processing Media..." : "Save Changes"}
        </button>
      </div>
    </div>
  )
}