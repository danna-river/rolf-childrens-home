"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name A→Z" },
  { value: "name_desc", label: "Name Z→A" },
  { value: "age_asc", label: "Age ↑" },
  { value: "age_desc", label: "Age ↓" },
  { value: "rolf_id_asc", label: "ROLF ID ↑" },
  { value: "rolf_id_desc", label: "ROLF ID ↓" },
]

export function SortFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get("sort") ?? "name_asc"

  const setSort = (sort: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("sort", sort)
    params.delete("page") // sort changed → back to the first page
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Sort</span>
      <div className="flex gap-2 flex-wrap">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSort(opt.value)}
            className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors ${
              current === opt.value
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
