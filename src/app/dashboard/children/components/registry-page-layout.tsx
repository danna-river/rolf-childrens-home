import type { ComponentType, ReactNode } from 'react'
import {
  Globe2Icon,
  UserCheckIcon,
  UserMinusIcon,
  UsersIcon,
} from 'lucide-react'
import { RegisterChildButton } from '@/components/registerChildButton'
import type { ChildrenRegistryStats } from '@/components/actions'

type RegistryHeaderProps = {
  badge: string
  eyebrow: string
  title: string
  subtitle: string
}

type MetricCardProps = {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  value: number
  tone?: 'default' | 'teal'
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: MetricCardProps) {
  const iconClass = tone === 'teal'
    ? 'bg-teal/12 text-teal'
    : 'bg-stone/60 text-navy/65'
  const valueClass = tone === 'teal' ? 'text-teal' : 'text-navy'

  return (
    <article className="rounded-md border border-stone bg-white p-3 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-md sm:size-14 ${iconClass}`}>
          <Icon className="size-5 sm:size-6" aria-hidden />
        </span>
        <p className={`min-w-0 text-right text-3xl font-bold tracking-tight sm:text-4xl ${valueClass}`}>
          {value.toLocaleString()}
        </p>
      </div>
      <p className="mt-2 whitespace-nowrap text-[11px] font-bold uppercase tracking-normal text-navy/60 sm:mt-3 sm:text-sm sm:tracking-wide">
        {label}
      </p>
    </article>
  )
}

export function RegistryHeader({
  badge,
  eyebrow,
  title,
  subtitle,
}: RegistryHeaderProps) {
  return (
    <section className="bg-navy text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-9">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-white/55">
            <span className="inline-flex min-h-8 items-center rounded-md border border-teal/40 bg-teal/15 px-3 text-xs font-bold uppercase tracking-widest text-teal">
              {badge}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{eyebrow}</span>
          </div>
          <h1 className="google-sans-registry-title text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-base font-semibold text-white/55 sm:text-lg">
            {subtitle}
          </p>
        </div>

        <RegisterChildButton />
      </div>
    </section>
  )
}

export function RegistryStats({ stats }: { stats: ChildrenRegistryStats }) {
  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard icon={UsersIcon} label="Total children" value={stats.total} />
      <MetricCard icon={UserCheckIcon} label="Active" value={stats.active} tone="teal" />
      <MetricCard icon={UserMinusIcon} label="Inactive" value={stats.inactive} />
      <MetricCard icon={Globe2Icon} label="Countries" value={stats.countries} />
    </section>
  )
}

export function RegistryToolbar({ children }: { children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-stone bg-white p-4 shadow-sm sm:p-5">
      {children}
    </section>
  )
}

export function ResultsSummary({
  total,
  hasFilters,
}: {
  total: number
  hasFilters: boolean
}) {
  return (
    <p className="text-sm font-semibold text-navy/70">
      {hasFilters ? 'Showing' : 'Showing all'}{' '}
      <span className="font-bold text-navy">{total.toLocaleString()}</span>{' '}
      child{total === 1 ? '' : 'ren'}
    </p>
  )
}
