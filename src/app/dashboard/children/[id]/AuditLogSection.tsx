"use client"

import { useState } from 'react'

interface Change {
  field: string
  from: any
  to: any
}

interface LogEntry {
  timestamp: string
  profile?: {
    full_name?: string
    role?: string
    country?: string | string[] | null
  }
  changes?: Change[]
}

interface AuditLogSectionProps {
  editLog: any
}

export function AuditLogSection({ editLog }: AuditLogSectionProps) {
  const itemsPerPage = 25
  const [currentPage, setCurrentPage] = useState(1)
  const [activeModalIdx, setActiveModalIdx] = useState<number | null>(null)

  const rawLogArray = Array.isArray(editLog) ? (editLog as LogEntry[]) : []
  
  // Force Chronological sorting (Newest timestamp always first)
  const sortedLogs = [...rawLogArray].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  const totalItems = sortedLogs.length
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedLogs = sortedLogs.slice(startIndex, endIndex)

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2 shadow-2xs">
      {/* Log Header Row */}
      <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">System Activity Log</h3>
          <p className="text-[10px] text-gray-400">Showing {totalItems > 0 ? startIndex + 1 : 0}–{Math.min(endIndex, totalItems)} of {totalItems} entries</p>
        </div>
        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
          Page {currentPage} of {totalPages}
        </span>
      </div>

      {totalItems === 0 ? (
        <p className="text-xs text-gray-300 italic py-3 text-center">No modification data records found for this child.</p>
      ) : (
        <div className="divide-y divide-gray-50 max-h-[550px] overflow-y-auto pr-1">
          {paginatedLogs.map((log, logIdx) => {
            const name = log.profile?.full_name || 'System'
            const role = log.profile?.role ? log.profile.role.charAt(0).toUpperCase() + log.profile.role.slice(1) : 'Admin'
            const countries = Array.isArray(log.profile?.country)
              ? log.profile.country.join('/')
              : log.profile?.country || 'Global'

            const metaString = `${name} (${role} • ${countries})`

            const formattedDate = new Date(log.timestamp).toLocaleString('en-US', {
              timeZone: 'America/Los_Angeles',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })

            return (
              <div key={logIdx} className="py-2 first:pt-0 last:pb-0 flex flex-col gap-1 text-[11px] leading-tight">
                
                {/* Clickable Row Layer */}
                <div 
                  className="group cursor-pointer hover:bg-gray-50/80 p-1 rounded-lg transition-colors -mx-1"
                  onClick={() => setActiveModalIdx(logIdx)}
                >
                  <div className="flex items-baseline justify-between gap-2 text-gray-500">
                    <span className="font-semibold text-gray-700 group-hover:text-blue-600 transition-colors truncate max-w-[280px]">
                      {metaString} <span className="text-[10px] text-blue-500 font-normal opacity-0 group-hover:opacity-100 pl-1">🔍 View Full</span>
                    </span>
                    <time className="text-[10px] text-gray-400 font-mono shrink-0 whitespace-nowrap">
                      {formattedDate} PT
                    </time>
                  </div>

                  <div className="flex flex-wrap gap-1 pl-1 mt-1 font-mono text-[10px]">
                    {log.changes?.map((change, changeIdx) => (
                      <span key={changeIdx} className="bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-gray-600 inline-flex items-center max-w-full truncate">
                        <span className="text-blue-600 font-medium">{change.field}</span>
                        <span className="text-gray-400 mx-0.5">:</span>
                        <span className="text-red-400 line-through truncate max-w-[50px] inline-block">{String(change.from)}</span>
                        <span className="text-gray-400 mx-0.5">→</span>
                        <span className="text-green-600 font-medium truncate max-w-[70px] inline-block">{String(change.to)}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* React Condition State Popup Modal */}
                {activeModalIdx === logIdx && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop Overlay */}
                    <div className="absolute inset-0 bg-black/40" onClick={() => setActiveModalIdx(null)} />
                    
                    {/* Modal Content Card */}
                    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-xl max-w-md w-full relative z-10 space-y-4 max-h-[90vh] flex flex-col animate-fade-in">
                      <div className="border-b border-gray-100 pb-2 shrink-0">
                        <div className="flex justify-between items-start gap-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Complete Change Ledger</h4>
                          <button onClick={() => setActiveModalIdx(null)} className="text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer">✕</button>
                        </div>
                        <p className="text-sm font-bold text-gray-800 mt-1">{name}</p>
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{role} | Region(s): {countries} | {formattedDate} PT</p>
                      </div>

                      <div className="space-y-3 overflow-y-auto pr-1 flex-1">
                        {log.changes?.map((change, changeIdx) => (
                          <div key={changeIdx} className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 space-y-1 font-mono text-[11px]">
                            <div className="text-blue-600 font-bold border-b border-gray-200/60 pb-0.5 uppercase text-[10px]">✏️ Field: {change.field}</div>
                            <div className="pt-1">
                              <span className="text-gray-400 block font-sans text-[10px] uppercase font-semibold">Before Change:</span>
                              <p className="text-red-600 line-through bg-red-50/50 p-1 rounded border border-red-100/40 whitespace-pre-wrap break-words">{String(change.from)}</p>
                            </div>
                            <div className="pt-1">
                              <span className="text-gray-400 block font-sans text-[10px] uppercase font-semibold">After Change:</span>
                              <p className="text-green-700 bg-green-50/50 p-1 rounded border border-green-100/40 whitespace-pre-wrap break-words font-semibold">{String(change.to)}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button onClick={() => setActiveModalIdx(null)} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer shrink-0">
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

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1.5 border-t border-gray-50 text-[11px]">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            className="px-2 py-0.5 rounded border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-[10px] transition-colors cursor-pointer"
          >
            ← Prev
          </button>
          <span className="text-gray-400 font-mono text-[10px]">Page {currentPage}/{totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            className="px-2 py-0.5 rounded border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-[10px] transition-colors cursor-pointer"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}