"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { registerChild, type RegisterChildInput } from "@/components/actions"

const COUNTRY = "Uganda"

const SUBJECTS = ["Math", "English/French", "Science", "Social Studies", "PE", "Music", "Art", "Other"]

type FormData = {
  first_name: string
  last_name: string
  age: string
  birth_year: string
  year_joined: string
  career_aspiration: string
  favorite_subject: string
  hobby: string
}

const EMPTY: FormData = {
  first_name: "",
  last_name: "",
  age: "",
  birth_year: "",
  year_joined: "",
  career_aspiration: "",
  favorite_subject: "",
  hobby: "",
}

const STEPS = ["Basic Info", "About Them", "Review"]

export default function RegisterChildPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof FormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const canNext = () => {
    if (step === 0) return form.first_name.trim() && form.last_name.trim() && form.age.trim()
    if (step === 1) return form.career_aspiration.trim() && form.favorite_subject && form.hobby.trim()
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    const input: RegisterChildInput = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      age: parseInt(form.age),
      birth_year: form.birth_year ? parseInt(form.birth_year) : undefined,
      year_joined: form.year_joined ? parseInt(form.year_joined) : undefined,
      country: COUNTRY,
      career_aspiration: form.career_aspiration.trim() || undefined,
      favorite_subject: form.favorite_subject || undefined,
      hobby: form.hobby.trim() || undefined,
    }
    const { error } = await registerChild(input)
    if (error) {
      setError(error)
      setSubmitting(false)
      return
    }
    router.push("/staff")
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
        <span className="text-xs text-gray-400">{COUNTRY}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-1 bg-blue-600 transition-all duration-300"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Form body */}
      <div className="flex-1 px-4 py-6 space-y-5 max-w-lg mx-auto w-full">

        {/* Step 0: Basic Info */}
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
            <Field label="Age *" htmlFor="age">
              <input id="age" type="number" min={1} max={25} value={form.age} onChange={e => set("age", e.target.value)}
                placeholder="e.g. 10" className={inputClass} inputMode="numeric" />
            </Field>
            <Field label="Birth Year" htmlFor="birth_year">
              <input id="birth_year" type="number" min={2000} max={2025} value={form.birth_year}
                onChange={e => set("birth_year", e.target.value)} placeholder="e.g. 2014" className={inputClass} inputMode="numeric" />
            </Field>
            <Field label="Year Joined Home" htmlFor="year_joined">
              <input id="year_joined" type="number" min={2000} max={2026} value={form.year_joined}
                onChange={e => set("year_joined", e.target.value)} placeholder="e.g. 2020" className={inputClass} inputMode="numeric" />
            </Field>
          </>
        )}

        {/* Step 1: About Them */}
        {step === 1 && (
          <>
            <Field label="What do you want to be when you grow up? *" htmlFor="career">
              <input id="career" value={form.career_aspiration} onChange={e => set("career_aspiration", e.target.value)}
                placeholder="e.g. Doctor, Teacher, Engineer..." className={inputClass} autoFocus />
            </Field>
            <Field label="Favorite Subject *" htmlFor="subject">
              <div className="grid grid-cols-2 gap-2">
                {SUBJECTS.map(s => (
                  <button key={s} type="button" onClick={() => set("favorite_subject", s)}
                    className={`py-3 px-3 rounded-xl text-sm font-medium border transition-colors text-left ${
                      form.favorite_subject === s
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Hobbies *" htmlFor="hobby">
              <textarea id="hobby" value={form.hobby} onChange={e => set("hobby", e.target.value)}
                placeholder="e.g. Drawing, playing football, reading..." rows={3}
                className={inputClass + " resize-none"} />
            </Field>
          </>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              <ReviewRow label="Name" value={`${form.first_name} ${form.last_name}`} />
              <ReviewRow label="Age" value={form.age} />
              {form.birth_year && <ReviewRow label="Birth Year" value={form.birth_year} />}
              {form.year_joined && <ReviewRow label="Year Joined" value={form.year_joined} />}
              <ReviewRow label="Country" value={COUNTRY} />
              <ReviewRow label="Career Goal" value={form.career_aspiration} />
              <ReviewRow label="Favorite Subject" value={form.favorite_subject} />
              <ReviewRow label="Hobbies" value={form.hobby} />
            </div>
            <p className="text-xs text-gray-400 text-center">
              Photo & video can be added after registering.
            </p>
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 text-xs text-red-600 rounded-xl">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer button */}
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
