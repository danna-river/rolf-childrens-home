"use client"

import { useState, useEffect } from "react"
import { PlusIcon, TrashIcon, ToggleLeftIcon, ToggleRightIcon, PencilIcon, SaveIcon, XIcon, GlobeIcon, AlertCircleIcon } from "lucide-react"
import {
    getIntakeTemplates,
    createIntakeTemplate,
    updateIntakeTemplate,
    toggleTemplateStatus,
    deleteTemplate,
    getIntakeCountries
} from "../../actions/intake-actions"
import type { QuestionInput, IntakeTemplate } from "../intake-types"

export function IntakeView() {
    const [templates, setTemplates] = useState<IntakeTemplate[]>([])
    const [countries, setCountries] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    // Form Configuration States
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formTitle, setFormTitle] = useState("")
    const [formCountry, setFormCountry] = useState("all")
    const [formQuestions, setFormQuestions] = useState<QuestionInput[]>([
        { question_text: "", field_type: "text", choices: [""] }
    ])

    // Tracks individual question indices flagged for two-press deletion confirmation inside the designer
    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null)
    
    // Tracks individual template IDs flagged for two-press deletion confirmation in the pool
    const [templateDeleteConfirmId, setTemplateDeleteConfirmId] = useState<string | null>(null)

    // Visual Validation Error States
    const [validationErrors, setValidationErrors] = useState<{
        title: boolean;
        questions: number[]; // Array of question indices with missing text
        choices: number[];   // Array of question indices with missing multiple-choice options
        attempted: boolean;  // Tracks if user has attempted to submit at least once
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
        setDeleteConfirmIndex(null) // Reset delete arming state
    }

    // Two-press safety handler for inline question deletion
    const handleRemoveQuestionAttempt = (index: number) => {
        if (deleteConfirmIndex === index) {
            setFormQuestions(formQuestions.filter((_, i) => i !== index))
            setDeleteConfirmIndex(null)
            // Clear errors for this index and shift subsequent ones down
            setValidationErrors(prev => ({
                ...prev,
                questions: prev.questions.filter(i => i !== index).map(i => i > index ? i - 1 : i),
                choices: prev.choices.filter(i => i !== index).map(i => i > index ? i - 1 : i)
            }))
        } else {
            setDeleteConfirmIndex(index)
        }
    }

    const handleQuestionChange = (index: number, key: keyof QuestionInput, value: any) => {
        const updated = [...formQuestions]
        updated[index] = { ...updated[index], [key]: value } as QuestionInput
        setFormQuestions(updated)
        
        // Live clear errors on change
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

        // Live clear choice error if a valid string is typed
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

    const resetForm = () => {
        setEditingId(null)
        setFormTitle("")
        setFormCountry("all")
        setFormQuestions([{ question_text: "", field_type: "text", choices: [""] }])
        setDeleteConfirmIndex(null)
        setValidationErrors({ title: false, questions: [], choices: [], attempted: false })
    }

    // Explicit manual verification function called BEFORE standard submission routines
    const validateAndSaveForm = async () => {
        let hasErrors = false
        const newErrors = { title: false, questions: [] as number[], choices: [] as number[], attempted: true }

        // 1. Title Verification
        if (!formTitle.trim()) {
            newErrors.title = true
            hasErrors = true
        }

        // 2. Scan for empty text input prompt fields
        formQuestions.forEach((q, idx) => {
            if (!q.question_text.trim()) {
                newErrors.questions.push(idx)
                hasErrors = true
            }
        })

        // 3. Robust multiple choice check: Blocks execution if empty choices are populated
        formQuestions.forEach((q, idx) => {
            if (q.field_type === 'select') {
                const validOptions = q.choices?.filter(c => c && c.trim() !== '') || []
                // Total length is zero OR any single raw choice remains unpopulated
                if (validOptions.length === 0 || (q.choices && q.choices.some(c => !c.trim()))) {
                    newErrors.choices.push(idx)
                    hasErrors = true
                }
            }
        })

        setValidationErrors(newErrors)

        if (hasErrors) {
            alert("🚨 DEPLOYMENT BLOCKED: Please check the highlighted errors on the form workspace before deployment.")
            return
        }

        const promptText = editingId
            ? "Are you sure you want to save modifications to this template? Existing historical field metrics may shift downstream."
            : "Are you sure you want to deploy this dynamic intake format live systemwide?"

        if (!window.confirm(promptText)) return

        const res = editingId
            ? await updateIntakeTemplate(editingId, formTitle, formCountry, formQuestions)
            : await createIntakeTemplate(formTitle, formCountry, formQuestions)

        if (res.error) {
            alert(`Database Transaction Rejected:\n${res.error}`)
        } else {
            resetForm()
            const updated = await getIntakeTemplates()
            if (updated.data) setTemplates(updated.data)
        }
    }

    const handleToggleStatus = async (id: string, currentStatus: 'active' | 'inactive') => {
        const nextLabel = currentStatus === 'active' ? 'INACTIVE / ARCHIVED' : 'ACTIVE'
        if (!window.confirm(`Are you sure you want to modify this template's lifecycle mode to ${nextLabel}?`)) return
        await toggleTemplateStatus(id, currentStatus)
        const updated = await getIntakeTemplates()
        if (updated.data) setTemplates(updated.data)
    }

    // Two-press safety handler for persistent template list pool removal
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
        setValidationErrors({ title: false, questions: [], choices: [], attempted: false })
    }

    if (loading) return <div className="text-sm p-6 text-navy/50">Loading...</div>

    const formHasErrors = validationErrors.title || validationErrors.questions.length > 0 || validationErrors.choices.length > 0

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-1">

            {/* Dynamic Form Schema Designer Workspace */}
            <div className="lg:col-span-2 bg-white rounded-xl border p-6 shadow-sm">
                <div className="flex items-center justify-between border-b pb-4 mb-4">
                    <h2 className="text-lg font-bold text-navy">
                        {editingId ? `🛠️ Edit Existing Form` : `✨ Create an Intake Form`}
                    </h2>
                    {editingId && (
                        <button type="button" onClick={resetForm} className="text-xs text-navy/50 flex items-center gap-1 hover:text-navy">
                            <XIcon className="size-3.5" /> Cancel Edit
                        </button>
                    )}
                </div>

                {/* Changed onSubmit to execute validation explicitly on form level intercept requests */}
                <form onSubmit={(e) => { e.preventDefault(); validateAndSaveForm(); }} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-navy/60 uppercase tracking-wider mb-1">
                                Form Title {validationErrors.title && <span className="text-red-500 font-normal lowercase italic">(Required)</span>}
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
                                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition-colors ${
                                    validationErrors.title ? "border-red-500 bg-red-50/30 focus:border-red-500" : "border-stone focus:border-teal"
                                }`}
                                placeholder="e.g., 2026 Intake Form"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-navy/60 uppercase tracking-wider mb-1">Regional Scope</label>
                            <select
                                value={formCountry}
                                onChange={(e) => setFormCountry(e.target.value)}
                                className="w-full rounded-lg border border-stone bg-white px-3 py-2.5 text-sm outline-none focus:border-teal"
                            >
                                <option value="all">🌐 Global (All Countries)</option>
                                {countries.map((c) => (
                                    <option key={c} value={c}>📍 {c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Perfect Dynamic Grid Guideline Alignment */}
                        <div className="grid grid-cols-[1fr_12rem] gap-3 items-center mb-1">
                            <div>
                                <label className="block text-xs font-bold text-navy/60 uppercase tracking-wider">
                                    Insert Questions ({formQuestions.length})
                                </label>
                            </div>
                            <div style={{ paddingLeft: "20px" }}>
                                <label className="block text-xs font-bold text-navy/60 uppercase tracking-wider">
                                    Answer Type
                                </label>
                            </div>
                        </div>

                        {formQuestions.map((q, qIndex) => {
                            const isArmedForDelete = deleteConfirmIndex === qIndex
                            const hasTextError = validationErrors.questions.includes(qIndex)
                            const hasChoiceError = validationErrors.choices.includes(qIndex)

                            return (
                                <div 
                                    key={qIndex} 
                                    className={`p-4 rounded-xl border space-y-3 relative transition-all ${
                                        hasTextError || hasChoiceError 
                                            ? "bg-red-50/40 border-red-300" 
                                            : "bg-sky/20 border-stone"
                                    }`}
                                >
                                    <div className="flex gap-3 items-center">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={q.question_text}
                                                onChange={(e) => handleQuestionChange(qIndex, "question_text", e.target.value)}
                                                className={`w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors ${
                                                    hasTextError ? "border-red-400 focus:border-red-500" : "focus:border-teal"
                                                }`}
                                                placeholder={`Question #${qIndex + 1}`}
                                            />
                                        </div>
                                        <div className="w-48">
                                            <select
                                                value={q.field_type}
                                                onChange={(e) => handleQuestionChange(qIndex, "field_type", e.target.value as any)}
                                                className="w-full rounded-md border bg-white px-2 py-2 text-sm outline-none focus:border-teal"
                                            >
                                                <option value="text">Text</option>
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
                                                onMouseLeave={() => setDeleteConfirmIndex(null)} // Reset status if focus shifts
                                                className={`transition-all rounded px-2 py-1.5 font-bold text-xs shrink-0 flex items-center gap-1 h-9 outline-none min-w-[70px] justify-center ${
                                                    isArmedForDelete 
                                                    ? "bg-red-600 text-white animate-pulse shadow-sm px-2.5" 
                                                    : "text-navy/40 hover:text-red-600 bg-transparent"
                                                }`}
                                                aria-label="Delete field row element"
                                            >
                                                {isArmedForDelete ? (
                                                    <span>Confirm?</span>
                                                ) : (
                                                    <TrashIcon className="size-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Dynamic Category Option Tag Inputs Row Builder */}
                                    {q.field_type === "select" && (
                                        <div className={`bg-white border rounded-lg p-3 ml-2 space-y-2 ${hasChoiceError ? 'border-red-400' : 'border-stone'}`}>
                                            <span className={`block text-[10px] font-bold uppercase tracking-wide ${hasChoiceError ? 'text-red-500' : 'text-navy/50'}`}>
                                                Add Answer Choices: {hasChoiceError && <span className="lowercase font-normal italic">(Requires at least one non-empty value)</span>}
                                            </span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {(q.choices || []).map((choice, cIndex) => (
                                                    <div key={cIndex} className="flex gap-1.5 items-center">
                                                        <input
                                                            type="text"
                                                            value={choice}
                                                            onChange={(e) => handleChoiceChange(qIndex, cIndex, e.target.value)}
                                                            className={`flex-1 rounded border px-2 py-1 text-xs outline-none focus:border-teal ${
                                                                hasChoiceError && !choice.trim() ? "border-red-300 bg-red-50/20" : "border-stone"
                                                            }`}
                                                            placeholder="Option (e.g. Excellent)"
                                                        />
                                                        {(q.choices || []).length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveChoice(qIndex, cIndex)}
                                                                className="text-navy/30 hover:text-red-500"
                                                            >
                                                                <XIcon className="size-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleAddChoice(qIndex)}
                                                className="mt-1 text-[11px] font-bold text-teal hover:underline flex items-center gap-0.5"
                                            >
                                                + Add Option
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex items-center justify-between border-t border-stone pt-4">
                        <button
                            type="button"
                            onClick={handleAddQuestion}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:text-teal/80 bg-sky px-3 py-2 rounded-lg"
                        >
                            <PlusIcon className="size-3.5" /> Add Question
                        </button>
                        
                        <div className="flex items-center gap-3">
                            {formHasErrors && (
                                <span className="text-xs font-medium text-red-600 flex items-center gap-1 animate-fade-in">
                                    <AlertCircleIcon className="size-3.5 shrink-0" /> Missing required setup
                                </span>
                            )}
                            {/* Changed type strictly to button to bypass HTML5 semantic blocks and hit validateAndSaveForm manually */}
                            <button
                                type="button"
                                onClick={validateAndSaveForm}
                                className={`inline-flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-sm ${
                                    formHasErrors 
                                        ? "bg-red-500 hover:bg-red-600" 
                                        : "bg-teal hover:bg-teal/90"
                                    }`}
                            >
                                <SaveIcon className="size-4" /> {editingId ? "Save Form Updates" : "Save and Deploy Form"}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* Historical Template Index Pipeline */}
            <div className="bg-white border rounded-xl p-4 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-navy/50 tracking-wider uppercase">Active Templates Management Pool</h3>

                {templates.length === 0 ? (
                    <p className="text-xs text-navy/40 italic">No custom intake models found.</p>
                ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                        {templates.map((tpl) => {
                            const isActive = tpl.status === 'active'
                            const isArmedForTemplateDelete = templateDeleteConfirmId === tpl.id

                            return (
                                <div key={tpl.id} className="bg-ice border border-stone rounded-lg p-3.5 flex flex-col justify-between gap-3">
                                    <div>
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="font-bold text-sm text-navy truncate flex-1">{tpl.title}</h4>
                                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-stone text-navy/60'}`}>
                                                {tpl.status}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-navy/60 mt-1.5 font-medium">
                                            <GlobeIcon className="size-3.5 text-teal" />
                                            Scope: {tpl.country === 'all' ? 'Global' : tpl.country}
                                        </div>
                                        <p className="text-xs text-navy/40 mt-1 font-mono">{tpl.template_questions?.length || 0} fields configured</p>
                                    </div>

                                    <div className="flex items-center justify-end gap-3 border-t border-stone pt-2.5 mt-1">
                                        <button
                                            onClick={() => startEdit(tpl)}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                                        >
                                            <PencilIcon className="size-3" /> Edit
                                        </button>
                                        <button
                                            onClick={() => handleToggleStatus(tpl.id, tpl.status)}
                                            className={`text-xs font-semibold inline-flex items-center gap-1 ${isActive ? 'text-amber-600 hover:text-amber-800' : 'text-green-600 hover:text-green-800'}`}
                                        >
                                            {isActive ? <ToggleLeftIcon className="size-3.5" /> : <ToggleRightIcon className="size-3.5" />}
                                            {isActive ? "Deactivate" : "Activate"}
                                        </button>
                                        <button
                                            onClick={() => handleTemplateDeleteAttempt(tpl.id)}
                                            onMouseLeave={() => setTemplateDeleteConfirmId(null)} // Reset if mouse drifts away
                                            className={`text-xs font-semibold inline-flex items-center gap-1 transition-all rounded px-1.5 py-0.5 ${
                                                isArmedForTemplateDelete 
                                                ? "bg-red-600 text-white font-bold animate-pulse px-2" 
                                                : "text-red-500 hover:text-red-700"
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