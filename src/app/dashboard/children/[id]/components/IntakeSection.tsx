"use client"

import { useState, useTransition } from 'react'
import { saveIntakeFormAction } from '../intake-actions'
import { AlertCircleIcon, CheckCircle2Icon, SaveIcon, ChevronDownIcon } from 'lucide-react'

interface IntakeSectionProps {
  childId: string
  eligibleForms: any[]
  latestCompleted: boolean
}

export function IntakeSection({ childId, eligibleForms, latestCompleted }: IntakeSectionProps) {
  const [selectedFormId, setSelectedFormId] = useState<string>(eligibleForms[0]?.id || '')
  const [formState, setFormState] = useState<Record<string, Record<string, string>>>(
    eligibleForms.reduce((acc, form) => {
      acc[form.id] = form.answers || {}
      return acc
    }, {} as Record<string, any>)
  )
  
  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  if (eligibleForms.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
        <p className="text-xs text-gray-400 italic">No historical intake forms match this child's profile or timeline constraint rules.</p>
      </div>
    )
  }

  const activeForm = eligibleForms.find(f => f.id === selectedFormId) || eligibleForms[0]
  const activeAnswers = formState[activeForm.id] || {}

  const handleInputChange = (questionText: string, value: string) => {
    setFormState(prev => ({
      ...prev,
      [activeForm.id]: {
        ...(prev[activeForm.id] || {}),
        [questionText]: value
      }
    }))
    if (saveStatus) setSaveStatus(null)
  }

  const handleSaveForm = () => {
    setSaveStatus(null)
    startTransition(async () => {
      const res = await saveIntakeFormAction(childId, activeForm.id, activeForm.title, activeAnswers)
      if (res.error) {
        setSaveStatus({ type: 'error', msg: res.error })
      } else {
        setSaveStatus({ type: 'success', msg: 'Intake changes saved and logged successfully.' })
        setTimeout(() => setSaveStatus(null), 4000)
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4 shadow-2xs">
      
      {/* Structural Headers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-50 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Assigned Intake Worksheets</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Forms matching chronological join windows and regions</p>
        </div>
        
        {/* Latest Form Tracking Notice Badge */}
        <div className="self-start sm:self-center">
          {latestCompleted ? (
            <span className="inline-flex items-center gap-1 text-[11px] bg-green-50 text-green-700 font-medium px-2.5 py-0.5 rounded-full">
              <CheckCircle2Icon className="size-3" /> Latest Form Completed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] bg-red-50 text-red-600 font-medium px-2.5 py-0.5 rounded-full animate-pulse">
              <AlertCircleIcon className="size-3" /> Latest Form Pending Answers
            </span>
          )}
        </div>
      </div>

      {/* Selector dropdown menu element */}
      <div className="relative">
        <select
          value={selectedFormId}
          onChange={(e) => {
            setSelectedFormId(e.target.value)
            setSaveStatus(null)
          }}
          className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer pr-10"
        >
          {eligibleForms.map((form) => (
            <option key={form.id} value={form.id}>
              {form.title} {form.isLatest ? "⭐ (Latest Form)" : ""} — {form.isCompleted ? "✓ Done" : "⏳ Incomplete"}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Dynamic Input Component Generation Grid */}
      <div className="space-y-3.5 pt-1">
        {activeForm.questions.map((q: any, qIdx: number) => {
          const currentResponse = activeAnswers[q.question_text] || ''
          const isFieldBlank = !currentResponse.trim()

          return (
            <div key={qIdx} className="space-y-1">
              <label className="block text-xs font-semibold text-gray-600">
                {q.question_text} {isFieldBlank && <span className="text-red-400 font-normal text-[10px] lowercase italic">(Required)</span>}
              </label>

              {q.field_type === 'select' ? (
                <select
                  value={currentResponse}
                  onChange={(e) => handleInputChange(q.question_text, e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-xs outline-none transition-all ${
                    isFieldBlank ? 'border-red-200 bg-red-50/10 focus:border-red-400' : 'border-gray-100 focus:border-blue-500'
                  }`}
                >
                  <option value="">-- Choose Option --</option>
                  {(q.choices || []).map((choice: string, cIdx: number) => (
                    <option key={cIdx} value={choice}>{choice}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={q.field_type === 'number' ? 'number' : q.field_type === 'date' ? 'date' : 'text'}
                  value={currentResponse}
                  onChange={(e) => handleInputChange(q.question_text, e.target.value)}
                  placeholder={`Provide ${q.field_type} answer...`}
                  className={`w-full rounded-lg border px-3 py-2 text-xs outline-none transition-all ${
                    isFieldBlank ? 'border-red-200 bg-red-50/10 focus:border-red-400' : 'border-gray-100 focus:border-blue-500'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Operation Footer elements */}
      <div className="flex items-center justify-between border-t border-gray-50 pt-3 mt-2">
        <div className="text-[11px] font-medium flex-1 pr-4">
          {saveStatus?.type === 'success' && <p className="text-green-600">{saveStatus.msg}</p>}
          {saveStatus?.type === 'error' && <p className="text-red-600 font-bold">⚠️ {saveStatus.msg}</p>}
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleSaveForm}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg transition-all shadow-2xs cursor-pointer shrink-0"
        >
          <SaveIcon className="size-3.5" />
          {isPending ? "Saving..." : "Save Choices"}
        </button>
      </div>

    </div>
  )
}