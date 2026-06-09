"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

export function YearJoinedFilter({ years }: { years: number[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get("yearJoined") ?? ""

  const setYear = (year: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!year || year === current) {
      params.delete("yearJoined")
    } else {
      params.set("yearJoined", year)
    }
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Year Joined</span>
      <div className="flex gap-2 flex-wrap">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setYear(String(y))}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              current === String(y)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            {y}
          </button>
        ))}
        <button
          onClick={() => setYear("unknown")}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            current === "unknown"
              ? "bg-gray-500 text-white border-gray-500"
              : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
          }`}
        >
          Unknown
        </button>
      </div>
    </div>
  )
}
