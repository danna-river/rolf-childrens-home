"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { updateChildAction } from "./actions"
import type { UpdateChildInput } from "./actions"
import type { Child } from "@/lib/types"

const SUBJECTS = ["Math", "Language", "Science", "Social Studies", "Gym / PE", "Music", "Art", "History", "Other"]

function calcAge(birthdate: string): number | null {
  if (!birthdate) return null
  const today = new Date()
  const dob = new Date(birthdate)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

function toDateString(year?: number | null, month?: number | null, day?: number | null): string {
  if (!year) return ""
  const m = String(month ?? 1).padStart(2, "0")
  const d = String(day ?? 1).padStart(2, "0")
  return `${year}-${m}-${d}`
}

interface Props {
  child: Child
  assignedCountries: string[]
  isAdmin: boolean
}

export function EditChildForm({ child, assignedCountries, isAdmin }: Props) {
  const router = useRouter()

  const [form, setForm] = useState({
    id_rolf: child.id_rolf ?? "",
    first_name: child.first_name ?? "",
    last_name: child.last_name ?? "",
    birthdate: toDateString(child.birth_year, child.birth_month, child.birth_day),
    year_joined: child.date_joined ?? (child.year_joined ? `${child.year_joined}-01-01` : ""),
    country: child.country ?? assignedCountries[0] ?? "",
    career_aspiration: child.career_aspiration ?? "",
    favorite_subject: child.favorite_subject ?? "",
    hobby: child.hobby ?? "",
    bio: child.bio ?? "",
    notes: child.notes ?? "",
    status: child.status as 'active' | 'inactive',
  })

  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const photoCameraRef = useRef<HTMLInputElement>(null)
  const photoUploadRef = useRef<HTMLInputElement>(null)
  const videoCameraRef = useRef<HTMLInputElement>(null)
  const videoUploadRef = useRef<HTMLInputElement>(null)

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) { setError("Photo must be under 15 MB."); e.target.value = ""; return }
    setError(null)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) { setError("Video must be under 100 MB."); e.target.value = ""; return }
    setError(null)
    setVideoPreview(URL.createObjectURL(file))
  }

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.country) {
      setError("First name, last name, and country are required.")
      return
    }
    setSubmitting(true)
    setError(null)

    const dob = form.birthdate ? new Date(form.birthdate) : null
    const input: UpdateChildInput = {
      id_rolf: form.id_rolf.trim() || null,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      age: calcAge(form.birthdate) ?? 0,
      birth_year: dob?.getFullYear(),
      birth_month: dob ? dob.getMonth() + 1 : undefined,
      birth_day: dob?.getDate(),
      year_joined: form.year_joined ? new Date(form.year_joined).getFullYear() : undefined,
      date_joined: form.year_joined || undefined,
      country: form.country,
      career_aspiration: form.career_aspiration.trim() || undefined,
      favorite_subject: form.favorite_subject || undefined,
      hobby: form.hobby.trim() || undefined,
      bio: form.bio.trim() || undefined,
      notes: form.notes.trim() || undefined,
      status: form.status,
    }

    const { error } = await updateChildAction(child.id, input)
    if (error) { setError(error); setSubmitting(false); return }
    router.push("/dashboard/children")
  }

  const presets = SUBJECTS.filter(s => s !== "Other")
  const isOther = form.favorite_subject !== "" && !presets.includes(form.favorite_subject)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 text-sm font-medium">
          ← Back
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Editing</p>
          <h1 className="text-base font-bold text-gray-900">
            {child.first_name} {child.last_name}
          </h1>
        </div>
      </div>

      {/* Form body */}
      <div className="flex-1 px-4 py-6 space-y-5 max-w-lg mx-auto w-full pb-28">

        {/* Basic Info */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Basic Info</h2>

          <Field label="ROLF ID" htmlFor="id_rolf">
            <input id="id_rolf" value={form.id_rolf} onChange={e => set("id_rolf", e.target.value)}
              placeholder="e.g. UG-0001" className={inputClass} />
          </Field>

          <Field label="First Name *" htmlFor="first_name">
            <input id="first_name" value={form.first_name} onChange={e => set("first_name", e.target.value)}
              placeholder="e.g. Grace" className={inputClass} />
          </Field>

          <Field label="Last Name *" htmlFor="last_name">
            <input id="last_name" value={form.last_name} onChange={e => set("last_name", e.target.value)}
              placeholder="e.g. Nakato" className={inputClass} />
          </Field>

          <Field label="Date of Birth" htmlFor="birthdate">
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

          <Field label="Date Joined Home" htmlFor="year_joined">
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

          {(isAdmin || assignedCountries.length > 1) && (
            <Field label="Country *" htmlFor="country">
              <select id="country" value={form.country} onChange={e => set("country", e.target.value)}
                className={inputClass}>
                <option value="">Select a country</option>
                {assignedCountries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          )}

        </section>

        {/* About Them */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">About Them</h2>

          <Field label="What do you want to be when you grow up?" htmlFor="career">
            <input id="career" value={form.career_aspiration}
              onChange={e => set("career_aspiration", e.target.value)}
              placeholder="e.g. Doctor, Teacher, Engineer..." className={inputClass} />
          </Field>

          <Field label="Favorite Subject" htmlFor="subject">
            <div className="grid grid-cols-2 gap-2">
              {presets.map(s => (
                <button key={s} type="button" onClick={() => set("favorite_subject", s)}
                  className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                    form.favorite_subject === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                  }`}>
                  {s}
                </button>
              ))}
              <button type="button" onClick={() => set("favorite_subject", " ")}
                className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                  isOther
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                }`}>
                Other
              </button>
            </div>
            {isOther && (
              <input autoFocus
                value={form.favorite_subject.trim()}
                onChange={e => set("favorite_subject", e.target.value)}
                placeholder="Type their favorite subject..."
                className={inputClass + " mt-2"}
              />
            )}
          </Field>

          <Field label="Hobbies" htmlFor="hobby">
            <textarea id="hobby" value={form.hobby} onChange={e => set("hobby", e.target.value)}
              placeholder="e.g. Drawing, playing football, reading..." rows={3}
              className={inputClass + " resize-none"} />
          </Field>

          <Field label="Bio" htmlFor="bio">
            <textarea id="bio" value={form.bio} onChange={e => set("bio", e.target.value)}
              placeholder="A short description about this child..." rows={4}
              className={inputClass + " resize-none"} />
          </Field>
        </section>

        {/* Photo & Video */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Photo &amp; Video</h2>
          <p className="text-xs text-gray-400">Max 15 MB for photos, 100 MB for videos.</p>

          <Field label="Profile Photo" htmlFor="photo">
            <input ref={photoCameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
            <input ref={photoUploadRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            {photoPreview ? (
              <div className="flex flex-col items-center gap-2">
                <img src={photoPreview} alt="preview" className="h-36 w-36 rounded-full object-cover border-4 border-blue-100" />
                <button type="button"
                  onClick={() => { setPhotoPreview(null); if (photoCameraRef.current) photoCameraRef.current.value = ""; if (photoUploadRef.current) photoUploadRef.current.value = "" }}
                  className="text-xs text-red-500">Remove photo</button>
              </div>
            ) : (
              <div className="space-y-2">
                {child.profile_photo && (
                  <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                    Existing photo on file — select below to replace it.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => photoCameraRef.current?.click()}
                    className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-300 transition-colors">
                    <span className="text-2xl">📷</span>
                    <span className="text-xs font-medium text-gray-600">{child.profile_photo ? "Retake Photo" : "Take Photo"}</span>
                  </button>
                  <button type="button" onClick={() => photoUploadRef.current?.click()}
                    className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-300 transition-colors">
                    <span className="text-2xl">🖼️</span>
                    <span className="text-xs font-medium text-gray-600">{child.profile_photo ? "Replace File" : "Upload File"}</span>
                  </button>
                </div>
              </div>
            )}
          </Field>

          <Field label="Short Video (~30 sec)" htmlFor="video">
            <input ref={videoCameraRef} type="file" accept="video/*" capture="environment" onChange={handleVideo} className="hidden" />
            <input ref={videoUploadRef} type="file" accept="video/*" onChange={handleVideo} className="hidden" />
            {videoPreview ? (
              <div className="flex flex-col gap-2">
                <video src={videoPreview} controls className="w-full rounded-xl max-h-48" />
                <button type="button"
                  onClick={() => { setVideoPreview(null); if (videoCameraRef.current) videoCameraRef.current.value = ""; if (videoUploadRef.current) videoUploadRef.current.value = "" }}
                  className="text-xs text-red-500">Remove video</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => videoCameraRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-300 transition-colors">
                  <span className="text-2xl">🎥</span>
                  <span className="text-xs font-medium text-gray-600">Record Video</span>
                </button>
                <button type="button" onClick={() => videoUploadRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-300 transition-colors">
                  <span className="text-2xl">📁</span>
                  <span className="text-xs font-medium text-gray-600">Upload File</span>
                </button>
              </div>
            )}
          </Field>
        </section>

        {/* Status */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Status</h2>
          <Field label="Child Status" htmlFor="status">
            <div className="flex gap-3">
              {(['active', 'inactive'] as const).map(s => (
                <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors capitalize ${
                    form.status === s
                      ? s === 'active' ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
            {form.status === 'inactive' && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                Please write in the Notes section below why this child left the home.
              </p>
            )}
          </Field>
        </section>

        {/* Notes */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</h2>
          <Field label="Internal Notes" htmlFor="notes">
            <textarea id="notes" value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Staff-only notes (e.g. reason child left the home, special circumstances...)"
              rows={5}
              className={inputClass + " resize-none"} />
          </Field>
        </section>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 max-w-lg mx-auto">
        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-40 transition-opacity">
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  )
}

const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}
