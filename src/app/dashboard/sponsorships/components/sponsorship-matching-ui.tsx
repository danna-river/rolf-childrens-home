// Small presentational pieces shared across the matching screen — metric cards,
// status banners, section headings, filter buttons, empty states, and pagination.
// They hold no business logic; the sections wire them together.
import type { ReactNode } from 'react'
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  SearchIcon,
  UsersIcon,
} from 'lucide-react'
import type { Sponsor } from '@/lib/types'
import type { PageSize } from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'
import { pageSizeOptions } from '@/app/dashboard/sponsorships/components/sponsorship-matching-types'
import {
  contactTypeLabel,
  pageCountFor,
} from '@/app/dashboard/sponsorships/components/sponsorship-matching-utils'

type IconComponent = typeof UsersIcon

export function Metric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: IconComponent
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-stone bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-semibold text-navy/60">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-navy">{value}</p>
          <p className="mt-1 truncate text-base text-navy/50">{helper}</p>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky/65 text-teal">
          <Icon className="size-6" aria-hidden="true" />
        </span>
      </div>
    </div>
  )
}

export function StatusMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success'
  children: ReactNode
}) {
  const Icon = tone === 'error' ? AlertCircleIcon : CheckCircle2Icon
  const toneClass = tone === 'error'
    ? 'border-red-100 bg-red-50 text-red-700'
    : 'border-emerald-100 bg-emerald-50 text-emerald-700'

  return (
    <div className={`flex items-start gap-2 rounded-2xl border p-4 text-base leading-6 motion-safe:duration-150 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 ${toneClass}`}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="min-w-0">{children}</p>
    </div>
  )
}

export function SectionHeading({
  icon: Icon,
  title,
  meta,
}: {
  icon: IconComponent
  title: string
  meta: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-ice text-teal ring-1 ring-stone">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-navy">{title}</h2>
        <p className="truncate text-base text-navy/55">{meta}</p>
      </div>
    </div>
  )
}

export function ContactMatchBadge({ sponsor }: { sponsor: Sponsor | null }) {
  if (!sponsor) {
    return (
      <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone bg-white px-4 text-base font-semibold text-navy/60">
        <SearchIcon className="size-4 text-teal" aria-hidden="true" />
        New or unmatched email
      </span>
    )
  }

  return (
    <span className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-teal/25 bg-sky/35 px-4 text-base font-semibold text-navy">
      <CheckCircle2Icon className="size-4 shrink-0 text-teal" aria-hidden="true" />
      <span className="min-w-0 truncate">
        {sponsor.full_name} · {contactTypeLabel(sponsor.contact_type)}
      </span>
    </span>
  )
}

export function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-[10px] px-4 text-base font-semibold motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
        active
          ? 'bg-white text-navy shadow-sm'
          : 'text-navy/55 hover:text-navy'
      }`}
    >
      {label}
    </button>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: IconComponent
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone bg-white px-5 py-10 text-center">
      <Icon className="mx-auto size-8 text-teal" aria-hidden="true" />
      <p className="mt-3 text-lg font-semibold text-navy">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-base leading-7 text-navy/60">{body}</p>
    </div>
  )
}

export function PaginationControls({
  page,
  pageSize,
  total,
  itemLabel,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: PageSize
  total: number
  itemLabel: string
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: PageSize) => void
}) {
  const pageCount = pageCountFor(total, pageSize)
  const safePage = Math.min(page, pageCount)
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(total, safePage * pageSize)

  return (
    <div className="flex flex-col gap-3 border-t border-stone bg-ice px-5 py-3 text-base text-navy/65 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()} {itemLabel}{total === 1 ? '' : 's'}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 font-semibold text-navy/65">
          Per page
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
            className="rounded-xl border border-stone bg-white px-2.5 py-2 text-base font-semibold text-navy outline-none focus:border-teal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone bg-white px-4 text-base font-semibold text-navy motion-safe:transition-colors hover:bg-sky/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:pointer-events-none disabled:opacity-45"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pageCount, safePage + 1))}
            disabled={safePage >= pageCount}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stone bg-white px-4 text-base font-semibold text-navy motion-safe:transition-colors hover:bg-sky/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:pointer-events-none disabled:opacity-45"
          >
            Next
          </button>
        </div>
        <p className="text-center font-semibold text-navy/55 sm:min-w-20">
          Page {safePage.toLocaleString()} of {pageCount.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

export function RequestTypeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: IconComponent
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] px-4 py-1.5 text-sm font-semibold motion-safe:transition motion-safe:duration-150 motion-safe:ease focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
        active
          ? 'bg-white text-navy shadow-sm'
          : 'text-navy/55 hover:text-navy/70'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  )
}
