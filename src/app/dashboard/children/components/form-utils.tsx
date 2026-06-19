import type { ReactNode } from "react"

export const SUBJECTS = ["Math", "Language", "Science", "Social Studies", "Gym / PE", "Music", "Art", "History", "Other"]

export function calcAge(birthdate: string): number | null {
  if (!birthdate) return null
  const today = new Date()
  const dob = new Date(birthdate)
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age
}

export function toDateString(year?: number | null, month?: number | null, day?: number | null): string {
  if (!year) return ""
  const m = String(month ?? 1).padStart(2, "0")
  const d = String(day ?? 1).padStart(2, "0")
  return `${year}-${m}-${d}`
}

export const inputClass = "w-full px-4 py-3 rounded-xl border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-base font-medium text-gray-800">{label}</label>
      {children}
    </div>
  )
}
