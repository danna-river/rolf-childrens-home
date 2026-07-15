"use client"

import { useState, useTransition, useEffect } from 'react'
import { saveIntakeFormAction } from '../intake-actions'
import { MediaPicker } from '../../components/MediaPicker'
import { AlertCircleIcon, CheckCircle2Icon, SaveIcon, ChevronDownIcon, FileTextIcon, PlayCircleIcon, CheckIcon, CircleIcon, PencilIcon } from 'lucide-react'
import { resolvePhotoSrc, resolveVideoThumbnail } from '@/lib/childMedia'
import { useTranslations } from '@/i18n/client'

type IntakeQuestion = {
  id: string
  question_text: string
  field_type: string
  choices?: string[]
}

type EligibleIntakeForm = {
  id: string
  title: string
  answers?: Record<string, string>
  mediaIds?: Record<string, string>
  questions?: IntakeQuestion[]
  lockedQuestions?: string[]
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
  const [isPending, startTransition] = useTransition()
  const [selectedFormId, setSelectedFormId] = useState<string>(() => {
    if (eligibleForms.length === 0) return 'choose_form'
    if (latestCompleted) return 'choose_form'
    const incompleteTarget = eligibleForms.find(f => !f.isCompleted) || eligibleForms[0]
    return incompleteTarget?.id || 'choose_form'
  })

  const [formState, setFormState] = useState<Record<string, Record<string, string>>>(() =>
    eligibleForms.reduce((acc, form) => {
      acc[form.id] = form.answers || {}
      return acc
    }, {} as Record<string, Record<string, string>>)
  )

  const [profileToggles, setProfileToggles] = useState<Record<string, boolean>>({})
  
  // Track local unlock states for locked non-media questions
  const [unlockedFields, setUnlockedFields] = useState<Record<string, boolean>>({})

  useEffect(() => {
    startTransition(() => {
      setFormState(
        eligibleForms.reduce((acc, form) => {
          acc[form.id] = form.answers || {}
          return acc
        }, {} as Record<string, Record<string, string>>)
      )
    })
  }, [eligibleForms, startTransition])
  
  const [stagedFileIds, setStagedFileIds] = useState<Record<string, string[]>>({})
  const [currentPage, setCurrentPage] = useState<number>(1)
  const QUESTIONS_PER_PAGE = 8

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
  const activeAnswers = activeForm ? { ...(activeForm.answers || {}), ...(formState[activeForm.id] || {}) } : {}

  const totalQuestions = activeForm?.questions?.length || 0
  const totalPages = Math.ceil(totalQuestions / QUESTIONS_PER_PAGE) || 1
  const startIndex = (currentPage - 1) * QUESTIONS_PER_PAGE
  const visibleQuestions = activeForm?.questions?.slice(startIndex, startIndex + QUESTIONS_PER_PAGE) || []

  const handleFormSelectChange = (newFormId: string) => {
    setSelectedFormId(newFormId)
    setCurrentPage(1)
    setSaveStatus(null)
    setStagedFileIds({})
    setProfileToggles({})
    setUnlockedFields({})
  }

  const handleInputChange = (questionId: string, value: string, fieldType: string) => {
    if (fieldType === 'number') {
      const isInvalid = value !== "" && !/^\d+$/.test(value)
      setNumericErrors(prev => ({ ...prev, [questionId]: isInvalid }))
    }

    setFormState(prev => ({
      ...prev,
      [activeForm!.id]: {
        ...(prev[activeForm!.id] || {}),
        [questionId]: value
      }
    }))
    if (saveStatus) setSaveStatus(null)
  }

  const handleMediaChange = (questionId: string, url: string | null, fieldType: string) => {
    handleInputChange(questionId, url || '', fieldType)

    if (!url) {
      setProfileToggles(prev => ({ ...prev, [questionId]: false }))
    }

    if (url && url.includes("/d/")) {
      const extractedId = url.split("/d/")[1]?.split("/")[0]
      if (extractedId) {
        setStagedFileIds(prev => ({
          ...prev,
          [activeForm!.id]: [...(prev[activeForm!.id] || []), extractedId]
        }))
      }
    }
  }

  const toggleProfilePictureSetting = (questionId: string) => {
    setProfileToggles(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }))
  }

  const toggleFieldUnlock = (questionId: string) => {
    setUnlockedFields(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }))
  }

  const handleSaveForm = () => {
    if (!activeForm) return
    if (Object.values(numericErrors).some(err => err)) {
        setSaveStatus({ type: 'error', msg: t('children.intake.numericError') })
        return
    }

    setSaveStatus(null)
    startTransition(async () => {
      const res = await saveIntakeFormAction(
        childId, 
        activeForm.id, 
        activeForm.title, 
        activeAnswers,
        Array.from(new Set(stagedFileIds[activeForm.id] || [])),
        profileToggles
      )
      if (res.error) {
        setSaveStatus({ type: 'error', msg: res.error })
      } else {
        setSaveStatus({ type: 'success', msg: t('children.intake.saved') })
        setStagedFileIds(prev => ({ ...prev, [activeForm.id]: [] }))
        setProfileToggles({})
        setUnlockedFields({})
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
        <div key={`${activeForm.id}-${activeForm.lockedQuestions?.length || 0}`} className="space-y-5 pt-1 animate-fade-in">
          
          <div className="space-y-4">
            {visibleQuestions.map((q: IntakeQuestion, qIdx: number) => {
              const absoluteQuestionNumber = startIndex + qIdx + 1
              const currentResponse = activeAnswers[q.id] || ''
              const isFieldBlank = !currentResponse.toString().trim()
              const mediaId = activeForm?.mediaIds?.[q.id]
              const isMediaQuestion = q.field_type === 'media_photo' || q.field_type === 'media_video'
              const lockedMediaThumbnail = isMediaQuestion
                ? mediaId
                  ? `/api/media/${mediaId}/thumbnail`
                  : q.field_type === 'media_photo'
                    ? resolvePhotoSrc(currentResponse, 400)
                    : resolveVideoThumbnail(currentResponse, 400)
                : null

              const isDbLocked = activeForm?.lockedQuestions?.includes(q.id) || false
              const isFieldUnlockedLocally = unlockedFields[q.id] || false
              
              // Only apply pencil unlock bypass rules if the question is NOT a media field
              const isFieldPermanentlyLocked = isMediaQuestion ? isDbLocked : (isDbLocked && !isFieldUnlockedLocally)
              const isSetAsProfileChecked = profileToggles[q.id] || false

              return (
                <div key={q.id} className="space-y-1.5 bg-ice/40 p-3 rounded-md border border-stone/80">
                  <div className="flex items-center justify-between gap-4">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-navy/70">
                      <span className="text-teal font-mono mr-1">#{absoluteQuestionNumber}.</span> {q.question_text} {isFieldBlank && <span className="text-rose-600 font-normal lowercase italic">{t('children.intake.required')}</span>}
                    </label>

                    {/* Render Pencil Icon ONLY for locked non-media rows */}
                    {isDbLocked && !isMediaQuestion && (
                      <button
                        type="button"
                        onClick={() => toggleFieldUnlock(q.id)}
                        className={`p-1.5 rounded-md border transition-all cursor-pointer ${
                          isFieldUnlockedLocally 
                            ? 'bg-teal/10 border-teal/30 text-teal shadow-3xs' 
                            : 'bg-white border-stone text-navy/40 hover:text-navy hover:bg-ice'
                        }`}
                        title={isFieldUnlockedLocally ? "Lock Field Edit Access" : "Unlock Field Edit Access"}
                      >
                        <PencilIcon className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {q.field_type === 'select' ? (
                    <select
                      value={currentResponse}
                      disabled={isFieldPermanentlyLocked}
                      onChange={(e) => handleInputChange(q.id, e.target.value, q.field_type)}
                      className="font-semibold w-full rounded-md border border-stone bg-white px-3 py-2 text-xs text-navy outline-none focus:border-teal transition-all cursor-pointer disabled:opacity-60"
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
                          disabled={isFieldPermanentlyLocked}
                          onClick={() => handleInputChange(q.id, option.value, q.field_type)}
                          className={`px-6 py-1.5 text-xs font-bold rounded-md border transition-all disabled:opacity-50 ${
                            currentResponse === option.value
                              ? 'bg-teal/15 border-teal/40 text-teal shadow-2xs' 
                              : 'bg-white border-stone text-navy/65 hover:bg-ice'
                          } ${!isFieldPermanentlyLocked ? 'cursor-pointer' : ''}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : (q.field_type === 'media_photo' || q.field_type === 'media_video') ? (
                    <div className="pt-1.5 space-y-2">
                      {isFieldPermanentlyLocked ? (
                        <div className="bg-white border border-stone rounded-md p-4 flex flex-col sm:flex-row items-center gap-4 shadow-3xs animate-fade-in">
                          <div className="shrink-0">
                            {lockedMediaThumbnail ? (
                              <div className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={lockedMediaThumbnail}
                                  alt="Intake asset file"
                                  className="h-24 w-24 rounded-md object-cover border border-stone"
                                />
                                {q.field_type === 'media_video' && (
                                  <PlayCircleIcon className="absolute inset-0 m-auto size-8 text-white drop-shadow" />
                                )}
                              </div>
                            ) : q.field_type === 'media_photo' ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img 
                                src={currentResponse || undefined} 
                                alt="Intake asset file" 
                                className="h-24 w-24 rounded-md object-cover border border-stone"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <video 
                                src={currentResponse || undefined} 
                                controls 
                                className="h-24 aspect-video rounded-md bg-stone border border-stone" 
                              />
                            )}
                          </div>
                          <div className="flex-1 text-center sm:text-left space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-navy/5 text-navy/70 px-2 py-0.5 rounded border border-stone/50">
                              🔒 Field Locked
                            </span>
                            <p className="text-xs font-semibold text-navy/80">
                              An answer has already been submitted for this field.
                            </p>
                            <p className="text-[11px] text-navy/50 leading-relaxed">
                              To replace this file, it must first be removed from the child&apos;s central Media Library Portfolio grid panel.
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* CSS OVERRIDE CONTAINER: Inject toggle buttons directly under MediaPicker layouts */
                        <div className="[&_p.text-gray-400]:hidden space-y-3">
                          <MediaPicker
                            type={q.field_type === 'media_video' ? 'video' : 'photo'}
                            value={currentResponse}
                            onChange={(url) => handleMediaChange(q.id, url, q.field_type)}
                            childMeta={{
                              idRolf: childId,
                              country: 'all',
                            }}
                          />
                          
                          {!isFieldBlank && (
                            <div className="flex justify-center pt-1 animate-fade-in">
                              <button
                                type="button"
                                onClick={() => toggleProfilePictureSetting(q.id)}
                                className={`w-full max-w-xs flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all duration-150 shadow-2xs cursor-pointer ${
                                  isSetAsProfileChecked
                                    ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                                    : 'bg-stone/15 border-stone/30 text-navy/80 hover:bg-stone/25'
                                }`}
                              >
                                {isSetAsProfileChecked ? (
                                  <CheckIcon className="size-3.5 text-white stroke-[3px]" />
                                ) : (
                                  <CircleIcon className="size-3.5 text-navy/50 stroke-[2.5px]" />
                                )}
                                <span>
                                  {q.field_type === 'media_video' ? 'Set as New Profile Video' : 'Set as New Profile Picture'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <input
                        type={q.field_type}
                        disabled={isFieldPermanentlyLocked}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        value={currentResponse}
                        onChange={(e) => handleInputChange(q.id, e.target.value, q.field_type)}
                        placeholder={t('children.intake.placeholder').replace('{type}', q.field_type)}
                        className={`font-semibold w-full rounded-md border px-3 py-2 text-xs bg-white outline-none transition-all disabled:opacity-60 disabled:bg-stone/10 ${
                          numericErrors[q.id] 
                            ? 'border-rose-400 bg-rose-50/20 text-rose-900' 
                            : 'border-stone text-navy placeholder:text-navy/30 focus:border-teal'
                        }`}
                      />
                      {numericErrors[q.id] && (
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