"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LockIcon,
  MessageSquareReplyIcon,
  SaveIcon,
  SendIcon,
  StickyNoteIcon,
  TruckIcon,
  XCircleIcon,
} from 'lucide-react'
import {
  addPenPalStaffNote,
  approvePenPalLetter,
  closePenPalThread,
  markPenPalDelivered,
  rejectPenPalLetter,
  submitChildReply,
} from '../actions'
import { MAX_LETTER_CHARS } from '@/lib/penpal'
import type { PenPalDirection, PenPalMessageStatus } from '@/lib/types'

type ThreadActionMessage = {
  id: string
  direction: PenPalDirection
  status: PenPalMessageStatus
  raw_body: string
  approved_body: string | null
}

type ActionResult = { error?: string; success?: boolean }

export function ThreadActionPanel({
  threadId,
  latestMessage,
  threadClosed,
  isAdmin,
  childName,
}: {
  threadId: string
  latestMessage: ThreadActionMessage | null
  threadClosed: boolean
  isAdmin: boolean
  childName: string
}) {
  const router = useRouter()
  const [approvedText, setApprovedText] = useState(latestMessage?.approved_body ?? latestMessage?.raw_body ?? '')
  const [rejectReason, setRejectReason] = useState('')
  const [replyText, setReplyText] = useState('')
  const [noteText, setNoteText] = useState('')
  const [closeReason, setCloseReason] = useState('')
  const [dictated, setDictated] = useState(false)
  const [translated, setTranslated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const run = async (fn: () => Promise<ActionResult>, successMessage: string) => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const result = await fn()
      if (result?.error) {
        setError(result.error)
      } else {
        setDone(successMessage)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  const isDonorMessage = latestMessage?.direction === 'donor_to_child'
  const needsReview = isDonorMessage && (latestMessage.status === 'submitted' || latestMessage.status === 'under_review')
  const readyToDeliver = isDonorMessage && latestMessage.status === 'approved'
  const readyForReply = isDonorMessage && latestMessage.status === 'delivered'
  const replyCharsLeft = MAX_LETTER_CHARS - replyText.length
  const reviewCharsLeft = MAX_LETTER_CHARS - approvedText.length

  if (threadClosed) {
    return (
      <section className="rounded-2xl border border-stone bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-navy/55">
            <LockIcon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-navy">Thread closed</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-navy/55">
              No more letters or replies can be added to this thread.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-teal/25 bg-white shadow-sm">
      <div className="border-b border-stone px-4 py-3 sm:px-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">Next step</p>
        <h2 className="mt-1 text-lg font-bold text-navy">
          {needsReview && 'Review this donor letter'}
          {readyToDeliver && `Deliver this letter to ${childName}`}
          {readyForReply && `Write ${childName}'s reply`}
          {!latestMessage && 'Waiting for the first letter'}
          {latestMessage?.direction === 'child_to_donor' && 'Reply published to donor'}
          {latestMessage?.status === 'rejected' && 'Letter was not shared'}
        </h2>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold leading-6 text-red-700">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}
        {done && (
          <div className="flex items-start gap-2 rounded-xl border border-teal/30 bg-teal/10 px-3 py-2 text-sm font-semibold leading-6 text-teal">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>{done}</p>
          </div>
        )}

        {needsReview && latestMessage && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-stone bg-ice">
              <div className="flex flex-col gap-2 border-b border-stone bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-navy">Approved text</p>
                <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
                  reviewCharsLeft <= 100
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-stone bg-ice text-navy/50'
                }`}>
                  {reviewCharsLeft} left
                </span>
              </div>
              <textarea
                value={approvedText}
                onChange={(event) => setApprovedText(event.target.value)}
                rows={6}
                maxLength={MAX_LETTER_CHARS}
                className="block min-h-40 w-full resize-y border-0 bg-ice px-4 py-3 text-sm leading-7 text-navy outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-teal/25"
              />
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Optional rejection reason for internal records..."
                className="w-full rounded-xl border border-stone bg-white px-3 py-2 text-sm leading-6 text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
              />
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <button
                  type="button"
                  disabled={busy || !approvedText.trim()}
                  onClick={() => run(() => approvePenPalLetter(latestMessage.id, approvedText), 'Letter approved.')}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-xs font-bold text-white transition-colors hover:bg-navy/90 disabled:opacity-40"
                >
                  <CheckCircle2Icon className="size-4" aria-hidden="true" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => rejectPenPalLetter(latestMessage.id, rejectReason), 'Letter rejected.')}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                >
                  <XCircleIcon className="size-4" aria-hidden="true" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

        {readyToDeliver && latestMessage && (
          <div className="rounded-2xl border border-teal/25 bg-teal/5 p-4">
            <p className="text-sm font-semibold leading-6 text-navy/65">
              The donor letter is approved. Mark it delivered after staff shares it with the child.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => markPenPalDelivered(latestMessage.id), 'Marked as delivered to the child.')}
              className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal px-4 text-sm font-bold text-white transition-colors hover:bg-teal/90 disabled:opacity-40"
            >
              <TruckIcon className="size-4" aria-hidden="true" />
              Mark Delivered to Child
            </button>
          </div>
        )}

        {readyForReply && (
          <div className="space-y-3 rounded-2xl border border-teal/30 bg-teal/5 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-teal">
              <MessageSquareReplyIcon className="size-5" aria-hidden="true" />
              Child reply composer
            </div>
            <p className="rounded-xl border border-teal/20 bg-white/80 px-3 py-2 text-sm font-semibold leading-6 text-navy/65">
              Please write the child&apos;s reply in English before publishing.
            </p>
            <textarea
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              rows={6}
              maxLength={MAX_LETTER_CHARS}
              placeholder={`Write ${childName}'s reply to the donor...`}
              className="w-full rounded-xl border border-teal/20 bg-white px-4 py-3 text-sm leading-7 text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-3 text-xs font-semibold text-navy/70">
                <label className="flex min-h-8 items-center gap-2 rounded-lg bg-white/70 px-2.5">
                  <input type="checkbox" checked={dictated} onChange={(event) => setDictated(event.target.checked)} className="accent-teal" />
                  Dictated by child
                </label>
                <label className="flex min-h-8 items-center gap-2 rounded-lg bg-white/70 px-2.5">
                  <input type="checkbox" checked={translated} onChange={(event) => setTranslated(event.target.checked)} className="accent-teal" />
                  Translated by staff
                </label>
              </div>
              <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
                replyCharsLeft <= 100
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-teal/20 bg-white/70 text-navy/50'
              }`}>
                {replyCharsLeft} left
              </span>
            </div>
            <button
              type="button"
              disabled={busy || !replyText.trim()}
              onClick={() =>
                run(
                  () => submitChildReply(threadId, replyText, { dictatedByChild: dictated, translatedByStaff: translated }),
                  'Reply published to the donor.',
                )
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal px-4 text-sm font-bold text-white transition-colors hover:bg-teal/90 disabled:opacity-40"
            >
              <SendIcon className="size-4" aria-hidden="true" />
              Publish Reply to Donor
            </button>
          </div>
        )}

        {latestMessage?.direction === 'child_to_donor' && (
          <p className="rounded-2xl border border-stone bg-ice px-4 py-3 text-sm font-semibold leading-6 text-navy/60">
            The latest child reply has been published. This thread is waiting for the donor&apos;s next letter.
          </p>
        )}

        {latestMessage?.status === 'rejected' && (
          <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
            This donor letter was rejected and was not shared with the child.
          </p>
        )}

        <details className="rounded-2xl border border-stone bg-ice p-3">
          <summary className="cursor-pointer text-sm font-bold text-navy/65">Thread tools</summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-navy/55">
                <StickyNoteIcon className="size-4 text-teal" aria-hidden="true" />
                Staff note
              </label>
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Private staff note..."
                className="w-full rounded-xl border border-stone bg-white px-3 py-2 text-sm leading-6 text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
              />
              <button
                type="button"
                disabled={busy || !noteText.trim()}
                onClick={() => run(() => addPenPalStaffNote(threadId, noteText), 'Note saved.')}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-xs font-bold text-white hover:bg-navy/90 disabled:opacity-40"
              >
                <SaveIcon className="size-4" aria-hidden="true" />
                Save Note
              </button>
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-700">
                  <LockIcon className="size-4" aria-hidden="true" />
                  Close thread
                </label>
                <textarea
                  value={closeReason}
                  onChange={(event) => setCloseReason(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Reason for closing this thread..."
                  className="w-full rounded-xl border border-red-100 bg-white px-3 py-2 text-sm leading-6 text-navy outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
                />
                <button
                  type="button"
                  disabled={busy || !closeReason.trim()}
                  onClick={() => run(() => closePenPalThread(threadId, closeReason), 'Thread closed.')}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  <LockIcon className="size-4" aria-hidden="true" />
                  Close Thread
                </button>
              </div>
            )}
          </div>
        </details>
      </div>
    </section>
  )
}
