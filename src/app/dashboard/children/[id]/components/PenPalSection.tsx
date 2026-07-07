"use client"

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2Icon, Clock3Icon, MailIcon, PenLineIcon, SendIcon, ShieldCheckIcon } from 'lucide-react'
import {
  getDonorLetters,
  submitPenPalLetter,
  type DonorLetter,
} from '@/app/dashboard/letters/actions'
import { MAX_LETTER_CHARS } from '@/lib/penpal'

const STATUS_LABEL: Record<DonorLetter['status'], string> = {
  in_review: 'In review',
  delivered: 'Delivered',
  not_shared: 'Not shared',
}

const STATUS_CHIP: Record<DonorLetter['status'], string> = {
  in_review: 'bg-[#fff6df] text-[#8a5c00] border-[#eed99e]',
  delivered: 'bg-teal/10 text-teal border-teal/30',
  not_shared: 'bg-[#f1ece4] text-[#7a6d5d] border-[#e1d6c7]',
}

const STATUS_ICON: Record<DonorLetter['status'], typeof Clock3Icon> = {
  in_review: Clock3Icon,
  delivered: CheckCircle2Icon,
  not_shared: ShieldCheckIcon,
}

function letterDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

export function PenPalSection({ childId, childName }: { childId: string; childName: string }) {
  const [letters, setLetters] = useState<DonorLetter[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const refresh = useCallback(async () => {
    const { letters: rows } = await getDonorLetters(childId)
    setLetters(rows)
    setLoading(false)
  }, [childId])

  useEffect(() => {
    let cancelled = false

    void getDonorLetters(childId).then(({ letters: rows }) => {
      if (cancelled) return
      setLetters(rows)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [childId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!draft.trim()) return
    setSubmitting(true)
    const result = await submitPenPalLetter(childId, draft)
    setSubmitting(false)
    if (result?.error) {
      setError(result.error)
      return
    }
    setDraft('')
    setComposing(false)
    setSubmitted(true)
    refresh()
  }

  const remainingChars = MAX_LETTER_CHARS - draft.length

  return (
    <section className="border-t border-[#eadfd0] pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-teal">
            <MailIcon className="size-4" aria-hidden="true" />
            Pen Pal Letters
          </p>
          <h2 className="mt-3 font-serif text-3xl font-bold leading-tight text-[#241b16] sm:text-4xl">
            Write to {childName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#7a6d5d]">
            ROLF staff reviews each letter before it is shared with a child.
          </p>
          {!composing && (
            <button
              type="button"
              onClick={() => { setComposing(true); setSubmitted(false) }}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#241b16] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3a2d23] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
            >
              <PenLineIcon className="size-4" aria-hidden="true" />
              Write Letter
            </button>
          )}
        </div>
      </div>

      {submitted && (
        <div className="mt-5 flex gap-3 rounded-[1.25rem] border border-teal/30 bg-teal/10 px-4 py-3 text-sm font-semibold leading-6 text-teal">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>Your letter has been submitted for staff review.</p>
        </div>
      )}

      {composing && (
        <form onSubmit={handleSubmit} className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#eadfd0] bg-[#fffaf2] shadow-[0_16px_40px_rgba(36,27,22,0.07)]">
          <div className="border-b border-[#eadfd0] bg-[#f6f1e8] px-4 py-3 sm:px-5">
            <label htmlFor="pen-pal-letter" className="text-sm font-bold text-[#241b16]">
              Letter to {childName}
            </label>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            <textarea
              id="pen-pal-letter"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              maxLength={MAX_LETTER_CHARS}
              placeholder={`Write your letter to ${childName}...`}
              className="min-h-44 w-full resize-y rounded-[1.25rem] border border-[#e1d6c7] bg-[#fffdf8] px-4 py-3 font-serif text-lg leading-8 text-[#2d241d] outline-none transition-all placeholder:text-[#9b8e7d] focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
            />
            <div className="flex flex-col gap-3 text-xs font-semibold leading-5 text-[#7a6d5d] sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-2">
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden="true" />
                <p>
                  Please avoid contact information, addresses, phone numbers, social media
                  handles, or private family details.
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1 font-bold ${
                remainingChars <= 100
                  ? 'border-amber-200 bg-[#fff6df] text-[#8a5c00]'
                  : 'border-[#e1d6c7] bg-white/70 text-[#7a6d5d]'
              }`}>
                {remainingChars} left
              </span>
            </div>
            {error && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => { setComposing(false); setError(null) }}
                className="rounded-full border border-[#e1d6c7] bg-white/70 px-5 py-2.5 text-sm font-bold text-[#7a6d5d] transition-colors hover:text-[#241b16] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !draft.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-teal px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SendIcon className="size-4" aria-hidden="true" />
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="mt-7 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-teal">
            Letter History
          </h3>
          {!loading && letters.length > 0 && (
            <span className="text-xs font-bold text-[#7a6d5d]">
              {letters.length} {letters.length === 1 ? 'letter' : 'letters'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="rounded-[1.25rem] border border-[#eadfd0] bg-[#fffdf8] px-4 py-5 text-sm font-semibold text-[#7a6d5d]">
            Loading letters...
          </div>
        ) : letters.length === 0 ? (
          !composing && (
            <div className="rounded-[1.5rem] border border-dashed border-[#d9ccbc] bg-[#fffdf8] px-5 py-7 text-center">
              <p className="font-serif text-2xl font-bold text-[#241b16]">
                No letters yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-[#7a6d5d]">
                When you send a letter, its review status and replies will appear here.
              </p>
            </div>
          )
        ) : (
          <ul className="space-y-3">
            {letters.map((letter) => {
              const StatusIcon = STATUS_ICON[letter.status]
              return (
                <li
                  key={letter.id}
                  className={`rounded-[1.25rem] border px-4 py-4 ${
                    letter.direction === 'received'
                      ? 'border-teal/25 bg-[#edf8f5]'
                      : 'border-[#eadfd0] bg-[#fffdf8]'
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold text-[#7a6d5d]">
                    <span className="text-[#241b16]">
                      {letter.direction === 'received' ? `From ${childName}` : 'You wrote'}
                    </span>
                    <span>{letterDate(letter.createdAt)}</span>
                    {letter.direction === 'sent' && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${STATUS_CHIP[letter.status]}`}>
                        <StatusIcon className="size-3" aria-hidden="true" />
                        {STATUS_LABEL[letter.status]}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap font-serif text-lg leading-8 text-[#2d241d]">
                    {letter.body}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
