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
    <div className="google-sans-registry bg-white rounded-md border border-stone p-4 space-y-3 shadow-sm">
      {/* Log Header Row */}
      <div className="flex items-center justify-between border-b border-stone pb-2.5">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-navy">System Activity Log</h3>
          <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45 mt-0.5">Showing {totalItems > 0 ? startIndex + 1 : 0}–{Math.min(endIndex, totalItems)} of {totalItems} entries</p>
        </div>
        <span className="text-[10px] bg-teal/10 text-teal border border-teal/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
          Pages: {totalPages}
        </span>
      </div>

      {totalItems === 0 ? (
        <p className="text-xs text-navy/45 italic py-4 text-center font-medium">No data records found for this child profile parameter.</p>
      ) : (
        <div className="divide-y divide-stone max-h-[550px] overflow-y-auto pr-1">
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
              <div key={logIdx} className="py-2.5 first:pt-0 last:pb-0 flex flex-col gap-1 text-[11px] leading-tight">

                {/* Clickable Row Layer */}
                <div
                  className="group cursor-pointer hover:bg-ice p-1.5 rounded-md transition-colors -mx-1"
                  onClick={() => setActiveModalIdx(logIdx)}
                >
                  <div className="flex items-baseline justify-between gap-4 text-navy/65">
                    <span className="font-semibold text-navy group-hover:text-teal transition-colors truncate max-w-[280px]">
                      {metaString} <span className="text-[10px] text-teal font-medium opacity-0 group-hover:opacity-100 pl-1">🔍 View Full</span>
                    </span>
                    <time className="text-[10px] text-navy/45 font-mono shrink-0 whitespace-nowrap">
                      {formattedDate} PT
                    </time>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-1.5 font-mono text-[10px]">
                    {log.changes?.map((change, changeIdx) => {
                      const isCreationEntry = change.from === '' && change.to === ''

                      return (
                        <span key={changeIdx} className="bg-white border border-stone rounded px-1.5 py-0.5 text-navy/70 inline-flex items-center max-w-full truncate">
                          <span className="text-teal font-semibold">{change.field}</span>
                          {!isCreationEntry && (
                            <>
                              <span className="text-navy/30 mx-0.5">:</span>
                              <span className="text-rose-700 line-through truncate max-w-[50px] inline-block">{String(change.from)}</span>
                              <span className="text-navy/30 mx-0.5">→</span>
                              <span className="text-teal font-bold truncate max-w-[70px] inline-block">{String(change.to)}</span>
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
                    <div className="bg-white rounded-md p-5 border border-stone shadow-xl max-w-md w-full relative z-10 space-y-4 max-h-[90vh] flex flex-col animate-fade-in">
                      <div className="border-b border-stone pb-2.5 shrink-0">
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">Complete Change Ledger</h4>
                          <button onClick={() => setActiveModalIdx(null)} className="text-navy/40 hover:text-navy font-bold text-sm cursor-pointer">✕</button>
                        </div>
                        <p className="text-base font-bold text-navy mt-1">{name}</p>
                        <p className="text-[11px] text-teal font-mono mt-0.5">{role} | Region(s): {countries || "Global"} | {formattedDate} PT</p>
                      </div>

                      <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                        {log.changes?.map((change, changeIdx) => {
                          const isCreationEntry = change.from === '' && change.to === ''

                          return (
                            <div key={changeIdx} className="bg-ice border border-stone rounded-md p-3 space-y-1.5 font-mono text-[11px]">
                              <div className="text-teal font-bold border-b border-stone pb-0.5 uppercase text-[10px]">
                                Field: {change.field}
                              </div>
                              {!isCreationEntry ? (
                                <>
                                  <div className="pt-1">
                                    <span className="text-navy/45 block font-sans text-[10px] uppercase font-bold tracking-wide">Before Change:</span>
                                    <p className="text-rose-800 line-through bg-rose-50/40 p-1.5 rounded border border-rose-200/40 whitespace-pre-wrap break-words">{String(change.from)}</p>
                                  </div>
                                  <div className="pt-1">
                                    <span className="text-navy/45 block font-sans text-[10px] uppercase font-bold tracking-wide">After Change:</span>
                                    <p className="text-teal bg-white p-1.5 rounded border border-teal/20 whitespace-pre-wrap break-words font-bold">{String(change.to)}</p>
                                  </div>
                                </>
                              ) : (
                                <p className="text-navy/40 italic text-[10px] pt-1">Initial registration record created and saved.</p>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <button onClick={() => setActiveModalIdx(null)} className="w-full py-2 bg-ice border border-stone text-navy/70 hover:bg-stone hover:text-navy font-bold rounded-md text-xs transition-colors cursor-pointer shrink-0">
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
        <div className="flex items-center justify-between pt-3 border-t border-stone text-[11px]">
          <button
            disabled={currentPage === 1}
            onClick={() => goToPage(Math.max(currentPage - 1, 1))}
            className="px-2.5 py-1.5 rounded-md border border-stone text-navy/65 bg-white hover:bg-ice disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-bold tracking-wide transition-colors cursor-pointer shrink-0 shadow-3xs"
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
              className="w-10 text-center py-0.5 px-1 border border-stone text-navy rounded-md font-mono text-[11px] focus:border-teal focus:outline-none bg-white font-semibold"
            />
            <span>of <span className="font-mono font-bold text-navy/70">{totalPages}</span></span>
          </form>

          <button
            disabled={currentPage === totalPages}
            onClick={() => goToPage(Math.min(currentPage + 1, totalPages))}
            className="px-2.5 py-1.5 rounded-md border border-stone text-navy/65 bg-white hover:bg-ice disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-bold tracking-wide transition-colors cursor-pointer shrink-0 shadow-3xs"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}