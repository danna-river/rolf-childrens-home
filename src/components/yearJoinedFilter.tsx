"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

export function YearJoinedFilter({ years }: { years: number[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const current = searchParams.get("yearJoined") ?? "all"

  const setYear = (year: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (year === "all") {
      params.delete("yearJoined")
    } else {
      params.set("yearJoined", year)
    }
    params.delete("page") // filter changed → back to the first page
    router.replace(`${pathname}?${params.toString()}`)
  }

  const filterOptions = ["all", ...years.map(String), "unknown"]

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Year Joined</span>
      <div className="flex gap-2 flex-wrap">
        {filterOptions.map((option) => {
          const isActive = current === option
          
          // Match dynamic colors for different active filter buttons
          let activeStyles = "bg-blue-600 text-white border-blue-600"
          if (option === "unknown") activeStyles = "bg-gray-500 text-white border-gray-500"

          return (
            <button
              key={option}
              onClick={() => setYear(option)}
              className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors capitalize ${
                isActive
                  ? activeStyles
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}