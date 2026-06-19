"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

export function StatusFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get("status") ?? "all"

  const setStatus = (status: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (status === "all") {
      params.delete("status")
    } else {
      params.set("status", status)
    }
    params.delete("page") // filter changed → back to the first page
    router.replace(`${pathname}?${params.toString()}`)
  }

  const activeClass: Record<string, string> = {
    all: "bg-gray-800 text-white border-gray-800",
    active: "bg-green-600 text-white border-green-600",
    inactive: "bg-gray-400 text-white border-gray-400",
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Status</span>
      <div className="flex gap-2">
        {["all", "active", "inactive"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors ${
              current === s ? activeClass[s] : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )
}
