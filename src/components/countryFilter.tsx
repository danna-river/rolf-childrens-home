"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

interface CountryFilterProps {
  countries: string[]
}

export function CountryFilter({ countries }: CountryFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get("country") ?? "all"

  const setCountry = (country: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (country === "all") {
      params.delete("country")
    } else {
      params.set("country", country)
    }
    params.delete("page") // filter changed → back to the first page
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Country</span>
      <div className="flex gap-2 flex-wrap">
        {["all", ...countries].map((c) => (
          <button
            key={c}
            onClick={() => setCountry(c)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              current === c
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>
    </div>
  )
}
