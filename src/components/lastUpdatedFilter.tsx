"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "@/i18n/client"

/** Option values map to date ranges in getChildrenProfiles: recent windows to
 *  see fresh edits, plus "over a year ago" to surface stale profiles. */
export function LastUpdatedFilter() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get("updated") ?? "all"

  const set = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "all") params.delete("updated")
    else params.set("updated", value)
    params.delete("page")
    router.replace(`${pathname}?${params.toString()}`)
  }

  const options = [
    { value: "all", label: t("children.filters.all") },
    { value: "7d", label: t("children.filters.last7Days") },
    { value: "30d", label: t("children.filters.last30Days") },
    { value: "6m", label: t("children.filters.last6Months") },
    { value: "over1y", label: t("children.filters.overYearAgo") },
  ]

  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-navy/40">{t("children.filters.lastUpdated")}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
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
