"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

const OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

export function StatusFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get("status") ?? "all"

  const set = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all") params.delete("status")
    else params.set("status", value)
    params.delete("page")
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy/40">Status</p>
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => set(opt.value)}
            className={`min-h-9 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
              current === opt.value
                ? "border-teal bg-teal text-white"
                : "border-stone bg-white text-navy/65 hover:border-teal/50 hover:text-navy"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
