"use client"

import { useState, useTransition, useEffect, useRef } from 'react'
import { saveIntakeFormAction } from '../intake-actions'
import { enrollChildProfilePhoto } from '@/lib/face/enroll'
import { MediaPicker } from '../../components/MediaPicker'
import { AlertCircleIcon, CheckCircle2Icon, SaveIcon, ChevronDownIcon, FileTextIcon, PlayCircleIcon, CheckIcon, CircleUserRoundIcon, PencilIcon, LockIcon, ClockIcon, TriangleAlertIcon } from 'lucide-react'
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
  /** questionId → upload date (ISO) for answers pre-filled from a recent profile upload */
  suggestedMedia?: Record<string, string>
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

  // Track local unlock states for locked non-media questions
  const [unlockedFields, setUnlockedFields] = useState<Record<string, boolean>>({})

  // Custom form-picker dropdown open state; closes on outside click / Escape
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const selectedOptionRef = useRef<HTMLButtonElement>(null)

  // When the panel opens, bring the checkmarked form into view in case the
  // list has scrolled past it.
  useEffect(() => {
    if (pickerOpen) selectedOptionRef.current?.scrollIntoView({ block: 'nearest' })
  }, [pickerOpen])

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

  useEffect(() => {
    if (!pickerOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pickerOpen])

  const [stagedFileIds, setStagedFileIds] = useState<Record<string, string[]>>({})
  const [currentPage, setCurrentPage] = useState<number>(1)
  const QUESTIONS_PER_PAGE = 8

  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [indexingFace, setIndexingFace] = useState(false)
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

  const answeredCountFor = (form: EligibleIntakeForm) => {
    const answers = { ...(form.answers || {}), ...(formState[form.id] || {}) }
    return (form.questions || []).filter(q => (answers[q.id] || '').toString().trim() !== '').length
  }

  const answeredLabelFor = (form: EligibleIntakeForm) =>
    t('children.intake.answeredCount')
      .replace('{answered}', String(answeredCountFor(form)))
      .replace('{total}', String(form.questions?.length || 0))

  // Dropdown display order: actionable (pending) forms first, completed below.
  // Stable sort keeps the server's order within each group, and the original
  // `eligibleForms` array is untouched for the auto-select logic above.
  const displayForms = [...eligibleForms].sort(
    (a, b) => Number(a.isCompleted ?? false) - Number(b.isCompleted ?? false)
  )

  const renderStatusPill = (completed?: boolean) =>
    completed ? (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
        <CheckCircle2Icon className="size-3.5" />
        {t('children.intake.completed')}
      </span>
    ) : (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
        <ClockIcon className="size-3.5" />
        {t('children.intake.pendingAnswers')}
      </span>
    )

  const renderLatestBadge = () => (
    <span className="inline-flex shrink-0 items-center rounded bg-sky/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy">
      {t('children.intake.latestForm')}
    </span>
  )

  const handleFormSelectChange = (newFormId: string) => {
    setSelectedFormId(newFormId)
    setCurrentPage(1)
    setSaveStatus(null)
    setStagedFileIds({})
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
        Array.from(new Set(stagedFileIds[activeForm.id] || []))
      )
      if (res.error) {
        setSaveStatus({ type: 'error', msg: res.error })
      } else {
        setSaveStatus({ type: 'success', msg: t('children.intake.saved') })
        setStagedFileIds(prev => ({ ...prev, [activeForm.id]: [] }))
        setUnlockedFields({})
        setTimeout(() => setSaveStatus(null), 4000)

        // The save assigned a new profile photo, which dropped the old face
        // template (DB trigger) — index the new photo on this device. A failure
        // just leaves the child in the admin backfill queue.
        if (res.profilePhotoChanged) {
          setIndexingFace(true)
          await enrollChildProfilePhoto(childId)
          setIndexingFace(false)
        }
      }
    })
  }

  return (
    <div className="google-sans-registry space-y-5 rounded-xl border border-stone bg-white p-5 shadow-[0_8px_22px_rgba(21,44,75,0.08)] sm:p-6">

      {/* Compact header: title + status pill inline */}
      <div className="space-y-3 border-b border-stone pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-bold tracking-tight text-navy">{t('children.intake.title')}</h3>
          {latestCompleted ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal">
              <CheckCircle2Icon className="size-3 shrink-0" />
              <span>{t('children.intake.latestCompleted')}</span>
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">
              <AlertCircleIcon className="size-3 shrink-0" />
              <span>{t('children.intake.latestPending')}</span>
            </span>
          )}
        </div>

        {/* English-only notice: single tight alert strip */}
        <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-snug text-amber-800 sm:text-sm">
          <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">{t('children.intake.englishOnlyHelp')}</span>
        </p>
      </div>

      {/* Custom form picker (replaces native select) */}
      <div ref={pickerRef} className="relative w-full">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen(open => !open)}
          className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-ice px-4 py-3 text-left outline-none transition-all ${
            pickerOpen ? 'border-teal' : 'border-stone hover:border-teal/50 focus-visible:border-teal'
          }`}
        >
          <FileTextIcon className="size-5 shrink-0 text-teal" aria-hidden="true" />
          {activeForm ? (
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-base font-bold text-navy">{activeForm.title}</span>
                {activeForm.isLatest && renderLatestBadge()}
                {renderStatusPill(activeForm.isCompleted)}
              </span>
              <span className="mt-1.5 flex items-center gap-2.5">
                <span className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-stone">
                  <span
                    className="block h-full rounded-full bg-teal transition-[width] duration-500"
                    style={{
                      width: `${
                        (activeForm.questions?.length || 0) > 0
                          ? (answeredCountFor(activeForm) / (activeForm.questions?.length || 1)) * 100
                          : 0
                      }%`,
                    }}
                  />
                </span>
                <span className="shrink-0 text-sm font-medium text-navy/50">{answeredLabelFor(activeForm)}</span>
              </span>
            </span>
          ) : (
            <span className="flex-1 text-base font-bold text-navy/55">{t('children.intake.chooseForm')}</span>
          )}
          <ChevronDownIcon
            className={`size-5 shrink-0 text-navy/40 transition-transform duration-200 ${pickerOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {pickerOpen && (
          <div
            role="listbox"
            className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-stone bg-white shadow-[0_12px_32px_rgba(21,44,75,0.16)] animate-fade-in"
          >
            <button
              type="button"
              role="option"
              aria-selected={selectedFormId === 'choose_form'}
              onClick={() => {
                handleFormSelectChange('choose_form')
                setPickerOpen(false)
              }}
              className="w-full cursor-pointer border-b border-stone/60 px-4 py-2.5 text-center text-sm font-medium italic text-navy/45 transition-colors hover:bg-ice"
            >
              {t('children.intake.chooseForm')}
            </button>
            {displayForms.map((form) => {
              const isSelected = form.id === selectedFormId
              return (
                <button
                  key={form.id}
                  ref={isSelected ? selectedOptionRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    handleFormSelectChange(form.id)
                    setPickerOpen(false)
                  }}
                  className={`flex w-full cursor-pointer items-center gap-3 border-b border-stone/40 px-4 py-3 text-left transition-colors last:border-b-0 ${
                    isSelected ? 'bg-teal/5' : 'hover:bg-ice/70'
                  }`}
                >
                  <span className="w-4 shrink-0" aria-hidden="true">
                    {isSelected && <CheckIcon className="size-4 stroke-[3px] text-teal" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-bold text-navy">{form.title}</span>
                      {form.isLatest && renderLatestBadge()}
                    </span>
                    <span className="mt-0.5 block text-xs font-medium text-navy/50">{answeredLabelFor(form)}</span>
                  </span>
                  {renderStatusPill(form.isCompleted)}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Viewport Render logic */}
      {selectedFormId === 'choose_form' || !activeForm ? (
        <div className="mt-4 space-y-3 border-t border-stone py-10 text-center">
          <FileTextIcon className="mx-auto size-10 text-navy/20" aria-hidden="true" />
          <p className="text-base font-medium text-navy/60">{t('children.intake.selectHelp')}</p>
        </div>
      ) : (
        <div key={`${activeForm.id}-${activeForm.lockedQuestions?.length || 0}`} className="space-y-4 pt-1 animate-fade-in">

          <div className="space-y-3">
            {visibleQuestions.map((q: IntakeQuestion, qIdx: number) => {
              const absoluteQuestionNumber = startIndex + qIdx + 1
              const currentResponse = activeAnswers[q.id] || ''
              const isFieldBlank = !currentResponse.toString().trim()
              const mediaId = activeForm?.mediaIds?.[q.id]
              // media_* = library upload only; profile_* = also becomes the child's profile media on save
              const isVideoQuestion = q.field_type === 'media_video' || q.field_type === 'profile_video'
              const isProfileMediaQuestion = q.field_type === 'profile_photo' || q.field_type === 'profile_video'
              const isMediaQuestion =
                q.field_type === 'media_photo' || q.field_type === 'media_video' || isProfileMediaQuestion
              const lockedMediaThumbnail = isMediaQuestion
                ? mediaId
                  ? `/api/media/${mediaId}/thumbnail`
                  : !isVideoQuestion
                    ? resolvePhotoSrc(currentResponse, 400)
                    : resolveVideoThumbnail(currentResponse, 400)
                : null

              const isDbLocked = activeForm?.lockedQuestions?.includes(q.id) || false
              const isFieldUnlockedLocally = unlockedFields[q.id] || false

              // Only apply pencil unlock bypass rules if the question is NOT a media field
              const isFieldPermanentlyLocked = isMediaQuestion ? isDbLocked : (isDbLocked && !isFieldUnlockedLocally)

              return (
                <div key={q.id} className="overflow-hidden rounded-lg border border-stone/70 bg-white">
                  {/* Question header row */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-stone/50 px-4 py-3">
                    <span className="font-mono text-sm font-bold text-teal">#{absoluteQuestionNumber}</span>
                    <label className={`text-[15px] font-semibold ${isFieldPermanentlyLocked ? 'text-navy/45' : 'text-navy'}`}>
                      {q.question_text}
                    </label>
                    {isFieldBlank && (
                      <span className="text-sm font-normal italic text-rose-600">{t('children.intake.required')}</span>
                    )}
                    {isDbLocked && (
                      <span className="inline-flex items-center gap-1 rounded bg-stone/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy/50">
                        <LockIcon className="size-3" aria-hidden="true" />
                        {t('children.intake.locked')}
                      </span>
                    )}

                    {/* Render Pencil Icon ONLY for locked non-media rows */}
                    {isDbLocked && !isMediaQuestion && (
                      <button
                        type="button"
                        onClick={() => toggleFieldUnlock(q.id)}
                        className={`ml-auto cursor-pointer rounded-lg border p-1.5 transition-all ${
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

                  {/* Input area */}
                  <div className="p-3">
                    {q.field_type === 'select' ? (
                      <div className="relative">
                        <select
                          value={currentResponse}
                          disabled={isFieldPermanentlyLocked}
                          onChange={(e) => handleInputChange(q.id, e.target.value, q.field_type)}
                          className="w-full cursor-pointer appearance-none rounded-lg border border-stone bg-white px-3.5 py-2.5 pr-10 text-[15px] font-semibold text-navy outline-none transition-all focus:border-teal focus:ring-2 focus:ring-teal/20 disabled:cursor-default disabled:opacity-60"
                        >
                          <option value="">{t('children.intake.chooseOption')}</option>
                          {(q.choices || []).map((choice: string, cIdx: number) => (
                            <option key={cIdx} value={choice}>{choice}</option>
                          ))}
                        </select>
                        <ChevronDownIcon
                          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-navy/40"
                          aria-hidden="true"
                        />
                      </div>
                    ) : q.field_type === 'boolean' ? (
                      <div className="flex gap-2">
                        {[
                          { value: 'Yes', label: t('children.intake.yes') },
                          { value: 'No', label: t('children.intake.no') },
                        ].map((option) => {
                          const isChosen = currentResponse === option.value
                          return (
                            <button
                              key={option.value}
                              type="button"
                              disabled={isFieldPermanentlyLocked}
                              onClick={() => handleInputChange(q.id, isChosen ? '' : option.value, q.field_type)}
                              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-6 py-2.5 text-[15px] font-bold transition-all disabled:opacity-50 sm:flex-none sm:min-w-[130px] ${
                                isChosen
                                  ? 'bg-teal/15 border-teal/40 text-teal shadow-2xs'
                                  : 'bg-white border-stone text-navy/65 hover:bg-ice'
                              } ${!isFieldPermanentlyLocked ? 'cursor-pointer' : ''}`}
                            >
                              {isChosen && <CheckIcon className="size-4 stroke-[3px]" aria-hidden="true" />}
                              {option.label}
                            </button>
                          )
                        })}
                      </div>
                    ) : isMediaQuestion ? (
                      <div className="space-y-2">
                        {isFieldPermanentlyLocked ? (
                          <div className="flex animate-fade-in flex-col items-center gap-4 rounded-lg border border-stone/70 bg-ice/40 p-4 sm:flex-row">
                            <div className="relative shrink-0">
                              {lockedMediaThumbnail ? (
                                <div className="relative">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={lockedMediaThumbnail}
                                    alt="Intake asset file"
                                    className="h-24 w-24 rounded-lg border border-stone object-cover"
                                  />
                                  {isVideoQuestion && (
                                    <PlayCircleIcon className="absolute inset-0 m-auto size-8 text-white drop-shadow" />
                                  )}
                                </div>
                              ) : !isVideoQuestion ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={currentResponse || undefined}
                                  alt="Intake asset file"
                                  className="h-24 w-24 rounded-lg border border-stone object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <video
                                  src={currentResponse || undefined}
                                  controls
                                  className="aspect-video h-24 rounded-lg border border-stone bg-stone"
                                />
                              )}
                              <span className="absolute bottom-1 left-1 rounded bg-navy/70 p-1 text-white" aria-hidden="true">
                                <LockIcon className="size-3" />
                              </span>
                            </div>
                            <div className="flex-1 space-y-1.5 text-center sm:text-left">
                              <span className="inline-flex items-center gap-1 rounded border border-stone/50 bg-navy/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy/60">
                                <LockIcon className="size-3" aria-hidden="true" />
                                Field Locked
                              </span>
                              <p className="text-[15px] font-semibold text-navy/80">
                                An answer has already been submitted for this field.
                              </p>
                              <p className="text-sm leading-relaxed text-navy/50">
                                To replace this file, it must first be removed from the child&apos;s central Media Library Portfolio grid panel.
                              </p>
                            </div>
                          </div>
                        ) : (
                          /* CSS OVERRIDE CONTAINER: tuck helper notes under MediaPicker layouts */
                          <div className="[&_p.text-gray-400]:hidden space-y-3">
                            {isProfileMediaQuestion && (
                              <p className="flex items-start gap-1.5 rounded-lg border border-teal/25 bg-teal/5 px-3 py-2 text-xs font-medium leading-snug text-navy/80">
                                <CircleUserRoundIcon className="mt-0.5 size-3.5 shrink-0 text-teal" aria-hidden="true" />
                                <span>
                                  {t(
                                    isVideoQuestion
                                      ? 'children.intake.profileVideoNote'
                                      : 'children.intake.profilePhotoNote'
                                  )}
                                </span>
                              </p>
                            )}
                            {(() => {
                              const suggestedAt = activeForm?.suggestedMedia?.[q.id]
                              const isSuggestionActive =
                                !!suggestedAt &&
                                !isFieldBlank &&
                                currentResponse === (activeForm?.answers?.[q.id] || '')
                              if (!isSuggestionActive) return null
                              return (
                                <p className="flex items-start gap-1.5 rounded-lg border border-sky bg-sky/30 px-3 py-2 text-xs font-medium leading-snug text-navy/80 animate-fade-in">
                                  <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-teal" aria-hidden="true" />
                                  <span>
                                    {t(
                                      isVideoQuestion
                                        ? 'children.intake.prefilledVideo'
                                        : 'children.intake.prefilledPhoto'
                                    ).replace('{date}', new Date(suggestedAt).toLocaleDateString())}
                                  </span>
                                </p>
                              )
                            })()}
                            <MediaPicker
                              type={isVideoQuestion ? 'video' : 'photo'}
                              value={currentResponse}
                              onChange={(url) => handleMediaChange(q.id, url, q.field_type)}
                              childMeta={{
                                idRolf: childId,
                                country: 'all',
                              }}
                            />
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
                          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] font-semibold outline-none transition-all disabled:bg-stone/10 disabled:opacity-60 ${
                            numericErrors[q.id]
                              ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:ring-2 focus:ring-rose-200'
                              : 'border-stone text-navy placeholder:text-navy/30 focus:border-teal focus:ring-2 focus:ring-teal/20'
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
                className="cursor-pointer rounded-lg border border-stone bg-white px-4 py-2 shadow-3xs transition-colors hover:bg-ice disabled:cursor-default disabled:opacity-30"
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
                className="cursor-pointer rounded-lg border border-stone bg-white px-4 py-2 shadow-3xs transition-colors hover:bg-ice disabled:cursor-default disabled:opacity-30"
              >
                {t('children.intake.next')}
              </button>
            </div>
          )}

          {/* Docked Global Save Footer */}
          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 pr-4 text-sm font-bold">
              {saveStatus?.type === 'success' && (
                <p className="flex items-center gap-1.5 text-teal animate-fade-in">
                  <CheckCircle2Icon className="size-4 shrink-0" aria-hidden="true" />
                  {saveStatus.msg}
                </p>
              )}
              {saveStatus?.type === 'error' && (
                <p className="flex items-center gap-1.5 text-rose-700 animate-fade-in">
                  <AlertCircleIcon className="size-4 shrink-0" aria-hidden="true" />
                  {saveStatus.msg}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={isPending}
              onClick={handleSaveForm}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal px-8 py-3.5 text-base font-bold text-white shadow-2xs transition-all hover:bg-teal/90 disabled:opacity-40"
            >
              <SaveIcon className="size-5" />
              <span>{indexingFace ? t('children.faceSearch.indexing') : isPending ? t('children.intake.saving') : t('children.intake.saveChoices')}</span>
            </button>
          </div>

        </div>
      )}

    </div>
  )
}
