"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  Clock3Icon,
  LockIcon,
  MailCheckIcon,
  MessageSquareReplyIcon,
  SaveIcon,
  SendIcon,
  StickyNoteIcon,
  TruckIcon,
  XCircleIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  approvePenPalLetter,
  rejectPenPalLetter,
  markPenPalDelivered,
  submitChildReply,
  addPenPalStaffNote,
  closePenPalThread,
} from '../actions'
import { MAX_LETTER_CHARS } from '@/lib/penpal'
import type { PenPalDirection, PenPalMessageStatus } from '@/lib/types'

const STATUS_LABEL: Record<PenPalMessageStatus, string> = {
  submitted: 'Needs review',
  under_review: 'Needs review',
  approved: 'Approved',
  delivered: 'Delivered',
  published: 'Published to donor',
  rejected: 'Rejected',
}

const STATUS_CHIP: Record<PenPalMessageStatus, string> = {
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-teal/10 text-teal border-teal/30',
  delivered: 'bg-sky/35 text-navy border-sky',
  published: 'bg-teal/10 text-teal border-teal/30',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}

const STATUS_ICON: Record<PenPalMessageStatus, LucideIcon> = {
  submitted: Clock3Icon,
  under_review: Clock3Icon,
  approved: CheckCircle2Icon,
  delivered: MailCheckIcon,
  published: MessageSquareReplyIcon,
  rejected: XCircleIcon,
}

type Panel = 'reject' | 'reply' | 'note' | 'close'

interface ReviewCardProps {
  messageId: string
  threadId: string
  direction: PenPalDirection
  status: PenPalMessageStatus
  rawBody: string
  approvedBody: string | null
  rejectionReason: string | null
  threadClosed: boolean
  isAdmin: boolean
  showThreadActions?: boolean
  threadHref?: string
}

