"use client"

import { useState, useTransition } from 'react'
import { saveIntakeFormAction } from '../intake-actions'
import { AlertCircleIcon, CheckCircle2Icon, SaveIcon, ChevronDownIcon, FileTextIcon } from 'lucide-react'
import { useTranslations } from '@/i18n/client'

type IntakeQuestion = {
  question_text: string
  field_type: string
  choices?: string[]
}

type EligibleIntakeForm = {
  id: string
  title: string
  answers?: Record<string, string>
  questions?: IntakeQuestion[]
  isLatest?: boolean
  isCompleted?: boolean
}

interface IntakeSectionProps {
  childId: string
  eligibleForms: EligibleIntakeForm[]
  latestCompleted: boolean
}

export function IntakeSection({ childId, eligibleForms, latestCompleted }: IntakeSectionProps) {
  const t = useTranslations()
  const [selectedFormId, setSelectedFormId] = useState<string>(() => {
    if (eligibleForms.length === 0) return 'choose_form'
    if (latestCompleted) return 'choose_form'
    const incompleteTarget = eligibleForms.find(f => !f.isCompleted) || eligibleForms[0]
    return incompleteTarget?.id || 'choose_form'
  })

  const [formState, setFormState] = useState<Record<string, Record<string, string>>>(
    eligibleForms.reduce((acc, form) => {
      acc[form.id] = form.answers || {}
      return acc
    }, {} as Record<string, Record<string, string>>)
  )
  
  const [currentPage, setCurrentPage] = useState<number>(1)
  const QUESTIONS_PER_PAGE = 8

  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [numericErrors, setNumericErrors] = useState<Record<string, boolean>>({})

  if (eligibleForms.length === 0) {
    return (
      <div className="bg-white rounded-md border border-stone p-6 text-center shadow-2xs">
        <p className="text-xs text-navy/45 italic font-medium">{t('children.intake.empty')}</p>
      </div>
    )
  }

  const activeForm = eligibleForms.find(f => f.id === selectedFormId) || null
  const activeAnswers = activeForm ? (formState[activeForm.id] || {}) : {}

  const totalQuestions = activeForm?.questions?.length || 0
  const totalPages = Math.ceil(totalQuestions / QUESTIONS_PER_PAGE) || 1
  const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE
  const visibleQuestions = activeForm?.questions?.slice(startIndex, startIndex + QUESTIONS_PER_PAGE) || []

  const handleFormSelectChange = (newFormId: string) => {
    setSelectedFormId(newFormId)
    setCurrentPage(1)
    setSaveStatus(null)
  }

  const handleInputChange = (questionText: string, value: string, fieldType: string) => {
    if (fieldType === 'number') {
      const isInvalid = value !== "" && !/^\d+$/.test(value)
      setNumericErrors(prev => ({ ...prev, [questionText]: isInvalid }))
    }

    setFormState(prev => ({
      ...prev,
      [activeForm!.id]: {
        ...(prev[activeForm!.id] || {}),
        [questionText]: value
      }
    }))
    if (saveStatus) setSaveStatus(null)
  }

  const handleSaveForm = () => {
    if (!activeForm) return
    if (Object.values(numericErrors).some(err => err)) {
        setSaveStatus({ type: 'error', msg: t('children.intake.numericError') })
        return
    }

    setSaveStatus(null)
    startTransition(async () => {
      const res = await saveIntakeFormAction(childId, activeForm.id, activeForm.title, activeAnswers)
      if (res.error) {
        setSaveStatus({ type: 'error', msg: res.error })
      } else {
        setSaveStatus({ type: 'success', msg: t('children.intake.saved') })
        setTimeout(() => setSaveStatus(null), 4000)
      }
    })
  }

  return (
    <div className="google-sans-registry bg-white rounded-md border border-stone p-5 sm:p-6 space-y-5 shadow-sm">
      
      {/* Structural Headers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone pb-4">
        <div>
          <h3 className="text-base font-bold tracking-tight text-navy">{t('children.intake.title')}</h3>
          <p className="text-xs text-navy/55 mt-0.5 font-medium">{t('children.intake.subtitle')}</p>
          <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium leading-relaxed text-amber-700">
            {t('children.intake.englishOnlyHelp')}
          </p>
        </div>
        
        <div className="self-start sm:self-center">
          {latestCompleted ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide bg-teal/10 text-teal px-3 py-1 rounded-full border border-teal/20">
              <CheckCircle2Icon className="size-3.5" />
              <span>{t('children.intake.latestCompleted')}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide bg-rose-50 text-rose-700 px-3 py-1 rounded-full border border-rose-200 animate-pulse">
              <AlertCircleIcon className="size-3.5" />
              <span>{t('children.intake.latestPending')}</span>
            </span>
          )}
        </div>
      </div>

      {/* Stable Dropdown Wrapper */}
      <div className="relative w-full">
        <select
          value={selectedFormId}
          onChange={(e) => handleFormSelectChange(e.target.value)}
          className="w-full appearance-none rounded-md border border-stone bg-ice px-3.5 py-2.5 text-xs font-bold text-navy outline-none focus:border-teal transition-all cursor-pointer pr-10"
        >
          <option value="choose_form">{t('children.intake.chooseForm')}</option>
          {eligibleForms.map((form) => (
            <option key={form.id} value={form.id}>
              {form.title} {form.isLatest ? t('children.intake.latestForm') : ""} — {form.isCompleted ? t('children.intake.completed') : t('children.intake.pendingAnswers')}
            </option>
          ))}
        </select>
        <div className="absolute right-3.5 top-0 bottom-0 flex items-center justify-center pointer-events-none">
          <ChevronDownIcon className="size-4 text-navy/40" />
        </div>
      </div>

      {/* Viewport Render logic */}
      {selectedFormId === 'choose_form' || !activeForm ? (
        <div className="py-8 text-center border-t border-stone mt-4 space-y-2">
          <FileTextIcon className="size-8 text-navy/20 mx-auto" aria-hidden="true" />
          <p className="text-xs text-navy/60 font-medium">{t('children.intake.selectHelp')}</p>
        </div>
      ) : (
        <div className="space-y-5 pt-1 animate-fade-in">
          
          <div className="space-y-4">
            {visibleQuestions.map((q: IntakeQuestion, qIdx: number) => {
              const absoluteQuestionNumber = startIndex + qIdx + 1
              const currentResponse = activeAnswers[q.question_text] || ''
              const isFieldBlank = !currentResponse.toString().trim()

              return (
                <div key={absoluteQuestionNumber} className="space-y-1.5 bg-ice/40 p-3 rounded-md border border-stone/80">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-navy/70">
                    <span className="text-teal font-mono mr-1">#{absoluteQuestionNumber}.</span> {q.question_text} {isFieldBlank && <span className="text-rose-600 font-normal lowercase italic">{t('children.intake.required')}</span>}
                  </label>

                  {q.field_type === 'select' ? (
                    <select
                      value={currentResponse}
                      onChange={(e) => handleInputChange(q.question_text, e.target.value, q.field_type)}
                      className="font-semibold w-full rounded-md border border-stone bg-white px-3 py-2 text-xs text-navy outline-none focus:border-teal transition-all cursor-pointer"
                    >
                      <option value="">{t('children.intake.chooseOption')}</option>
                      {(q.choices || []).map((choice: string, cIdx: number) => (
                        <option key={cIdx} value={choice}>{choice}</option>
                      ))}
                    </select>
                  ) : q.field_type === 'boolean' ? (
                    <div className="flex gap-2 pt-0.5">
                      {[
                        { value: 'Yes', label: t('children.intake.yes') },
                        { value: 'No', label: t('children.intake.no') },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleInputChange(q.question_text, option.value, q.field_type)}
                          className={`px-6 py-1.5 text-xs font-bold rounded-md border transition-all cursor-pointer ${
                            currentResponse === option.value
                              ? 'bg-teal/15 border-teal/40 text-teal shadow-2xs' 
                              : 'bg-white border-stone text-navy/65 hover:bg-ice'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <input
                        type={q.field_type}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        value={currentResponse}
                        onChange={(e) => handleInputChange(q.question_text, e.target.value, q.field_type)}
                        placeholder={t('children.intake.placeholder').replace('{type}', q.field_type)}
                        className={`font-semibold w-full rounded-md border px-3 py-2 text-xs bg-white outline-none transition-all ${
                          numericErrors[q.question_text] 
                            ? 'border-rose-400 bg-rose-50/20 text-rose-900' 
                            : 'border-stone text-navy placeholder:text-navy/30 focus:border-teal'
                        }`}
                      />
                      {numericErrors[q.question_text] && (
                        <p className="text-[10px] font-bold text-rose-700 flex items-center gap-1">
                          <AlertCircleIcon className="size-3" /> {t('children.intake.digitsOnly')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination Page Flipper Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between py-2.5 px-1 border-t border-b border-stone text-xs font-bold text-navy/70">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                className="px-3 py-1.5 rounded-md border border-stone bg-white hover:bg-ice disabled:opacity-30 cursor-pointer shadow-3xs transition-colors"
              >
                {t('children.intake.prev')}
              </button>
              <span className="font-mono text-[11px] uppercase tracking-wider text-navy/50">
                {t('pagination.pageOf')
                  .replace('{page}', String(currentPage))
                  .replace('{totalPages}', String(totalPages))}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                className="px-3 py-1.5 rounded-md border border-stone bg-white hover:bg-ice disabled:opacity-30 cursor-pointer shadow-3xs transition-colors"
              >
                {t('children.intake.next')}
              </button>
            </div>
          )}

          {/* Docked Global Save Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] font-bold flex-1 pr-4">
              {saveStatus?.type === 'success' && <p className="text-teal animate-fade-in">{saveStatus.msg}</p>}
              {saveStatus?.type === 'error' && <p className="text-rose-700 animate-fade-in">{saveStatus.msg}</p>}
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveForm}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-teal hover:bg-teal/90 disabled:opacity-40 rounded-md transition-all shadow-2xs cursor-pointer shrink-0"
            >
              <SaveIcon className="size-3.5" />
              <span>{isPending ? t('children.intake.saving') : t('children.intake.saveChoices')}</span>
            </button>
          </div>

        </div>
      )}

    </div>
  )
}
