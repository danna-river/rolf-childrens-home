"use client"

import React, { useState } from 'react'

export function QuickNotes({
  placeholder,
}: {
  placeholder?: string
}) {
  const STORAGE_KEY = 'quick_notes_register_child'
  const [notes, setNotes] = useState('')

  // load saved notes once
  React.useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v) setNotes(v)
    } catch (e) {
      // ignore
    }
  }, [])

  // autosave
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, notes)
    } catch (e) {
      // ignore
    }
  }, [notes])

  return (
    <div className="bg-white rounded-md border border-stone p-4 mb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-navy/45">Quick Notes for Bio (Not saved)</p>
          <p className="text-xs text-navy/60 mt-1">These notes help create the short bio. They stay on this device and will not be saved to the server.</p>
        </div>
        <div className="text-xs text-navy/50">Saved on this device</div>
      </div>

      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder={placeholder || 'Type quick notes here (e.g. found alone, single-parent household)'}
        className="w-full mt-3 min-h-[84px] resize-none rounded-md border border-stone px-3 py-2 text-sm"
      />

      
    </div>
  )
}

export default QuickNotes
