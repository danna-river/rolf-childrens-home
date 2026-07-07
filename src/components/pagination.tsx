"use client"

import { useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { PAGE_SIZE } from "@/lib/pagination"
import { useLocale, useTranslations } from "@/i18n/client"

/** Inclusive integer range [start, end]. */
function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

/**
 * Build the windowed page list with leading/trailing pages always visible and
 * an ellipsis collapsing the gaps, e.g. `1 … 29 30 31 … 67`.
 */
function pageItems(
  current: number,
  totalPages: number,
  siblings = 1,
): (number | "ellipsis")[] {
  // first + last + current + 2 ellipses + siblings on each side
  const maxVisible = siblings * 2 + 5
  if (totalPages <= maxVisible) return range(1, totalPages)

  const leftSibling = Math.max(current - siblings, 1)
  const rightSibling = Math.min(current + siblings, totalPages)
  const showLeftEllipsis = leftSibling > 2
  const showRightEllipsis = rightSibling < totalPages - 2
  const edgeCount = 3 + siblings * 2

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...range(1, edgeCount), "ellipsis", totalPages]
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    return [1, "ellipsis", ...range(totalPages - edgeCount + 1, totalPages)]
  }
  return [1, "ellipsis", ...range(leftSibling, rightSibling), "ellipsis", totalPages]
}

const buttonBase =
  "inline-flex h-11 min-w-11 items-center justify-center rounded-md border px-3 text-base font-bold motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:pointer-events-none disabled:opacity-35"
const buttonIdle = "border-stone bg-white text-navy hover:bg-ice"
const buttonActive = "border-navy bg-navy text-white"

export function Pagination({
  total,
  currentPage,
}: {
  total: number
  currentPage: number
}) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.min(Math.max(currentPage, 1), totalPages)

  // Nothing to page through — the result count is shown elsewhere.
  if (totalPages <= 1) return null

  const goTo = (target: number) => {
    const next = Math.min(Math.max(target, 1), totalPages)
    if (next === page) return
    const params = new URLSearchParams(searchParams.toString())
    if (next === 1) params.delete("page")
    else params.set("page", String(next))
    const query = params.toString()
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }

  const handleJump = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = Number(new FormData(event.currentTarget).get("jump"))
    if (Number.isFinite(value)) goTo(value)
  }

  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)
  const items = pageItems(page, totalPages)
  const showJump = totalPages > 7
  const numberLocale = locale === "fr" ? "fr-FR" : "en-US"
  const formatNumber = (value: number) => value.toLocaleString(numberLocale)
  const pageOf = t("pagination.pageOf")
    .replace("{page}", formatNumber(page))
    .replace("{totalPages}", formatNumber(totalPages))

  return (
    <nav
      aria-label={t("pagination.label")}
      aria-busy={isPending}
      className={`flex flex-col gap-4 border-t border-stone pt-6 motion-safe:transition-opacity motion-safe:duration-200 sm:flex-row sm:items-center sm:justify-between ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <div className="order-2 min-w-0 text-center sm:order-1 sm:text-left">
        <p className="text-base font-semibold text-navy/65">
          <span className="hidden sm:inline">
            {t("pagination.pageOfRecords")
              .replace("{page}", formatNumber(page))
              .replace("{totalPages}", formatNumber(totalPages))
              .replace("{records}", formatNumber(total))}
          </span>
          <span className="sm:hidden">
            {t("pagination.showingChildren")
              .replace("{start}", formatNumber(start))
              .replace("{end}", formatNumber(end))
              .replace("{total}", formatNumber(total))}
          </span>
        </p>

        {showJump && (
          <form onSubmit={handleJump} className="mt-2 flex items-center justify-center gap-2 sm:justify-start">
            <label htmlFor="page-jump" className="text-xs text-navy/55">
              {t("pagination.goToPage")}
            </label>
            <input
              key={page}
              id="page-jump"
              name="jump"
              type="number"
              min={1}
              max={totalPages}
              inputMode="numeric"
              defaultValue={page}
              aria-label={t("pagination.pageNumberLabel").replace("{totalPages}", formatNumber(totalPages))}
              className="h-8 w-16 rounded-md border border-stone bg-white px-2 text-sm text-navy outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            />
            <button
              type="submit"
              className="h-8 rounded-md border border-stone bg-white px-3 text-xs font-semibold text-navy motion-safe:transition-colors hover:bg-ice focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            >
              {t("pagination.go")}
            </button>
          </form>
        )}
      </div>

      <div className="order-1 flex shrink-0 flex-wrap items-center justify-center gap-2 sm:order-2">
        <button
          type="button"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          aria-label={t("pagination.previousPage")}
          className={`${buttonBase} ${buttonIdle}`}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        <div className="hidden items-center gap-2 sm:flex">
          {items.map((item, i) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${i}`}
                aria-hidden="true"
                className="inline-flex h-11 w-8 items-center justify-center text-navy/40"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => goTo(item)}
                aria-label={t("pagination.pageOf").replace("{page}", formatNumber(item)).replace("{totalPages}", formatNumber(totalPages))}
                aria-current={item === page ? "page" : undefined}
                className={`${buttonBase} ${item === page ? buttonActive : buttonIdle}`}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <span className="px-3 text-sm font-bold text-navy/70 sm:hidden">
          {pageOf}
        </span>

        <button
          type="button"
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          aria-label={t("pagination.nextPage")}
          className={`${buttonBase} ${buttonIdle}`}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
