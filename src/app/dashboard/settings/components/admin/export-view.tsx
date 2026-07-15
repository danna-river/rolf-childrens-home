"use client"

import React, { useState, useEffect } from 'react'
import { Download, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { getIntakeFormsAction } from '../../actions/admin-actions'

interface FormItem {
  id: string
  name: string
}

export function ExportView() {
  // Explicitly type the useState array to prevent 'never[]' type inference
  const [forms, setForms] = useState<FormItem[]>([])
  const [selectedFormId, setSelectedFormId] = useState<string>('')
  
  const [downloading, setDownloading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch available templates for selection
  useEffect(() => {
    async function loadForms() {
      const res = await getIntakeFormsAction()
      if (res.error) {
        setError(`Failed to load templates: ${res.error}`)
      } else if (res.forms) {
        // Explicitly assert types on incoming payload
        const fetchedForms = res.forms as FormItem[]
        setForms(fetchedForms)
        
        if (fetchedForms.length > 0) {
          setSelectedFormId(fetchedForms[0].id)
        }
      }
    }
    loadForms()
  }, [])

  const triggerExport = async (type: 'children' | 'intake') => {
    setDownloading(type)
    setError(null)
    try {
      // Build correct URL based on whether parameter filtering is required
      const url = type === 'intake' 
        ? `/api/admin/export/intake?formId=${selectedFormId}`
        : `/api/admin/export/children`

      const res = await fetch(url)
      
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || `Failed to download. Status: ${res.status}`)
      }
      
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `${type}_export_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err: any) {
      setError(err.message || 'An error occurred during file download.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl bg-white rounded-lg border border-slate-100 shadow-xs">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-800">Administrative Table Exporter</h2>
        <p className="text-xs text-slate-500 mt-1">
          Export application schemas directly as secure flat CSV spreadsheets. Data sanitization mechanisms protect against CSV injection vectors automatically.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Children Export */}
        <div className="p-4 border border-slate-200 rounded-md hover:border-slate-300 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="size-5 text-teal" />
              <h3 className="text-xs font-bold text-slate-800">Children Table</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Export all registered child files and historical metrics safely. Sanitizes nested attributes dynamically.
            </p>
          </div>
          <button
            onClick={() => triggerExport('children')}
            disabled={downloading !== null}
            className="w-full py-2 bg-teal text-white text-xs font-bold rounded-md hover:bg-teal-dark disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="size-3.5" />
            {downloading === 'children' ? 'Generating...' : 'Download CSV'}
          </button>
        </div>

        {/* Card 2: Intake Export with Selector */}
        <div className="p-4 border border-slate-200 rounded-md hover:border-slate-300 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="size-5 text-indigo-500" />
              <h3 className="text-xs font-bold text-slate-800">Dynamic Intake Forms</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Select an active intake template below. It will dynamically aggregate and map all submitted answers into separate CSV columns.
            </p>

            <div className="mb-4">
              <label htmlFor="formSelect" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Target Intake Template
              </label>
              <select
                id="formSelect"
                value={selectedFormId}
                onChange={(e) => setSelectedFormId(e.target.value)}
                className="w-full p-2 text-xs border border-slate-200 rounded-md bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                {forms.length === 0 ? (
                  <option value="">No templates found...</option>
                ) : (
                  forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
          
          <button
            onClick={() => triggerExport('intake')}
            disabled={downloading !== null || !selectedFormId}
            className="w-full py-2 bg-slate-800 text-white text-xs font-bold rounded-md hover:bg-slate-900 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="size-3.5" />
            {downloading === 'intake' ? 'Generating...' : 'Download Selected Form CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}