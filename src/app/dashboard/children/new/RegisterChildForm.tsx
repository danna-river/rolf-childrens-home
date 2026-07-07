"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { registerChildAction, getLatestIdPreview, checkRolfIdForRegistration } from "./actions"
import { calcAge, SUBJECTS, Field } from "../components/form-utils"
import { MediaPicker } from "../components/MediaPicker"
import { useLocale, useTranslations } from "@/i18n/client"
import type { MessageKey } from "@/i18n/locales/en"

const STEP_KEYS = [
  "children.register.steps.basic",
  "children.register.steps.about",
  "children.register.steps.media",
  "children.register.steps.review",
] as const

// Brand-styled input (register flow only) — matches the dashboard palette.
const inputClass = "w-full px-4 py-3 rounded-xl border border-stone text-sm text-navy bg-white placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"

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
  notes: string
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface Props {
  assignedCountries: string[]
  isAdmin: boolean
}

export function RegisterChildForm({ assignedCountries, isAdmin }: Props) {
  const router = useRouter()
  const t = useTranslations()
  const locale = useLocale()
  const [step, setStep] = useState(0)

  const [form, setForm] = useState<FormData>({
    id_rolf: "",
    first_name: "",
    last_name: "",
    birthdate: "",
    year_joined: "",
    country: assignedCountries.length === 1 ? assignedCountries[0] : "",
    career_aspiration: "",
    favorite_subject: "",
    hobby: "I like to ",
    bio: "",
    notes: ""
  })

  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [mediaUploading, setMediaUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [generatingBio, setGeneratingBio] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bioGenerated, setBioGenerated] = useState(false)

  const [loadingPreview, setLoadingPreview] = useState(false)
  const [validatingStepZero, setValidatingStepZero] = useState(false)
  const [initialGeneratedId, setInitialGeneratedId] = useState<string>("")

  const set = (field: keyof FormData, value: string) => {
    setError(null)
    setForm(f => ({ ...f, [field]: value }))
  }

  // Real-time sequence preview generator listener hook
  useEffect(() => {
    async function runPreviewSync() {
      if (!form.country) {
        setForm(f => ({ ...f, id_rolf: "" }))
        setInitialGeneratedId("")
        return
      }

      setLoadingPreview(true)
      const { previewId } = await getLatestIdPreview(form.country)
      setLoadingPreview(false)

      if (previewId) {
        setInitialGeneratedId(previewId)
        setForm(f => ({ ...f, id_rolf: previewId }))
      }
    }
    runPreviewSync()
  }, [form.country])

  const isStep0Valid = () => {
    return !!(form.id_rolf.trim() && form.first_name.trim() && form.last_name.trim() && form.birthdate && form.year_joined && form.country)
  }

  const isStep1Valid = () => {
    return !!(form.career_aspiration.trim() && form.favorite_subject.trim() && form.hobby.trim())
  }

  const isCurrentStepValid = () => {
    if (step === 0) return isStep0Valid()
    if (step === 1) return isStep1Valid()
    return true
  }

  const canGenerateBio = () => isStep0Valid() && isStep1Valid()

  // 🌟 ASYNCHRONOUS STEP GATE: Handles live background lookups on Step 0 to block continuation if input errors exist
  const handleStepProgression = async () => {
    setError(null)

    if (step === 0) {
      setValidatingStepZero(true)
      const { isValid, error: validationError } = await checkRolfIdForRegistration(form.id_rolf, form.country)
      setValidatingStepZero(false)

      if (!isValid) {
        setError(validationError)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return // Exits function immediately; blocks moving to Step 1
      }
    }

    setStep(s => s + 1)
  }

  const handleSubmit = async () => {
    setError(null)
    setSubmitting(true)

    const dob = form.birthdate ? new Date(form.birthdate) : null
    const age = calcAge(form.birthdate)

    const input = {
      id_rolf: form.id_rolf.trim().toUpperCase(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      age: age ?? 0,
      birth_year: dob ? dob.getFullYear() : undefined,
      birth_month: dob ? dob.getMonth() + 1 : undefined,
      birth_day: dob ? dob.getDate() : undefined,
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
    }

    const { error: actionError } = await registerChildAction(input)
    if (actionError) {
      setError(actionError)
      setSubmitting(false) // 🌟 Essential: Unlock button state on failure!

      // If the code sequence failed at the final table write, kick them back to step 0
      // but force a state reset so the code immediately fetches the fresh, correct index preview string.
      setForm(f => ({ ...f, id_rolf: "" }))
      setStep(0)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    router.push("/dashboard/children")
  }

  const generateBio = async () => {
    setError(null)
    setGeneratingBio(true)
    try {
      const res = await fetch('/api/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          hobby: form.hobby,
          career_aspiration: form.career_aspiration,
          favorite_subject: form.favorite_subject,
          country: form.country,
          birthdate: form.birthdate,
          date_joined: form.year_joined,
        })
      })

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: null }))
        throw new Error(error || t('children.register.error.bioGeneration'))
      }

      const data = await res.json()
      if (data?.bio) {
        set('bio', data.bio)
        setBioGenerated(true)
      } else {
        throw new Error(t('children.register.error.noBio'))
      }
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : typeof err === 'string' ? err : t('children.register.error.failedBio'))
    } finally {
      setGeneratingBio(false)
    }
  }

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

  return (
    <div className="google-sans-registry min-h-screen bg-ice flex flex-col">
      {/* STICKY HEADER MATRIX BAR */}
      <div className="sticky top-16 z-40 bg-white border-b border-stone shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => step > 0 ? setStep(s => s - 1) : router.back()}
            disabled={submitting || validatingStepZero}
            className="text-navy/60 hover:text-navy text-sm font-medium cursor-pointer"
          >
            ← {t('children.register.back')}
          </button>
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-navy/45">
              {t('children.register.step')
                .replace('{current}', String(step + 1))
                .replace('{total}', String(STEP_KEYS.length))}
            </p>
            <h1 className="text-base font-bold text-navy">{t(STEP_KEYS[step])}</h1>
          </div>
        </div>

        <div className="h-1 bg-stone">
          <div className="h-1 bg-teal transition-all duration-300" style={{ width: `${((step + 1) / STEP_KEYS.length) * 100}%` }} />
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl leading-relaxed animate-fade-in flex items-start gap-2 shadow-xs">
            <span className="shrink-0">⚠️</span>
            <div>
              <strong className="font-semibold block mb-0.5">{t('children.register.validationStop')}</strong>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Main Container Workspace Viewport */}
      <div className="flex-1 px-4 py-6 space-y-5 max-w-lg mx-auto w-full pb-32">

        {step === 0 && (
          <>
            <Field label={t('children.register.firstName')} htmlFor="first_name">
              <input id="first_name" value={form.first_name} onChange={e => set("first_name", e.target.value)} placeholder="e.g. Grace" className={inputClass} autoFocus />
            </Field>
            <Field label={t('children.register.lastName')} htmlFor="last_name">
              <input id="last_name" value={form.last_name} onChange={e => set("last_name", e.target.value)} placeholder="e.g. Nakato" className={inputClass} />
            </Field>
            <Field label={t('children.register.dateOfBirth')} htmlFor="birthdate">
              <input id="birthdate" type="date" value={form.birthdate} onChange={e => set("birthdate", e.target.value)} max={new Date().toISOString().split("T")[0]} min="2000-01-01" className={inputClass} />
              {form.birthdate && (
                <div className="mt-2 inline-flex items-baseline gap-1.5 bg-sky/50 border border-sky rounded-xl px-4 py-2">
                  <span className="text-sm font-semibold text-navy">{calcAge(form.birthdate)}</span>
                  <span className="text-sm text-navy/50">{t('children.register.yearsOld')}</span>
                </div>
              )}
            </Field>
            <Field label={t('children.register.dateJoinedHome')} htmlFor="year_joined">
              <input id="year_joined" type="date" value={form.year_joined} onChange={e => set("year_joined", e.target.value)} max={new Date().toISOString().split("T")[0]} min="2000-01-01" className={inputClass} />
            </Field>

            <Field label={t('children.register.country')} htmlFor="country">
              <select id="country" value={form.country} onChange={e => set("country", e.target.value)} className={inputClass} required>
                <option value="" disabled>{t('children.register.selectCountry')}</option>
                {assignedCountries.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field label={isAdmin ? t('children.register.rolfIdRequired') : t('children.register.rolfId')} htmlFor="id_rolf">
              {loadingPreview ? (
                <div className="py-3 px-4 bg-ice text-xs text-navy/40 font-medium italic border border-stone rounded-xl">
                  {t('children.register.syncingId')}
                </div>
              ) : isAdmin ? (
                <input
                  id="id_rolf"
                  value={form.id_rolf}
                  disabled={!form.country}
                  onChange={e => set("id_rolf", e.target.value.toUpperCase())}
                  placeholder={form.country ? "e.g. BEN-0010" : t('children.register.selectCountryFirst')}
                  className={inputClass + " font-mono tracking-wider bg-white border-teal/40 focus:border-teal disabled:bg-ice disabled:text-navy/40 disabled:cursor-not-allowed font-semibold text-navy"}
                />
              ) : (
                <input
                  id="id_rolf_locked"
                  value={form.country ? form.id_rolf : t('children.register.selectCountryFirst')}
                  disabled
                  className={inputClass + " bg-ice border-stone text-navy/70 font-mono tracking-wider select-none cursor-not-allowed font-semibold"}
                />
              )}

              {/* 🌟 Dynamic Inline Notification Banner — Only triggers for Admins when value shifts from default setup pattern */}
              {isAdmin && form.id_rolf && form.id_rolf !== initialGeneratedId && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 text-[11px] text-amber-700 rounded-xl leading-normal">
                  <strong>{t('children.register.idNoticeLabel')}</strong> {t('children.register.idNotice')}
                </div>
              )}

              <p className="text-xs text-navy/45 mt-1.5">
                {isAdmin
                  ? t('children.register.idHelpAdmin')
                  : t('children.register.idHelpStaff')}
              </p>
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label={t('children.register.careerQuestion')} htmlFor="career">
              <input id="career" value={form.career_aspiration} onChange={e => set("career_aspiration", e.target.value)} placeholder={t('children.register.careerPlaceholder')} className={inputClass} autoFocus />
            </Field>
            <Field label={t('children.register.favoriteSubject')} htmlFor="subject">
              {(() => {
                const presets = SUBJECTS.filter(s => s !== "Other")
                const isOther = form.favorite_subject !== "" && !presets.includes(form.favorite_subject)
                return (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {presets.map(s => (
                        <button key={s} type="button" onClick={() => set("favorite_subject", s)} className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left cursor-pointer ${form.favorite_subject === s ? "bg-navy text-white border-navy" : "bg-white text-navy/70 border-stone hover:border-teal"}`}>{subjectLabel(s)}</button>
                      ))}
                      <button type="button" onClick={() => set("favorite_subject", " ")} className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left cursor-pointer ${isOther ? "bg-navy text-white border-navy" : "bg-white text-navy/70 border-stone hover:border-teal"}`}>{t('children.subject.other')}</button>
                    </div>
                    {isOther && <input autoFocus value={form.favorite_subject.trim()} onChange={e => set("favorite_subject", e.target.value)} placeholder={t('children.register.customSubjectPlaceholder')} className={inputClass + " mt-2"} />}
                  </>
                )
              })()}
            </Field>
            <Field label={t('children.register.hobbies')} htmlFor="hobby">
              <textarea id="hobby" value={form.hobby} onChange={e => set("hobby", e.target.value)} placeholder={t('children.register.hobbiesPlaceholder')} rows={3} className={inputClass + " resize-none"} />
            </Field>
            <Field label={t('children.register.internalNotes')} htmlFor="notes">
              <textarea id="notes" value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder={t('children.register.notesPlaceholder')}
                rows={3} className={inputClass + " resize-none"} />
            </Field>

            <Field label={t('children.register.shortBio')} htmlFor={bioGenerated ? "bio" : "generate-bio"}>
              {!bioGenerated ? (
                <div className="rounded-xl border border-sky bg-sky/40 p-4">
                  <p className="text-xs font-medium leading-relaxed text-navy/80">
                    {t('children.register.bioOneTry')}
                  </p>
                  <button
                    id="generate-bio"
                    type="button"
                    onClick={generateBio}
                    disabled={generatingBio || !canGenerateBio()}
                    className="mt-3 w-full rounded-xl bg-navy px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy/90 disabled:bg-stone disabled:text-navy/35 disabled:cursor-not-allowed"
                  >
                    {generatingBio ? t('children.register.generating') : t('children.register.generateBio')}
                  </button>
                </div>
              ) : (
                <>
                  <textarea
                    id="bio"
                    value={form.bio}
                    onChange={e => set("bio", e.target.value)}
                    placeholder={t('children.register.bioPlaceholder')}
                    rows={5}
                    className={inputClass + " resize-none"}
                  />
                  <p className="mt-2 text-xs font-medium leading-relaxed text-amber-700">
                    {t('children.register.bioReviewNote')}
                  </p>
                </>
              )}
            </Field>
          </>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <p className="text-xs text-navy/45">{t('children.register.mediaLimit')}</p>
            <Field label={t('children.register.profilePhoto')} htmlFor="photo">
              <MediaPicker type="photo" value={photoUrl} onChange={setPhotoUrl} onError={setError} onUploadStart={() => setMediaUploading(true)} onUploadEnd={() => setMediaUploading(false)} allowDriveLink={false} childMeta={{ idRolf: form.id_rolf, firstName: form.first_name, lastName: form.last_name, country: form.country }} />
            </Field>
            <Field label={t('children.register.shortVideo')} htmlFor="video">
              <MediaPicker type="video" value={videoUrl} onChange={setVideoUrl} onError={setError} onUploadStart={() => setMediaUploading(true)} onUploadEnd={() => setMediaUploading(false)} allowDriveLink={false} childMeta={{ idRolf: form.id_rolf, firstName: form.first_name, lastName: form.last_name, country: form.country }} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-stone divide-y divide-stone/60 shadow-2xs">
              <ReviewRow label={t('children.register.review.fullName')} value={`${form.first_name} ${form.last_name}`} />
              <ReviewRow label={t('children.register.review.dateOfBirth')} value={form.birthdate ? formatDate(form.birthdate, locale) : "—"} />
              <ReviewRow label={t('children.register.review.calculatedAge')} value={calcAge(form.birthdate)?.toString() ?? "—"} />
              {form.year_joined && <ReviewRow label={t('children.register.review.dateJoinedHome')} value={formatDate(form.year_joined, locale)} />}
              <ReviewRow label={t('children.register.review.country')} value={form.country} />
              <ReviewRow label={t('children.register.review.rolfId')} value={form.id_rolf.toUpperCase() || "—"} />
              <ReviewRow label={t('children.register.review.careerGoal')} value={form.career_aspiration} />
              <ReviewRow label={t('children.register.review.favoriteSubject')} value={form.favorite_subject.trim() || t('children.register.review.other')} />
              <ReviewRow label={t('children.register.review.hobbiesSummary')} value={form.hobby} />
              {form.bio.trim() && <ReviewRow label={t('children.register.review.bioText')} value={form.bio} />}
              <ReviewRow label={t('children.register.review.profilePhoto')} value={photoUrl ? t('children.register.review.fileUploaded') : t('children.register.review.none')} />
              <ReviewRow label={t('children.register.review.videos')} value={videoUrl ? t('children.register.review.fileUploaded') : t('children.register.review.none')} />
            </div>
          </div>
        )}

      </div>

      {/* Sticky Bottom Context Footer */}
      <div className="sticky bottom-0 bg-white border-t border-stone px-4 py-4 mt-auto z-40">
        {step < STEP_KEYS.length - 1 ? (
          <button
            type="button"
            onClick={handleStepProgression}
            disabled={!isCurrentStepValid() || mediaUploading || loadingPreview || validatingStepZero}
            className="w-full py-3.5 rounded-xl bg-navy text-white font-semibold text-sm transition-colors duration-150 cursor-pointer hover:bg-navy/90 disabled:bg-stone disabled:text-navy/35 disabled:cursor-not-allowed"
          >
            {validatingStepZero ? t('children.register.verifying') : mediaUploading ? t('children.register.processingMedia') : t('children.register.continue')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-teal text-white font-semibold text-sm transition-colors duration-150 cursor-pointer hover:bg-teal/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? t('children.register.saving') : t('children.register.button')}
          </button>
        )}
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start px-4 py-3 gap-4">
      <span className="text-xs text-navy/45 font-medium shrink-0">{label}</span>
      <span className="text-sm text-navy font-semibold text-right">{value || "—"}</span>
    </div>
  )
}
