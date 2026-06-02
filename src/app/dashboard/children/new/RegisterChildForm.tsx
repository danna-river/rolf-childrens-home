"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { registerChildAction } from "./actions"
import type { RegisterChildInput } from "@/components/actions"

const SUBJECTS = ["Math", "Language", "Science", "Social Studies", "Gym / PE", "Music", "Art", "History", "Other"]
const STEPS = ["Basic Info", "About Them", "Photo & Video", "Review"]

type FormData = {
  first_name: string
  last_name: string
  birthdate: string        // YYYY-MM-DD
  year_joined: string   // YYYY-MM-DD
  country: string
  career_aspiration: string
  favorite_subject: string
  hobby: string
}

function calcAge(birthdate: string): number | null {
  if (!birthdate) return null
  const today = new Date()
  const dob = new Date(birthdate)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

interface Props {
  assignedCountries: string[]
  isAdmin: boolean
}

export function RegisterChildForm({ assignedCountries, isAdmin }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>({
    first_name: "", last_name: "", birthdate: "",
    year_joined: "", country: assignedCountries[0] ?? "",
    career_aspiration: "", favorite_subject: "", hobby: "",
  })
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      setError("Photo must be under 15 MB.")
      e.target.value = ""
      return
    }
    setError(null)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 100 * 1024 * 1024) {
      setError("Video must be under 100 MB.")
      e.target.value = ""
      return
    }
    setError(null)
    setVideoPreview(URL.createObjectURL(file))
  }

  const set = (field: keyof FormData, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const canNext = () => {
    if (step === 0) return form.first_name.trim() && form.last_name.trim() && form.birthdate && form.country
    if (step === 1) return form.career_aspiration.trim() && form.favorite_subject && form.hobby.trim()
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    const age = calcAge(form.birthdate)
    const input: RegisterChildInput = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      age: age ?? 0,
      birth_year: form.birthdate ? new Date(form.birthdate).getFullYear() : undefined,
      year_joined: form.year_joined ? new Date(form.year_joined).getFullYear() : undefined,
      country: form.country,
      career_aspiration: form.career_aspiration.trim() || undefined,
      favorite_subject: form.favorite_subject || undefined,
      hobby: form.hobby.trim() || undefined,
    }
    const { error } = await registerChildAction(input)
    if (error) { setError(error); setSubmitting(false); return }
    router.push("/dashboard/children")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
          className="text-gray-500 hover:text-gray-800 text-sm font-medium">
          ← Back
        </button>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="text-base font-bold text-gray-900">{STEPS[step]}</h1>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div className="h-1 bg-blue-600 transition-all duration-300"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* Form body */}
      <div className="flex-1 px-4 py-6 space-y-5 max-w-lg mx-auto w-full">

        {step === 0 && (
          <>
            <Field label="First Name *" htmlFor="first_name">
              <input id="first_name" value={form.first_name} onChange={e => set("first_name", e.target.value)}
                placeholder="e.g. Grace" className={inputClass} autoFocus />
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
          </>
        )}

        {step === 1 && (
          <>
            <Field label="What do you want to be when you grow up? *" htmlFor="career">
              <input id="career" value={form.career_aspiration}
                onChange={e => set("career_aspiration", e.target.value)}
                placeholder="e.g. Doctor, Teacher, Engineer..." className={inputClass} autoFocus />
            </Field>
            <Field label="Favorite Subject *" htmlFor="subject">
              {(() => {
                const presets = SUBJECTS.filter(s => s !== "Other")
                const isOther = !presets.includes(form.favorite_subject)
                return (
                  <>
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
                  </>
                )
              })()}
            </Field>
            <Field label="Hobbies *" htmlFor="hobby">
              <textarea id="hobby" value={form.hobby} onChange={e => set("hobby", e.target.value)}
                placeholder="e.g. Drawing, playing football, reading..." rows={3}
                className={inputClass + " resize-none"} />
            </Field>
          </>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <p className="text-xs text-gray-400">Max file size: 15 MB for photos, 100 MB for videos.</p>

            {/* Photo */}
            <Field label="Profile Photo" htmlFor="photo">
              <input ref={photoRef} id="photo" type="file" accept="image/*" capture="environment"
                onChange={handlePhoto} className="hidden" />
              <button type="button" onClick={() => photoRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 hover:border-blue-300 transition-colors bg-white">
                {photoPreview
                  ? <img src={photoPreview} alt="preview" className="h-32 w-32 rounded-full object-cover" />
                  : <>
                      <span className="text-3xl">📷</span>
                      <span className="text-sm text-gray-500">Take or choose a photo</span>
                    </>
                }
              </button>
              {photoPreview && (
                <button type="button" onClick={() => { setPhotoPreview(null); if (photoRef.current) photoRef.current.value = "" }}
                  className="text-xs text-red-500 mt-1">Remove photo</button>
              )}
            </Field>

            {/* Video */}
            <Field label="Short Video (~30 sec)" htmlFor="video">
              <input ref={videoRef} id="video" type="file" accept="video/*" capture="environment"
                onChange={handleVideo} className="hidden" />
              <button type="button" onClick={() => videoRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 hover:border-blue-300 transition-colors bg-white">
                {videoPreview
                  ? <video src={videoPreview} controls className="w-full rounded-xl max-h-48" />
                  : <>
                      <span className="text-3xl">🎥</span>
                      <span className="text-sm text-gray-500">Record or choose a video</span>
                      <span className="text-xs text-gray-400 text-center px-4">Child states their name, then does an activity</span>
                    </>
                }
              </button>
              {videoPreview && (
                <button type="button" onClick={() => { setVideoPreview(null); if (videoRef.current) videoRef.current.value = "" }}
                  className="text-xs text-red-500 mt-1">Remove video</button>
              )}
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              <ReviewRow label="Name" value={`${form.first_name} ${form.last_name}`} />
              <ReviewRow label="Date of Birth" value={form.birthdate} />
              <ReviewRow label="Age" value={calcAge(form.birthdate)?.toString() ?? "—"} />
              {form.year_joined && <ReviewRow label="Date Joined" value={form.year_joined} />}
              <ReviewRow label="Country" value={form.country} />
              <ReviewRow label="Career Goal" value={form.career_aspiration} />
              <ReviewRow label="Favorite Subject" value={form.favorite_subject} />
              <ReviewRow label="Hobbies" value={form.hobby} />
              <ReviewRow label="Photo" value={photoPreview ? "✓ Selected" : "None"} />
              <ReviewRow label="Video" value={videoPreview ? "✓ Selected" : "None"} />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4">
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-40 transition-opacity">
            Continue
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-green-600 text-white font-semibold text-sm disabled:opacity-40 transition-opacity">
            {submitting ? "Saving..." : "Register Child"}
          </button>
        )}
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start px-4 py-3 gap-4">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-sm text-gray-800 text-right">{value || "—"}</span>
    </div>
  )
}
