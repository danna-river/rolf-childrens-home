"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

const PAGE_SIZE = 10

export function Pagination({ total, currentPage }: { total: number; currentPage: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (totalPages <= 1) return null

  const goTo = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(page))
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <button
        onClick={() => goTo(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:border-gray-400 transition-colors"
      >
        ← Prev
      </button>
      <span className="text-xs text-gray-400">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => goTo(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-600 disabled:opacity-30 hover:border-gray-400 transition-colors"
      >
        Next →
      </button>
    </div>
  )
}
