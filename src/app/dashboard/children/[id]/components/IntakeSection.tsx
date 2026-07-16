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
      <div className="rounded-xl border border-stone bg-white p-8 text-center shadow-2xs">
        <p className="text-base font-medium italic text-navy/45">{t('children.intake.empty')}</p>
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
    <div className="google-sans-registry space-y-6 rounded-xl border border-stone bg-white p-6 shadow-[0_8px_22px_rgba(21,44,75,0.08)] sm:p-8">
      
      {/* Structural Headers */}
      <div className="space-y-5 border-b border-stone pb-6">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-navy sm:text-3xl">{t('children.intake.title')}</h3>
          <p className="mt-2 text-base font-medium leading-snug text-navy/55 sm:text-lg">{t('children.intake.subtitle')}</p>
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-base font-medium leading-relaxed text-amber-700">
            {t('children.intake.englishOnlyHelp')}
          </p>
        </div>
        
        <div>
          {latestCompleted ? (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-5 py-2 text-sm font-bold uppercase tracking-wide text-teal">
              <CheckCircle2Icon className="size-4 shrink-0" />
              <span>{t('children.intake.latestCompleted')}</span>
            </span>
          ) : (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-2 text-sm font-bold uppercase tracking-wide text-rose-700">
              <AlertCircleIcon className="size-4 shrink-0" />
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
          className="w-full cursor-pointer appearance-none rounded-xl border border-stone bg-ice px-5 py-4 pr-12 text-base font-bold text-navy outline-none transition-all focus:border-teal"
        >
          <option value="choose_form">{t('children.intake.chooseForm')}</option>
          {eligibleForms.map((form) => (
            <option key={form.id} value={form.id}>
              {form.title} {form.isLatest ? t('children.intake.latestForm') : ""} — {form.isCompleted ? t('children.intake.completed') : t('children.intake.pendingAnswers')}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute bottom-0 right-5 top-0 flex items-center justify-center">
          <ChevronDownIcon className="size-5 text-navy/40" />
        </div>
      </div>

      {/* Viewport Render logic */}
      {selectedFormId === 'choose_form' || !activeForm ? (
        <div className="mt-4 space-y-3 border-t border-stone py-10 text-center">
          <FileTextIcon className="mx-auto size-10 text-navy/20" aria-hidden="true" />
          <p className="text-base font-medium text-navy/60">{t('children.intake.selectHelp')}</p>
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
                <div key={q.id} className="space-y-4 rounded-xl border border-stone/80 bg-ice/40 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <label className="block text-base font-bold uppercase tracking-wide text-navy/70">
                      <span className="mr-2 font-mono text-teal">#{absoluteQuestionNumber}.</span> {q.question_text} {isFieldBlank && <span className="font-normal lowercase italic text-rose-600">{t('children.intake.required')}</span>}
                    </label>

                    {/* Render Pencil Icon ONLY for locked non-media rows */}
                    {isDbLocked && !isMediaQuestion && (
                      <button
                        type="button"
                        onClick={() => toggleFieldUnlock(q.id)}
                        className={`cursor-pointer rounded-lg border p-2 transition-all ${
                          isFieldUnlockedLocally 
                            ? 'bg-teal/10 border-teal/30 text-teal shadow-3xs' 
                            : 'bg-white border-stone text-navy/40 hover:text-navy hover:bg-ice'
                        }`}
                        title={isFieldUnlockedLocally ? "Lock Field Edit Access" : "Unlock Field Edit Access"}
                      >
                        <PencilIcon className="size-4" />
                      </button>
                    )}
                  </div>

                  {q.field_type === 'select' ? (
                    <select
                      value={currentResponse}
                      disabled={isFieldPermanentlyLocked}
                      onChange={(e) => handleInputChange(q.id, e.target.value, q.field_type)}
                      className="w-full cursor-pointer rounded-xl border border-stone bg-white px-4 py-3 text-base font-semibold text-navy outline-none transition-all focus:border-teal disabled:opacity-60"
                    >
                      <option value="">{t('children.intake.chooseOption')}</option>
                      {(q.choices || []).map((choice: string, cIdx: number) => (
                        <option key={cIdx} value={choice}>{choice}</option>
                      ))}
                    </select>
                  ) : q.field_type === 'boolean' ? (
                    <div className="flex gap-3 pt-0.5">
                      {[
                        { value: 'Yes', label: t('children.intake.yes') },
                        { value: 'No', label: t('children.intake.no') },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          disabled={isFieldPermanentlyLocked}
                          onClick={() => handleInputChange(q.id, option.value, q.field_type)}
                          className={`rounded-lg border px-7 py-2.5 text-base font-bold transition-all disabled:opacity-50 ${
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
                        <div className="flex animate-fade-in flex-col items-center gap-5 rounded-xl border border-stone bg-white p-5 shadow-3xs sm:flex-row">
                          <div className="shrink-0">
                            {lockedMediaThumbnail ? (
                              <div className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={lockedMediaThumbnail}
                                  alt="Intake asset file"
                                  className="h-32 w-32 rounded-xl border border-stone object-cover"
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
                                className="h-32 w-32 rounded-xl border border-stone object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <video 
                                src={currentResponse || undefined} 
                                controls 
                                className="aspect-video h-32 rounded-xl border border-stone bg-stone"
                              />
                            )}
                          </div>
                          <div className="flex-1 space-y-2 text-center sm:text-left">
                            <span className="inline-flex items-center gap-1 rounded border border-stone/50 bg-navy/5 px-3 py-1 text-xs font-bold uppercase text-navy/70">
                              🔒 Field Locked
                            </span>
                            <p className="text-base font-semibold text-navy/80">
                              An answer has already been submitted for this field.
                            </p>
                            <p className="text-sm leading-relaxed text-navy/50">
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
                                className={`flex w-full max-w-sm cursor-pointer items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold shadow-2xs transition-all duration-150 ${
                                  isSetAsProfileChecked
                                    ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
                                    : 'bg-stone/15 border-stone/30 text-navy/80 hover:bg-stone/25'
                                }`}
                              >
                                {isSetAsProfileChecked ? (
                                  <CheckIcon className="size-4 text-white stroke-[3px]" />
                                ) : (
                                  <CircleIcon className="size-4 text-navy/50 stroke-[2.5px]" />
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
                        className={`w-full rounded-xl border bg-white px-4 py-3 text-base font-semibold outline-none transition-all disabled:bg-stone/10 disabled:opacity-60 ${
                          numericErrors[q.id] 
                            ? 'border-rose-400 bg-rose-50/20 text-rose-900' 
                            : 'border-stone text-navy placeholder:text-navy/30 focus:border-teal'
                        }`}
                      />
                      {numericErrors[q.id] && (
                        <p className="flex items-center gap-1 text-xs font-bold text-rose-700">
                          <AlertCircleIcon className="size-3.5" /> {t('children.intake.digitsOnly')}
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
            <div className="flex items-center justify-between border-y border-stone px-1 py-3 text-sm font-bold text-navy/70">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                className="cursor-pointer rounded-lg border border-stone bg-white px-4 py-2 shadow-3xs transition-colors hover:bg-ice disabled:opacity-30"
              >
                {t('children.intake.prev')}
              </button>
              <span className="font-mono text-xs uppercase tracking-wider text-navy/50">
                {t('pagination.pageOf')
                  .replace('{page}', String(currentPage))
                  .replace('{totalPages}', String(totalPages))}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                className="cursor-pointer rounded-lg border border-stone bg-white px-4 py-2 shadow-3xs transition-colors hover:bg-ice disabled:opacity-30"
              >
                {t('children.intake.next')}
              </button>
            </div>
          )}

          {/* Docked Global Save Footer */}
          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 pr-4 text-sm font-bold">
              {saveStatus?.type === 'success' && <p className="text-teal animate-fade-in">{saveStatus.msg}</p>}
              {saveStatus?.type === 'error' && <p className="text-rose-700 animate-fade-in">{saveStatus.msg}</p>}
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveForm}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal px-8 py-4 text-base font-bold text-white shadow-2xs transition-all hover:bg-teal/90 disabled:opacity-40"
            >
              <SaveIcon className="size-5" />
              <span>{isPending ? t('children.intake.saving') : t('children.intake.saveChoices')}</span>
            </button>
          </div>

        </div>
      )}

    </div>
  )
}