export function ReviewCard({
  messageId, threadId, direction, status, rawBody, approvedBody,
  rejectionReason, threadClosed, isAdmin, showThreadActions = true, threadHref,
}: ReviewCardProps) {
  const router = useRouter()
  const [editedBody, setEditedBody] = useState(approvedBody ?? rawBody)
  const [openPanel, setOpenPanel] = useState<null | Panel>(null)
  const [panelText, setPanelText] = useState('')
  const [dictated, setDictated] = useState(false)
  const [translated, setTranslated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const needsReview = direction === 'donor_to_child' && (status === 'submitted' || status === 'under_review')

  const run = async (fn: () => Promise<{ error?: string; success?: boolean }>, successMsg: string) => {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const result = await fn()
      if (result?.error) {
        setError(result.error)
      } else {
        setDone(successMsg)
        setOpenPanel(null)
        setPanelText('')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.')
    } finally {
      setBusy(false)
    }
  }

  const panelButton = (panel: Panel, label: string, Icon: LucideIcon, cls: string) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setOpenPanel(openPanel === panel ? null : panel)
        setPanelText('')
        setError(null)
        setDone(null)
      }}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-40 ${cls}`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  )

  const StatusIcon = STATUS_ICON[status]
  const reviewCharsLeft = MAX_LETTER_CHARS - editedBody.length
  const visibleBody = approvedBody ?? rawBody

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${STATUS_CHIP[status]}`}>
          <StatusIcon className="size-3.5" aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
        {threadClosed && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-navy/20 bg-navy/5 px-3 py-1 text-xs font-bold text-navy/60">
            <LockIcon className="size-3.5" aria-hidden="true" />
            Thread closed
          </span>
        )}
      </div>

      {needsReview ? (
        <div className="overflow-hidden rounded-2xl border border-stone bg-ice">
          <div className="flex flex-col gap-2 border-b border-stone bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Review copy</p>
              <p className="mt-0.5 text-sm font-semibold text-navy/60">
                Edit the donor&apos;s text before approving if needed.
              </p>
            </div>
            <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
              reviewCharsLeft <= 100
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-stone bg-ice text-navy/50'
            }`}>
              {reviewCharsLeft} left
            </span>
          </div>
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={5}
            maxLength={MAX_LETTER_CHARS}
            className="block min-h-40 w-full resize-y border-0 bg-ice px-4 py-3 text-sm leading-7 text-navy outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-teal/25"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-stone bg-ice px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-7 text-navy">{visibleBody}</p>
        </div>
      )}

      {status === 'rejected' && rejectionReason && (
        <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>Reason: {rejectionReason}</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-700">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
      {done && (
        <div className="flex items-start gap-2 rounded-xl border border-teal/30 bg-teal/10 px-3 py-2 text-xs font-semibold leading-5 text-teal">
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{done}</p>
        </div>
      )}

      {!done && (
        <div className="flex flex-wrap gap-2 border-t border-stone pt-4">
          {needsReview && (
            <>
              <button
                type="button"
                disabled={busy || !editedBody.trim()}
                onClick={() => run(() => approvePenPalLetter(messageId, editedBody), 'Letter approved.')}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-xs font-bold text-white transition-colors hover:bg-navy/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-40"
              >
                <CheckCircle2Icon className="size-4" aria-hidden="true" />
                {busy ? 'Working...' : 'Approve'}
              </button>
              {panelButton('reject', 'Reject', XCircleIcon, 'border-red-200 bg-white text-red-600 hover:bg-red-50')}
            </>
          )}
          {direction === 'donor_to_child' && status === 'approved' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => markPenPalDelivered(messageId), 'Marked as delivered to the child.')}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-teal px-4 text-xs font-bold text-white transition-colors hover:bg-teal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:opacity-40"
            >
              <TruckIcon className="size-4" aria-hidden="true" />
              Mark Delivered
            </button>
          )}
          {!threadClosed && direction === 'donor_to_child' && status === 'delivered' && (
            threadHref ? (
              <Link
                href={threadHref}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-teal/40 bg-white px-3 text-xs font-bold text-teal transition-colors hover:bg-teal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                <MessageSquareReplyIcon className="size-4" aria-hidden="true" />
                Open Chat to Reply
                <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
              </Link>
            ) : (
              panelButton('reply', 'Write Child Reply', MessageSquareReplyIcon, 'border-teal/40 bg-white text-teal hover:bg-teal/5')
            )
          )}
          {showThreadActions && panelButton('note', 'Staff Note', StickyNoteIcon, 'border-stone bg-white text-navy/60 hover:border-teal hover:text-navy')}
          {showThreadActions && isAdmin && !threadClosed && panelButton('close', 'Close Thread', LockIcon, 'border-stone bg-white text-navy/60 hover:border-red-300 hover:text-red-600')}
        </div>
      )}

      {openPanel === 'reject' && (
        <div className="space-y-3 rounded-2xl border border-red-100 bg-red-50/60 p-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-700">
            <XCircleIcon className="size-4" aria-hidden="true" />
            Reject letter
          </label>
          <textarea
            value={panelText}
            onChange={(e) => setPanelText(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Internal reason, not shown to the donor verbatim..."
            className="w-full rounded-xl border border-red-100 bg-white px-3 py-2 text-sm leading-6 text-navy outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => rejectPenPalLetter(messageId, panelText), 'Letter rejected.')}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40"
          >
            <XCircleIcon className="size-4" aria-hidden="true" />
            Confirm Reject
          </button>
        </div>
      )}

      {openPanel === 'reply' && (
        <div className="space-y-3 rounded-2xl border border-teal/30 bg-teal/5 p-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-teal">
            <MessageSquareReplyIcon className="size-4" aria-hidden="true" />
            Child reply
          </label>
          <textarea
            value={panelText}
            onChange={(e) => setPanelText(e.target.value)}
            rows={4}
            maxLength={MAX_LETTER_CHARS}
            placeholder="Child's reply to the donor..."
            className="w-full rounded-xl border border-teal/20 bg-white px-3 py-2 text-sm leading-6 text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
          />
          <div className="flex flex-wrap gap-4 text-xs font-medium text-navy/70">
            <label className="flex min-h-8 items-center gap-2 rounded-lg bg-white/70 px-2.5">
              <input type="checkbox" checked={dictated} onChange={(e) => setDictated(e.target.checked)} className="accent-teal" />
              Reply dictated by child
            </label>
            <label className="flex min-h-8 items-center gap-2 rounded-lg bg-white/70 px-2.5">
              <input type="checkbox" checked={translated} onChange={(e) => setTranslated(e.target.checked)} className="accent-teal" />
              Translated by staff
            </label>
          </div>
          <button
            type="button"
            disabled={busy || !panelText.trim()}
            onClick={() =>
              run(
                () => submitChildReply(threadId, panelText, { dictatedByChild: dictated, translatedByStaff: translated }),
                'Reply published to the donor.',
              )
            }
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-teal px-4 text-xs font-bold text-white hover:bg-teal/90 disabled:opacity-40"
          >
            <SendIcon className="size-4" aria-hidden="true" />
            Publish to Donor
          </button>
        </div>
      )}

      {openPanel === 'note' && (
        <div className="space-y-3 rounded-2xl border border-stone bg-ice p-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-navy/55">
            <StickyNoteIcon className="size-4 text-teal" aria-hidden="true" />
            Staff note
          </label>
          <textarea
            value={panelText}
            onChange={(e) => setPanelText(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Private staff note, never visible to donors..."
            className="w-full rounded-xl border border-stone bg-white px-3 py-2 text-sm leading-6 text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
          />
          <button
            type="button"
            disabled={busy || !panelText.trim()}
            onClick={() => run(() => addPenPalStaffNote(threadId, panelText), 'Note saved.')}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-xs font-bold text-white hover:bg-navy/90 disabled:opacity-40"
          >
            <SaveIcon className="size-4" aria-hidden="true" />
            Save Note
          </button>
        </div>
      )}

      {openPanel === 'close' && (
        <div className="space-y-3 rounded-2xl border border-red-100 bg-red-50/60 p-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-red-700">
            <LockIcon className="size-4" aria-hidden="true" />
            Close thread
          </label>
          <textarea
            value={panelText}
            onChange={(e) => setPanelText(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Reason for closing this thread..."
            className="w-full rounded-xl border border-red-100 bg-white px-3 py-2 text-sm leading-6 text-navy outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
          />
          <button
            type="button"
            disabled={busy || !panelText.trim()}
            onClick={() => run(() => closePenPalThread(threadId, panelText), 'Thread closed.')}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40"
          >
            <LockIcon className="size-4" aria-hidden="true" />
            Confirm Close
          </button>
        </div>
      )}
    </div>
  )
}
