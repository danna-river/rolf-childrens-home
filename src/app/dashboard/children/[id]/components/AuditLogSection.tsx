"use client"

import { useState } from 'react'
import type { EditLogEntry } from '@/lib/types'

interface AuditLogSectionProps {
  editLog: EditLogEntry[]
  createdAt?: string | null
  creatorName?: string | null
  creatorRole?: string | null
}

export function AuditLogSection({ editLog, createdAt, creatorName, creatorRole }: AuditLogSectionProps) {
  const itemsPerPage = 25
  const [currentPage, setCurrentPage] = useState(1)
  const [inputPage, setInputPage] = useState('1')
  const [activeModalIdx, setActiveModalIdx] = useState<number | null>(null)

  const rawLogArray = Array.isArray(editLog) ? editLog : []

  // Force Chronological sorting (Newest timestamp always first)
  const sortedLogs = [...rawLogArray].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  if (createdAt) {
    const finalCreatorLabel = creatorName?.trim() || 'Direct Database Edit'
    const finalRoleLabel = creatorRole?.trim() || 'System'

    sortedLogs.push({
      timestamp: createdAt,
      profile: {
        full_name: finalCreatorLabel,
        role: finalRoleLabel,
        country: ''
      },
      changes: [
        { field: 'Profile Created', from: '', to: '' }
      ]
    })
  }

  const totalItems = sortedLogs.length
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedLogs = sortedLogs.slice(startIndex, endIndex)

  // Move to a page, keeping the input field in sync with the source state
  const goToPage = (page: number) => {
    setCurrentPage(page)
    setInputPage(page.toString())
  }

  // Handle direct numeric input submission
  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedPage = parseInt(inputPage, 10)

    if (!isNaN(parsedPage) && parsedPage >= 1 && parsedPage <= totalPages) {
      goToPage(parsedPage)
    } else {
      setInputPage(currentPage.toString())
    }
  }

  return (
    <div className="google-sans-registry space-y-5 rounded-xl border border-stone bg-white p-6 shadow-[0_8px_22px_rgba(21,44,75,0.08)] sm:p-8">
      {/* Log Header Row */}
      <div className="flex items-start justify-between gap-4 border-b border-stone pb-5">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-navy">System Activity Log</h3>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.18em] text-navy/45">Showing {totalItems > 0 ? startIndex + 1 : 0}–{Math.min(endIndex, totalItems)} of {totalItems} entries</p>
        </div>
        <span className="shrink-0 rounded-full border border-teal/30 bg-teal/10 px-4 py-2 text-sm font-bold uppercase tracking-wide text-teal">
          Pages: {totalPages}
        </span>
      </div>

      {totalItems === 0 ? (
        <p className="py-6 text-center text-base font-medium italic text-navy/45">No data records found for this child profile parameter.</p>
      ) : (
        <div className="max-h-[550px] divide-y divide-stone overflow-y-auto pr-1">
          {paginatedLogs.map((log, logIdx) => {
            const name = log.profile?.full_name || 'System'
            const role = log.profile?.role ? log.profile.role.charAt(0).toUpperCase() + log.profile.role.slice(1) : 'Admin'
            const countries = Array.isArray(log.profile?.country)
              ? log.profile.country.join('/')
              : log.profile?.country || ''

            const metaString = `${name} (${role} — ${countries})`

            // 🎯 FIXED HYDRATION FIX: Strict forced formatting locale loop matching Option A rules
            const dateObj = new Date(log.timestamp)
            const formattedDate = !isNaN(dateObj.getTime())
              ? dateObj.toLocaleDateString("en-US", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                  timeZone: 'America/Los_Angeles'
                }) + `, ${dateObj.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                  timeZone: 'America/Los_Angeles'
                })}`
              : "—"

            return (
              <div key={logIdx} className="flex flex-col gap-1 py-4 text-base leading-tight first:pt-0 last:pb-0">

                {/* Clickable Row Layer */}
                <div
                  className="group -mx-2 cursor-pointer rounded-lg p-2 transition-colors hover:bg-ice"
                  onClick={() => setActiveModalIdx(logIdx)}
                >
                  <div className="flex items-baseline justify-between gap-4 text-navy/65">
                    <span className="max-w-[19rem] truncate font-semibold text-navy transition-colors group-hover:text-teal">
                      {metaString} <span className="pl-1 text-xs font-medium text-teal opacity-0 group-hover:opacity-100">🔍 View Full</span>
                    </span>
                    <time className="shrink-0 whitespace-nowrap font-mono text-sm text-navy/45">
                      {formattedDate} PT
                    </time>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 font-mono text-sm">
                    {log.changes?.map((change, changeIdx) => {
                      const isCreationEntry = change.from === '' && change.to === ''

                      return (
                        <span key={changeIdx} className="inline-flex max-w-full items-center truncate rounded border border-stone bg-white px-2.5 py-1 text-navy/70">
                          <span className="text-teal font-semibold">{change.field}</span>
                          {!isCreationEntry && (
                            <>
                              <span className="mx-1 text-navy/30">:</span>
                              <span className="inline-block max-w-[4rem] truncate text-rose-700 line-through">{String(change.from)}</span>
                              <span className="mx-1 text-navy/30">→</span>
                              <span className="inline-block max-w-[5.5rem] truncate font-bold text-teal">{String(change.to)}</span>
                            </>
                          )}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* React Condition State Popup Modal */}
                {activeModalIdx === logIdx && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 google-sans-registry">
                    {/* Backdrop Overlay */}
                    <div className="absolute inset-0 bg-navy/40 backdrop-blur-xs" onClick={() => setActiveModalIdx(null)} />

                    {/* Modal Content Card */}
                    <div className="relative z-10 flex max-h-[90vh] w-full max-w-md animate-fade-in flex-col space-y-4 rounded-xl border border-stone bg-white p-5 shadow-xl">
                      <div className="shrink-0 border-b border-stone pb-3">
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="text-xs font-medium uppercase tracking-[0.13em] text-navy/45">Complete Change Ledger</h4>
                          <button onClick={() => setActiveModalIdx(null)} className="cursor-pointer text-sm font-bold text-navy/40 hover:text-navy">✕</button>
                        </div>
                        <p className="text-base font-bold text-navy mt-1">{name}</p>
                        <p className="text-[11px] text-teal font-mono mt-0.5">{role} | Region(s): {countries || "Global"} | {formattedDate} PT</p>
                      </div>

                      <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                        {log.changes?.map((change, changeIdx) => {
                          const isCreationEntry = change.from === '' && change.to === ''

                          return (
                            <div key={changeIdx} className="space-y-1.5 rounded-lg border border-stone bg-ice p-3 font-mono text-xs">
                              <div className="border-b border-stone pb-0.5 text-xs font-bold uppercase text-teal">
                                Field: {change.field}
                              </div>
                              {!isCreationEntry ? (
                                <>
                                  <div className="pt-1">
                                    <span className="block font-sans text-xs font-bold uppercase tracking-wide text-navy/45">Before Change:</span>
                                    <p className="text-rose-800 line-through bg-rose-50/40 p-1.5 rounded border border-rose-200/40 whitespace-pre-wrap break-words">{String(change.from)}</p>
                                  </div>
                                  <div className="pt-1">
                                    <span className="block font-sans text-xs font-bold uppercase tracking-wide text-navy/45">After Change:</span>
                                    <p className="text-teal bg-white p-1.5 rounded border border-teal/20 whitespace-pre-wrap break-words font-bold">{String(change.to)}</p>
                                  </div>
                                </>
                              ) : (
                                <p className="pt-1 text-xs italic text-navy/40">Initial registration record created and saved.</p>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <button onClick={() => setActiveModalIdx(null)} className="w-full shrink-0 cursor-pointer rounded-lg border border-stone bg-ice py-2 text-xs font-bold text-navy/70 transition-colors hover:bg-stone hover:text-navy">
                        Close Details View
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      )}

      {/* Selectable Pagination Footer Row */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone pt-4 text-sm">
          <button
            disabled={currentPage === 1}
            onClick={() => goToPage(Math.max(currentPage - 1, 1))}
            className="shrink-0 cursor-pointer rounded-lg border border-stone bg-white px-3 py-2 text-xs font-bold tracking-wide text-navy/65 shadow-3xs transition-colors hover:bg-ice disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← Prev
          </button>

          {/* Direct Input Form Panel */}
          <form onSubmit={handlePageSubmit} className="flex items-center gap-1.5 text-navy/45 font-medium">
            <span>Page</span>
            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              value={inputPage}
              onChange={(e) => setInputPage(e.target.value)}
              onBlur={() => setInputPage(currentPage.toString())}
              className="w-12 rounded-lg border border-stone bg-white px-1 py-1 text-center font-mono text-sm font-semibold text-navy focus:border-teal focus:outline-none"
            />
            <span>of <span className="font-mono font-bold text-navy/70">{totalPages}</span></span>
          </form>

          <button
            disabled={currentPage === totalPages}
            onClick={() => goToPage(Math.min(currentPage + 1, totalPages))}
            className="shrink-0 cursor-pointer rounded-lg border border-stone bg-white px-3 py-2 text-xs font-bold tracking-wide text-navy/65 shadow-3xs transition-colors hover:bg-ice disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
