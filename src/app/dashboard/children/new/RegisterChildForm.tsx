"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { registerChildAction, generateRolfId, checkRolfIdExists } from "./actions"
import { calcAge, SUBJECTS, Field, inputClass } from "../components/form-utils"
import { MediaPicker } from "../components/MediaPicker"
import type { RegisterChildInput } from '@/components/actions'

const STEPS = ["Basic Info", "About Them", "Photo & Video", "Review"]

type FormData = {
  id_rolf: string
  first_name: string
  last_name: string
  birthdate: string
  year_joined: string
  country: string
  career_aspiration: string
  favorite_subject: string
  hobby: string
  bio: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

interface Props {
  availableCountries: string[]
}

export function RegisterChildForm({ availableCountries }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isValidating, setIsValidating] = useState(false)

  // 🌟 Ensure default initialization doesn't cause background context split logic
  const [form, setForm] = useState<FormData>({
    id_rolf: "",
    first_name: "",
    last_name: "",
    birthdate: "",
    year_joined: "",
    country: availableCountries.length === 1 ? availableCountries[0] : "", // Pre-populates if staff only has 1 country, otherwise forces selection
    career_aspiration: "",
    favorite_subject: "",
    hobby: "I like to ",
    bio: ""
  })

  const [generatingId, setGeneratingId] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof FormData, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleGenerateId = async () => {
    if (!form.country) return
    setGeneratingId(true)
    const { id, error: genError } = await generateRolfId(form.country)
    setGeneratingId(false)
    if (genError) {
      setError(genError)
      return
    }
    if (id) set("id_rolf", id)
  }

  const isStep0Valid = () => {
    return !!(
      form.first_name.trim() &&
      form.last_name.trim() &&
      form.birthdate &&
      form.year_joined &&
      form.country &&
      form.id_rolf.trim()
    )
  }

  const isStep1Valid = () => {
    return !!(
      form.career_aspiration.trim() &&
      form.favorite_subject.trim() &&
      form.hobby.trim()
    )
  }

  const isCurrentStepValid = () => {
    if (step === 0) return isStep0Valid()
    if (step === 1) return isStep1Valid()
    return true // Steps 2 and 3 contain only optional tracking variables
  }

  const handleStepProgression = async () => {
    setError(null)
    const targetIdCode = form.id_rolf.trim().toUpperCase()

    // --- STEP 0 VALIDATION GATE ---
    if (step === 0) {
      if (!form.first_name.trim() || !form.last_name.trim() || !form.birthdate || !form.country || !targetIdCode || !form.year_joined) {
        setError("All basic tracking variables marked with * are strictly mandatory before advancing.")
        return
      }

      setIsValidating(true)
      // Hits the server action to lookup uniqueness and fetch the exact ISO prefix for this specific country row
      const { isTaken, expectedPrefix } = await checkRolfIdExists(targetIdCode, form.country)
      setIsValidating(false)

      if (!expectedPrefix) {
        setError(`Database Error: No active country configuration prefix was found for "${form.country}".`)
        return
      }

      if (!targetIdCode.startsWith(`${expectedPrefix}-`)) {
        setError(`Format Discrepancy: The ROLF ID prefix must match the chosen country row parameter format (${expectedPrefix}-XXXX).`)
        return
      }

      if (isTaken) {
        setError(`Identity Collision: The ROLF ID "${targetIdCode}" is already assigned to an active child in the system.`)
        return
      }
    }

    // --- STEP 1 VALIDATION GATE ---
    if (step === 1) {
      setIsValidating(true)
      const { isTaken, expectedPrefix } = await checkRolfIdExists(targetIdCode, form.country)
      setIsValidating(false)

      if (!expectedPrefix || !targetIdCode.startsWith(`${expectedPrefix}-`)) {
        setError("Configuration integrity breakdown: Selected regional prefix parameters have degraded.")
        return
      }

      if (isTaken) {
        setError("Collision conflict: The input ROLF ID code row has been claimed by a parallel request.")
        return
      }

      if (!form.career_aspiration.trim() || !form.favorite_subject.trim() || !form.hobby.trim()) {
        setError("All details fields (Aspirations, Favorite Subject, and Hobbies) are strictly mandatory. Only the Bio can be left blank.")
        return
      }
    }

    // Everything is validated; safe to advance
    setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    const dob = form.birthdate ? new Date(form.birthdate) : null
    const age = calcAge(form.birthdate)

    // 🌟 Construct full payload package mapping all media assets directly to database definitions
    const payload: RegisterChildInput = {
      id_rolf: form.id_rolf.trim() || undefined,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      age: age ?? 0,

      // Strict Table Integer Calendar Splits
      birth_year: dob ? dob.getFullYear() : undefined,
      birth_month: dob ? dob.getMonth() + 1 : undefined,
      birth_day: dob ? dob.getDate() : undefined,

      year_joined: form.year_joined ? new Date(form.year_joined).getFullYear() : undefined,
      date_joined: form.year_joined || undefined,
      country: form.country,
      career_aspiration: form.career_aspiration.trim() || undefined,
      favorite_subject: form.favorite_subject || undefined,
      hobby: form.hobby.trim() || undefined,
      bio: form.bio.trim() || undefined,

      // 🌟 FIXED: Media URLs are now fully passed to backend action inputs
      profile_photo: photoPreview || undefined,
      profile_video: videoPreview || undefined
    }

    const { error: actionError } = await registerChildAction(payload)
    if (actionError) {
      setError(actionError)
      setSubmitting(false)
      return
    }

    router.push("/dashboard/children")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 🌟 UNIFIED STICKY CONTAINER BLOCK */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-xs">
        {/* Navigation Row */}
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
            className="text-gray-500 hover:text-gray-800 text-sm font-medium cursor-pointer"
            disabled={isValidating || submitting}
          >
            ← Back
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="text-base font-bold text-gray-900">{STEPS[step]}</h1>
          </div>
        </div>

        {/* Progress timeline visual track line */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-blue-600 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* 🌟 IMMOVABLE ERROR INTERCEPT SCREEN ALIGNMENT MATRIX */}
        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl leading-relaxed animate-fade-in flex items-start gap-2 shadow-xs">
            <span className="shrink-0">⚠️</span>
            <div>
              <strong className="font-semibold block mb-0.5">Validation Stop</strong>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Main Scrollable Form Body Container Canvas */}
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

            {/* UNIFIED SELECT PARAMETER INJECTOR */}
            <Field label="Jurisdiction Location Country *" htmlFor="country">
              <select
                id="country"
                value={form.country}
                onChange={e => set("country", e.target.value)}
                className={inputClass}
                required
              >
                <option value="" disabled>Select a country</option>
                {availableCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label="ROLF ID *" htmlFor="id_rolf">
              <div className="flex gap-2">
                <input id="id_rolf" value={form.id_rolf}
                  onChange={e => set("id_rolf", e.target.value.toUpperCase())}
                  placeholder="e.g. BEN-0010"
                  className={inputClass + " font-mono tracking-wider flex-1"} />
                <button type="button" onClick={handleGenerateId}
                  disabled={!form.country || generatingId}
                  className="shrink-0 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium border border-gray-200 hover:bg-gray-200 disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer">
                  {generatingId ? "..." : "Generate"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Optional — staff can type one manually or auto-generate the next available code parameter.</p>
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="What do you want to be when you grow up? *" htmlFor="career">
              <input id="career" value={form.career_aspiration} onChange={e => set("career_aspiration", e.target.value)}
                placeholder="e.g. Doctor, Teacher, Engineer..." className={inputClass} autoFocus />
            </Field>

            <Field label="Favorite Subject *" htmlFor="subject">
              {(() => {
                const presets = SUBJECTS.filter(s => s !== "Other")
                const isOther = form.favorite_subject !== "" && !presets.includes(form.favorite_subject)
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {presets.map(s => (
                        <button key={s} type="button" onClick={() => set("favorite_subject", s)}
                          className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left cursor-pointer ${form.favorite_subject === s
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                            }`}>{s}</button>
                      ))}
                      <button type="button" onClick={() => set("favorite_subject", " ")}
                        className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left cursor-pointer ${isOther
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                          }`}>Other</button>
                    </div>
                    {isOther && <input autoFocus value={form.favorite_subject.trim()} onChange={e => set("favorite_subject", e.target.value)} placeholder="Type custom subject details..." className={inputClass + " mt-2"} />}
                  </>
                )
              })()}
            </Field>

            <Field label="Hobbies *" htmlFor="hobby">
              <textarea id="hobby" value={form.hobby} onChange={e => set("hobby", e.target.value)} placeholder="Hobbies description..." rows={3} className={inputClass + " resize-none"} />
            </Field>

            <Field label="Bio (Optional)" htmlFor="bio">
              <textarea id="bio" value={form.bio} onChange={e => set("bio", e.target.value)} placeholder="Provide details..." rows={3} className={inputClass + " resize-none"} />
            </Field>
          </>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <p className="text-xs text-gray-400">Max file size: 15 MB for images, 100 MB for videos.</p>
            <Field label="Profile Photo" htmlFor="photo">
              <MediaPicker
                type="photo"
                value={photoUrl}
                onChange={setPhotoUrl}
                onError={setError}
                onUploadStart={() => setMediaUploading(true)}
                onUploadEnd={() => setMediaUploading(false)}
              />
            </Field>
            <Field label="Short Video (~30 sec)" htmlFor="video">
              <MediaPicker
                type="video"
                value={videoUrl}
                onChange={setVideoUrl}
                onError={setError}
                onUploadStart={() => setMediaUploading(true)}
                onUploadEnd={() => setMediaUploading(false)}
              />
            </Field>
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">{error}</div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50 shadow-2xs">
              <ReviewRow label="Full Name" value={`${form.first_name} ${form.last_name}`} />
              <ReviewRow label="Date of Birth" value={form.birthdate ? formatDate(form.birthdate) : "—"} />
              <ReviewRow label="Calculated Age" value={calcAge(form.birthdate)?.toString() ?? "—"} />
              {form.year_joined && <ReviewRow label="Date Joined Home" value={formatDate(form.year_joined)} />}
              <ReviewRow label="Jurisdiction Region" value={form.country} />
              <ReviewRow label="Career Goal" value={form.career_aspiration} />
              <ReviewRow label="Favorite Subject" value={form.favorite_subject.trim() || "Other"} />
              <ReviewRow label="Hobbies Summary" value={form.hobby} />
              {form.bio.trim() && <ReviewRow label="Bio Text" value={form.bio} />}
              <ReviewRow label="Profile Photo Media" value={photoPreview ? "✓ Asset Bound" : "None"} />
              <ReviewRow label="Video Presentation Asset" value={videoPreview ? "✓ Asset Bound" : "None"} />
            </div>
            {error && <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl leading-relaxed">{error}</div>}
          </div>
        )}
      </div>

      {/* Sticky Bottom Context Footer */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4 mt-auto">
        {step < STEPS.length - 1 ? (
          <button
            onClick={handleStepProgression}
            disabled={!isCurrentStepValid() || isValidating} // 🌟 Blocks the click event entirely
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm transition-colors duration-150 disabled:bg-gray-200 disabled:text-gray-400"
          >
            {isValidating ? "Validating Parameters..." : "Continue"}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-green-600 text-white font-semibold text-sm transition-colors duration-150 disabled:opacity-40"
          >
            {submitting ? "Saving..." : "Register Child"}
          </button>
        )}
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start px-4 py-3 gap-4">
      <span className="text-xs text-gray-400 font-medium shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-semibold text-right">{value || "—"}</span>
    </div>
  )
}