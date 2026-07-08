"use client"

import { useState, useEffect } from "react"
import { PlusIcon, TrashIcon, ToggleLeftIcon, ToggleRightIcon, PencilIcon, SaveIcon, XIcon, GlobeIcon, AlertCircleIcon, MoveIcon } from "lucide-react"
import { useTranslations } from "@/i18n/client"
import {
    getIntakeTemplates,
    createIntakeTemplate,
    updateIntakeTemplate,
    toggleTemplateStatus,
    deleteTemplate,
    getIntakeCountries
} from "../../actions/intake-actions"
import type { QuestionInput, IntakeTemplate } from "../intake-types"
import type { FieldTypeConstraint } from "../intake-types"

export function IntakeView() {
    const t = useTranslations()
    const [templates, setTemplates] = useState<IntakeTemplate[]>([])
    const [countries, setCountries] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [formTitle, setFormTitle] = useState("")
    const [formCountry, setFormCountry] = useState("all")
    const [formQuestions, setFormQuestions] = useState<QuestionInput[]>([
        { question_text: "", field_type: "text", choices: [""] }
    ])

    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null)
    const [templateDeleteConfirmId, setTemplateDeleteConfirmId] = useState<string | null>(null)

    // Drag tracking state
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

    const [showSavePrompt, setShowSavePrompt] = useState(false)
    const [transactionError, setTransactionError] = useState<string | null>(null)

    const [validationErrors, setValidationErrors] = useState<{
        title: boolean;
        questions: number[];
        choices: number[];
        attempted: boolean;
    }>({ title: false, questions: [], choices: [], attempted: false })

    useEffect(() => {
        Promise.all([getIntakeTemplates(), getIntakeCountries()]).then(([tplRes, countryList]) => {
            if (tplRes.data) setTemplates(tplRes.data)
            if (countryList) setCountries(countryList)
            setLoading(false)
        })
    }, [])

    const handleAddQuestion = () => {
        setFormQuestions([...formQuestions, { question_text: "", field_type: "text", choices: [""] }])
        setDeleteConfirmIndex(null)
    }

    const handleRemoveQuestionAttempt = (index: number) => {
        if (deleteConfirmIndex === index) {
            setFormQuestions(formQuestions.filter((_, i) => i !== index))
            setDeleteConfirmIndex(null)
            setValidationErrors(prev => ({
                ...prev,
                questions: prev.questions.filter(i => i !== index).map(i => i > index ? i - 1 : i),
                choices: prev.choices.filter(i => i !== index).map(i => i > index ? i - 1 : i)
            }))
        } else {
            setDeleteConfirmIndex(index)
        }
    }

    const handleQuestionChange = (index: number, key: keyof QuestionInput, value: string | FieldTypeConstraint) => {
        const updated = [...formQuestions]
        updated[index] = { ...updated[index], [key]: value } as QuestionInput
        setFormQuestions(updated)
        
        if (validationErrors.attempted) {
            if (key === "question_text" && value.trim()) {
                setValidationErrors(prev => ({ ...prev, questions: prev.questions.filter(i => i !== index) }))
            }
            if (key === "field_type") {
                setValidationErrors(prev => ({ ...prev, choices: prev.choices.filter(i => i !== index) }))
            }
        }
    }

    const handleChoiceChange = (qIndex: number, cIndex: number, value: string) => {
        const updated = [...formQuestions]
        const choices = [...(updated[qIndex].choices || [""])]
        choices[cIndex] = value
        updated[qIndex].choices = choices
        setFormQuestions(updated)

        if (validationErrors.attempted && value.trim()) {
            setValidationErrors(prev => ({ ...prev, choices: prev.choices.filter(i => i !== qIndex) }))
        }
    }

    const handleAddChoice = (qIndex: number) => {
        const updated = [...formQuestions]
        updated[qIndex].choices = [...(updated[qIndex].choices || []), ""]
        setFormQuestions(updated)
    }

    const handleRemoveChoice = (qIndex: number, cIndex: number) => {
        const updated = [...formQuestions]
        updated[qIndex].choices = (updated[qIndex].choices || []).filter((_, i) => i !== cIndex)
        setFormQuestions(updated)
    }

    const handleDragStart = (index: number) => {
        setDraggedIndex(index)
    }

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === index) return

        const reorderedQuestions = [...formQuestions]
        const targetItem = reorderedQuestions[draggedIndex]
        
        reorderedQuestions.splice(draggedIndex, 1)
        reorderedQuestions.splice(index, 0, targetItem)
        
        setDraggedIndex(index)
        setFormQuestions(reorderedQuestions)

        if (validationErrors.attempted) {
            const updateErrors = (arr: number[]) =>
                arr.map(errIdx => {
                    if (errIdx === draggedIndex) return index
                    if (errIdx >= Math.min(draggedIndex, index) && errIdx <= Math.max(draggedIndex, index)) {
                        return errIdx + (draggedIndex > index ? 1 : -1)
                    }
                    return errIdx
                })
            setValidationErrors(prev => ({
                ...prev,
                questions: updateErrors(prev.questions),
                choices: updateErrors(prev.choices)
            }))
        }
    }

    const handleDragEnd = () => {
        setDraggedIndex(null)
    }

    const resetForm = () => {
        setEditingId(null)
        setFormTitle("")
        setFormCountry("all")
        setFormQuestions([{ question_text: "", field_type: "text", choices: [""] }])
        setDeleteConfirmIndex(null)
        setShowSavePrompt(false)
        setTransactionError(null)
        setValidationErrors({ title: false, questions: [], choices: [], attempted: false })
    }

    const validateAndTriggerPrompt = () => {
        let hasErrors = false
        const newErrors = { title: false, questions: [] as number[], choices: [] as number[], attempted: true }

        if (!formTitle.trim()) {
            newErrors.title = true
            hasErrors = true
        }

        formQuestions.forEach((q, idx) => {
            if (!q.question_text.trim()) {
                newErrors.questions.push(idx)
                hasErrors = true
            }
        })

        formQuestions.forEach((q, idx) => {
            if (q.field_type === 'select') {
                const validOptions = q.choices?.filter(c => c && c.trim() !== '') || []
                if (validOptions.length === 0 || (q.choices && q.choices.some(c => !c.trim()))) {
                    newErrors.choices.push(idx)
                    hasErrors = true
                }
            }
        })

        setValidationErrors(newErrors)

        if (hasErrors) {
            setTransactionError("Deployment Blocked: Please resolve form mapping errors highlighted below.")
            setShowSavePrompt(false)
            return
        }

        setTransactionError(null)
        setShowSavePrompt(true)
    }

    const executeSaveTransaction = async () => {
        setShowSavePrompt(false)
        const res = editingId
            ? await updateIntakeTemplate(editingId, formTitle, formCountry, formQuestions)
            : await createIntakeTemplate(formTitle, formCountry, formQuestions)

        if (res.error) {
            setTransactionError(`Database Transaction Rejected: ${res.error}`)
        } else {
            resetForm()
            const updated = await getIntakeTemplates()
            if (updated.data) setTemplates(updated.data)
        }
    }

    const handleToggleStatus = async (id: string, currentStatus: 'active' | 'inactive') => {
        await toggleTemplateStatus(id, currentStatus)
        const updated = await getIntakeTemplates()
        if (updated.data) setTemplates(updated.data)
    }

    const handleTemplateDeleteAttempt = async (id: string) => {
        if (templateDeleteConfirmId === id) {
            await deleteTemplate(id)
            setTemplateDeleteConfirmId(null)
            const updated = await getIntakeTemplates()
            if (updated.data) setTemplates(updated.data)
        } else {
            setTemplateDeleteConfirmId(id)
        }
    }

    const startEdit = (tpl: IntakeTemplate) => {
        setEditingId(tpl.id)
        setFormTitle(tpl.title)
        setFormCountry(tpl.country)
        setFormQuestions(tpl.template_questions?.map(q => ({
            question_text: q.question_text,
            field_type: q.field_type,
            choices: q.choices && q.choices.length > 0 ? q.choices : [""]
        })) ?? [{ question_text: "", field_type: "text", choices: [""] }])
        setDeleteConfirmIndex(null)
        setShowSavePrompt(false)
        setTransactionError(null)
        setValidationErrors({ title: false, questions: [], choices: [], attempted: false })
    }

    if (loading) return <div className="text-sm p-6 text-navy/50 font-medium">Loading...</div>

    const formHasErrors = validationErrors.title || validationErrors.questions.length > 0 || validationErrors.choices.length > 0

    return (
        <div className="google-sans-registry grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Designer Workspace */}
            <div className="lg:col-span-2 bg-white rounded-md border border-stone p-4 sm:p-6 shadow-sm space-y-4">
                {transactionError && (
                    <div className="p-3 bg-rose-50/50 border border-rose-200 text-xs text-rose-700 rounded-md font-bold flex items-center gap-2">
                        <AlertCircleIcon className="size-4 shrink-0" />
                        <span>{transactionError}</span>
                    </div>
                )}

                <div className="flex items-center justify-between border-b border-stone pb-3">
                    <h2 className="text-base font-bold tracking-tight text-navy sm:text-lg">
                        {editingId ? `Edit Existing Form` : `Create an Intake Form`}
                    </h2>
                    {editingId && (
                        <button type="button" onClick={resetForm} className="text-xs text-navy/55 font-semibold flex items-center gap-1 hover:text-navy transition-colors cursor-pointer">
                            <XIcon className="size-3.5" /> Cancel Edit
                        </button>
                    )}
                </div>
                <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-medium leading-relaxed text-amber-700">
                    {t('settings.intake.englishOnlyHelp')}
                </p>

                <form onSubmit={(e) => { e.preventDefault(); validateAndTriggerPrompt(); }} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45 mb-1.5">
                                Form Title {validationErrors.title && <span className="text-rose-600 font-normal lowercase italic">(Required)</span>}
                            </label>
                            <input
                                type="text"
                                value={formTitle}
                                onChange={(e) => {
                                    setFormTitle(e.target.value)
                                    if (validationErrors.attempted && e.target.value.trim()) {
                                        setValidationErrors(prev => ({ ...prev, title: false }))
                                    }
                                }}
                                className={`font-semibold w-full rounded-md border bg-white px-3 py-2 text-xs outline-none transition-colors ${
                                    validationErrors.title ? "border-rose-500 bg-rose-50/20 text-rose-900 focus:border-rose-500" : "border-stone text-navy placeholder:text-navy/30 placeholder:font-normal focus:border-teal"
                                }`}
                                placeholder="e.g., 2026 Intake Form"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45 mb-1.5">Regional Scope</label>
                            <select
                                value={formCountry}
                                onChange={(e) => setFormCountry(e.target.value)}
                                className="w-full rounded-md border border-stone bg-white px-3 py-2 text-xs font-semibold text-navy outline-none focus:border-teal cursor-pointer"
                            >
                                <option value="all">Global (All Countries)</option>
                                {countries.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="hidden sm:grid sm:grid-cols-[2rem_1fr_12rem] gap-3 items-center px-1">
                            <div />
                            <label className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45">
                                Insert Questions ({formQuestions.length})
                            </label>
                            <label className="block text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45 pl-2">
                                Answer Type
                            </label>
                        </div>

                        {formQuestions.map((q, qIndex) => {
                            const isArmedForDelete = deleteConfirmIndex === qIndex
                            const hasTextError = validationErrors.questions.includes(qIndex)
                            const hasChoiceError = validationErrors.choices.includes(qIndex)
                            const isBeingDragged = draggedIndex === qIndex

                            return (
                                <div 
                                    key={qIndex}
                                    draggable
                                    onDragStart={() => handleDragStart(qIndex)}
                                    onDragOver={(e) => handleDragOver(e, qIndex)}
                                    onDragEnd={handleDragEnd}
                                    className={`p-3.5 rounded-md border space-y-3 relative transition-all group/card ${
                                        isBeingDragged ? "opacity-30 border-dashed border-teal bg-teal/5 scale-[0.99]" : ""
                                    } ${
                                        hasTextError || hasChoiceError 
                                            ? "bg-rose-50/30 border-rose-300" 
                                            : "bg-ice/50 border-stone hover:border-stone/80"
                                    }`}
                                >
                                    <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
                                        <div className="hidden sm:flex items-center justify-center text-navy/30 group-hover/card:text-navy/50 transition-colors cursor-grab active:cursor-grabbing p-1 shrink-0 -ml-1">
                                            <MoveIcon className="size-4" />
                                        </div>

                                        <div className="w-full sm:flex-1">
                                            <span className="sm:hidden block text-[10px] font-bold uppercase tracking-wider text-navy/40 mb-1">
                                                Question #{qIndex + 1}
                                            </span>
                                            <input
                                                type="text"
                                                value={q.question_text}
                                                onChange={(e) => handleQuestionChange(qIndex, "question_text", e.target.value)}
                                                className={`font-semibold w-full rounded-md border bg-white px-3 py-2 sm:py-1.5 text-xs text-navy outline-none transition-colors placeholder:text-navy/30 placeholder:font-normal ${
                                                    hasTextError ? "border-rose-400 focus:border-rose-500" : "border-stone focus:border-teal"
                                                }`}
                                                placeholder={`Prompt Text`}
                                            />
                                        </div>

                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <div className="flex-1 sm:w-48">
                                                <select
                                                    value={q.field_type}
                                                    onChange={(e) => handleQuestionChange(qIndex, "field_type", e.target.value as FieldTypeConstraint)}
                                                    className="w-full rounded-md border border-stone bg-white px-2.5 py-2 sm:py-1.5 text-xs font-semibold text-navy outline-none focus:border-teal cursor-pointer"
                                                >
                                                    <option value="text">Text Answer</option>
                                                    <option value="number">Number</option>
                                                    <option value="date">Date</option>
                                                    <option value="boolean">Yes / No</option>
                                                    <option value="select">Multiple Choice</option>
                                                </select>
                                            </div>

                                            {formQuestions.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveQuestionAttempt(qIndex)}
                                                    onMouseLeave={() => setDeleteConfirmIndex(null)}
                                                    className={`transition-all rounded-md px-3 py-2 sm:py-1.5 font-bold text-xs shrink-0 flex items-center gap-1 outline-none min-w-[70px] justify-center cursor-pointer ${
                                                        isArmedForDelete 
                                                        ? "bg-rose-700 text-white animate-pulse shadow-2xs" 
                                                        : "bg-white sm:bg-transparent border sm:border-transparent border-stone text-navy/60 hover:text-rose-700 hover:border-rose-200"
                                                    }`}
                                                    aria-label="Delete field row element"
                                                >
                                                    {isArmedForDelete ? (
                                                        <span>Confirm?</span>
                                                    ) : (
                                                        <>
                                                            <TrashIcon className="size-3.5" />
                                                            <span className="sm:hidden text-xs font-semibold">Remove</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {q.field_type === "select" && (
                                        <div className={`bg-white border rounded-md p-3 space-y-2.5 ${hasChoiceError ? 'border-rose-400' : 'border-stone'}`}>
                                            <span className={`block text-[10px] font-medium uppercase tracking-wide ${hasChoiceError ? 'text-rose-600 font-bold' : 'text-navy/55'}`}>
                                                Add Answer Choices: {hasChoiceError && <span className="lowercase font-normal italic">(Requires at least one non-empty value)</span>}
                                            </span>
                                            <div className="flex flex-col gap-2">
                                                {(q.choices || []).map((choice, cIndex) => (
                                                    <div key={cIndex} className="flex items-center gap-2 w-full min-w-0">
                                                        <div className="flex-1 min-w-0">
                                                            <input
                                                                type="text"
                                                                value={choice}
                                                                onChange={(e) => handleChoiceChange(qIndex, cIndex, e.target.value)}
                                                                className={`font-medium w-full rounded-md border px-3 py-1.5 text-xs text-navy outline-none focus:border-teal placeholder:text-navy/30 ${
                                                                    hasChoiceError && !choice.trim() ? "border-rose-300 bg-rose-50/20" : "border-stone"
                                                                }`}
                                                                placeholder={`Option #${cIndex + 1}`}
                                                            />
                                                        </div>
                                                        {(q.choices || []).length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveChoice(qIndex, cIndex)}
                                                                className="p-1.5 text-navy/35 hover:text-rose-600 cursor-pointer hover:bg-ice rounded transition-colors shrink-0"
                                                            >
                                                                <XIcon className="size-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleAddChoice(qIndex)}
                                                className="font-bold mt-1 text-[11px] text-teal hover:underline flex items-center gap-0.5 cursor-pointer inline-block"
                                            >
                                                + Add Option
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* 🌟 Footer Bar: Confirmation switches inline next to the execution track */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-stone pt-4">
                        <button
                            type="button"
                            disabled={showSavePrompt}
                            onClick={handleAddQuestion}
                            className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 text-xs font-bold text-navy hover:text-navy/80 bg-ice border border-stone px-3 py-2.5 sm:py-2 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <PlusIcon className="size-3.5 text-teal" /> Add Question
                        </button>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 w-full sm:w-auto">
                            {showSavePrompt ? (
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full bg-amber-50/40 border border-amber-200 rounded-md px-3 py-2 animate-fade-in">
                                    <span className="text-[11px] font-bold text-amber-800 text-center sm:text-left leading-tight">
                                        Apply configuration configurations systemwide?
                                    </span>
                                    <div className="flex items-center gap-2 w-full sm:w-auto justify-center shrink-0">
                                        <button 
                                            type="button" 
                                            onClick={executeSaveTransaction} 
                                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-md cursor-pointer transition-all shadow-3xs"
                                        >
                                            Confirm Save
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setShowSavePrompt(false)} 
                                            className="bg-white text-navy/65 border border-stone font-semibold text-xs px-3 py-1.5 rounded-md cursor-pointer hover:bg-ice"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                    {formHasErrors && (
                                        <span className="text-xs font-semibold text-rose-700 flex items-center justify-center gap-1 animate-fade-in">
                                            <AlertCircleIcon className="size-3.5 shrink-0" /> Missing setup
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={validateAndTriggerPrompt}
                                        className={`w-full sm:w-auto justify-center inline-flex items-center gap-1.5 text-white text-xs sm:text-sm font-bold px-5 py-2.5 sm:py-2 rounded-md transition-all shadow-2xs cursor-pointer ${
                                            formHasErrors 
                                                ? "bg-rose-700 hover:bg-rose-800" 
                                                : "bg-teal hover:bg-teal/90"
                                            }`}
                                    >
                                        <SaveIcon className="size-3.5" /> {editingId ? "Save Form Updates" : "Save and Deploy Form"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            {/* Historical Template Pool */}
            <div className="bg-white border border-stone rounded-md p-4 sm:p-5 space-y-4 shadow-sm">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45 border-b border-stone pb-2.5">
                    Active Templates Management Pool
                </h3>

                {templates.length === 0 ? (
                    <p className="text-xs text-navy/45 italic py-4 text-center font-medium">No custom intake models found.</p>
                ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                        {templates.map((tpl) => {
                            const isActive = tpl.status === 'active'
                            const isArmedForTemplateDelete = templateDeleteConfirmId === tpl.id

                            return (
                                <div key={tpl.id} className="bg-white border border-stone rounded-md p-4 flex flex-col justify-between gap-3 shadow-2xs hover:border-teal/60 transition-all">
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="text-sm font-bold tracking-tight text-navy truncate flex-1">{tpl.title}</h4>
                                            
                                            <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                                isActive ? "border-teal/50 bg-teal/10 text-teal" : "border-stone bg-ice text-navy/55"
                                            }`}>
                                                <span className={`size-1.5 rounded-full ${isActive ? "bg-teal" : "bg-navy/35"}`} aria-hidden="true" />
                                                {tpl.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-navy/65 mt-2 font-semibold truncate">
                                            <GlobeIcon className="size-3.5 text-teal shrink-0" />
                                            Scope: {tpl.country === 'all' ? 'Global' : tpl.country}
                                        </div>
                                        <p className="font-mono text-xs text-teal mt-1">{tpl.template_questions?.length || 0} fields configured</p>
                                    </div>

                                    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 border-t border-stone pt-2.5 mt-1">
                                        <button
                                            onClick={() => startEdit(tpl)}
                                            className="text-xs text-navy hover:text-teal font-bold inline-flex items-center gap-1 cursor-pointer transition-colors px-1"
                                        >
                                            <PencilIcon className="size-3 text-navy/60" /> Edit
                                        </button>
                                        <button
                                            onClick={() => handleToggleStatus(tpl.id, tpl.status)}
                                            className={`text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors px-1 ${isActive ? 'text-amber-700 hover:text-amber-900' : 'text-teal hover:text-teal/80'}`}
                                        >
                                            {isActive ? <ToggleLeftIcon className="size-3.5" /> : <ToggleRightIcon className="size-3.5" />}
                                            {isActive ? "Deactivate" : "Activate"}
                                        </button>
                                        <button
                                            onClick={() => handleTemplateDeleteAttempt(tpl.id)}
                                            onMouseLeave={() => setTemplateDeleteConfirmId(null)}
                                            className={`text-xs font-bold inline-flex items-center gap-1 transition-all rounded-md px-2 py-1 cursor-pointer ${
                                                isArmedForTemplateDelete 
                                                ? "bg-rose-700 text-white animate-pulse" 
                                                : "text-rose-700 hover:text-rose-900 hover:bg-rose-50"
                                            }`}
                                        >
                                            {isArmedForTemplateDelete ? (
                                                <span>Confirm?</span>
                                            ) : (
                                                <>
                                                    <TrashIcon className="size-3" /> Delete
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

        </div>
    )
}
