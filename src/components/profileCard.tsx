import Link from "next/link"
import { PencilIcon } from "lucide-react"
import type { ChildProfile } from "@/types/profile"
import { resolvePhotoSrc } from "@/lib/childMedia"
import type { Locale } from "@/i18n/config"

const avatarPalette = [
  "bg-teal text-white",
  "bg-navy text-white",
  "bg-sky text-navy",
  "bg-emerald-700 text-white",
  "bg-blue-700 text-white",
  "bg-slate-600 text-white",
  "bg-purple-700 text-white",
  "bg-rose-800 text-white",
]

export type ProfileCardLabels = {
  unnamed: string
  active: string
  inactive: string
  unknownAge: string
  unknownJoined: string
  rolfIdUnknown: string
  viewProfile: string
  edit: string
  country: string
  age: string
  joined: string
  lastUpdated: string
  notRecorded: string
  yearsShort: string
}

const DEFAULT_LABELS: ProfileCardLabels = {
  unnamed: "Unnamed",
  active: "Active",
  inactive: "Inactive",
  unknownAge: "Unknown",
  unknownJoined: "Unknown",
  rolfIdUnknown: "ROLF ID Unknown",
  viewProfile: "View {name}'s profile",
  edit: "Edit",
  country: "Country",
  age: "Age",
  joined: "Joined",
  lastUpdated: "Last updated",
  notRecorded: "Not recorded",
  yearsShort: "{age} yrs",
}

function childName(profile: ChildProfile, labels: ProfileCardLabels) {
  return [profile.firstName, profile.lastName].filter(Boolean).join(" ") || labels.unnamed
}

function initialsFor(profile: ChildProfile) {
  const first = profile.firstName?.[0] ?? ""
  const last = profile.lastName?.[0] ?? ""
  return `${first}${last}`.toUpperCase() || "?"
}

function avatarClass(profile: ChildProfile) {
  const seed = profile.id.charCodeAt(0) + profile.id.charCodeAt(profile.id.length - 1)
  return avatarPalette[seed % avatarPalette.length]
}

function dateLocale(locale: Locale) {
  return locale === "fr" ? "fr-FR" : "en-US"
}

function formatShortDate(value: string | Date | null, locale: Locale) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(dateLocale(locale), {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

function formatLastUpdated(value: string | null, locale: Locale) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(dateLocale(locale), {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

function birthdateLabel(profile: ChildProfile, locale: Locale) {
  if (!profile.birthDay || !profile.birthMonth || !profile.birthYear) return null
  const date = new Date(Date.UTC(profile.birthYear, profile.birthMonth - 1, profile.birthDay))
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== profile.birthYear ||
    date.getUTCMonth() !== profile.birthMonth - 1 ||
    date.getUTCDate() !== profile.birthDay
  ) return null
  return date.toLocaleDateString(dateLocale(locale), {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
}

function joinedLabel(profile: ChildProfile, locale: Locale) {
  return formatShortDate(profile.date_joined, locale) ?? (profile.year_joined ? String(profile.year_joined) : null)
}

function Avatar({ profile, size, labels }: { profile: ChildProfile; size: "sm" | "md"; labels: ProfileCardLabels }) {
  const name = childName(profile, labels)
  const cls = size === "sm" ? "size-8" : "size-12 sm:size-16"
  const textCls = size === "sm" ? "text-xs font-bold" : "text-base font-bold sm:text-xl"
  const photoSrc = resolvePhotoSrc(profile.profilePictureURL)
  return photoSrc ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoSrc} alt={name} referrerPolicy="no-referrer" className={`${cls} shrink-0 rounded-full object-cover ring-1 ring-stone`} />
  ) : (
    <div className={`${cls} flex shrink-0 items-center justify-center rounded-full ${avatarClass(profile)}`}>
      <span className={textCls}>{initialsFor(profile)}</span>
    </div>
  )
}

function StatusBadge({ isActive, labels }: { isActive: boolean; labels: ProfileCardLabels }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
      isActive ? "border-teal/50 bg-teal/10 text-teal" : "border-stone bg-ice text-navy/55"
    }`}>
      <span className={`size-1.5 rounded-full ${isActive ? "bg-teal" : "bg-navy/35"}`} aria-hidden="true" />
      {isActive ? labels.active : labels.inactive}
    </span>
  )
}

export default function ProfileCard({
  profile,
  labels = DEFAULT_LABELS,
  locale = "en",
}: {
  profile: ChildProfile
  labels?: ProfileCardLabels
  locale?: Locale
}) {
  const name = childName(profile, labels)
  const isActive = profile.status === "active"
  const birthdate = birthdateLabel(profile, locale)
  const age = typeof profile.age === "number" && profile.age >= 0 ? labels.yearsShort.replace("{age}", String(profile.age)) : labels.unknownAge
  const ageValue = birthdate ? `${age} · ${birthdate}` : age
  const joined = joinedLabel(profile, locale) ?? labels.unknownJoined
  const lastUpdated = formatLastUpdated(profile.updatedAt, locale) ?? "—"

  return (
    <article className="group relative overflow-hidden rounded-md border border-stone bg-white shadow-sm motion-safe:transition hover:border-teal/60 hover:shadow-md xl:rounded-none xl:border-x-0 xl:border-b-0 xl:border-t xl:shadow-none xl:first:border-t-0 xl:hover:bg-ice/40 xl:hover:shadow-none">
      {/* Clickable overlay — z-10 so it covers content; edit button sits above at z-20 */}
      <Link
        href={`/dashboard/children/${profile.id}`}
        className="absolute inset-0 z-10"
        aria-label={labels.viewProfile.replace("{name}", name)}
      />

      {/* ── Mobile + Tablet card layout (hidden on xl+) ── */}
      <div className="flex h-full flex-col xl:hidden">
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-3 sm:p-5">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Avatar profile={profile} size="md" labels={labels} />
            <div className="min-w-0 flex-1">
              <h2 className="block max-w-full whitespace-normal break-words font-[var(--font-nunito)] text-base font-semibold leading-tight text-foreground sm:text-xl">
                {name}
              </h2>
              <p className="mt-0.5 truncate font-mono text-sm text-teal sm:mt-1 sm:text-base">
                {profile.id_rolf || labels.rolfIdUnknown}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <StatusBadge isActive={isActive} labels={labels} />
            <Link
              href={`/dashboard/children/${profile.id}/edit`}
              className="relative z-20 inline-flex min-h-8 items-center gap-1.5 rounded-md px-1.5 font-[var(--font-nunito)] text-sm font-semibold text-navy/70 motion-safe:transition-colors hover:bg-ice hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal sm:min-h-9 sm:gap-2 sm:px-2 sm:text-base"
            >
              <PencilIcon className="size-3.5 sm:size-4" aria-hidden="true" />
              {labels.edit}
            </Link>
          </div>
        </div>
        <div className="mt-auto grid grid-cols-2">
          {[
            { label: labels.country, value: profile.country || labels.notRecorded, cls: "" },
            { label: labels.age, value: ageValue, cls: "border-l border-stone" },
            { label: labels.joined, value: joined, cls: "" },
            { label: labels.lastUpdated, value: lastUpdated, cls: "border-l border-stone" },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`min-w-0 border-t border-stone px-3 py-3 sm:px-5 sm:py-4 ${cls}`}>
              <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-navy/45 sm:text-xs sm:tracking-[0.14em]">{label}</p>
              <p className="mt-1.5 whitespace-normal break-words font-[var(--font-nunito)] text-sm font-semibold leading-snug text-navy/90 sm:mt-2">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Desktop spreadsheet row (xl+) ── */}
      <div className="hidden xl:grid xl:grid-cols-[minmax(240px,1.35fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(120px,0.8fr)_minmax(140px,0.9fr)_minmax(120px,0.6fr)] xl:items-center xl:gap-4 xl:px-5 xl:py-3.5">
        {/* Child */}
        <div className="flex min-w-0 items-center gap-3">
          <Avatar profile={profile} size="sm" labels={labels} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">{name}</p>
            <p className="truncate font-mono text-xs text-teal">{profile.id_rolf || "—"}</p>
          </div>
        </div>
        {/* Country */}
        <p className="truncate text-sm text-navy/70">{profile.country || "—"}</p>
        {/* Age */}
        <p className="truncate text-sm text-navy/70">{ageValue}</p>
        {/* Joined */}
        <p className="truncate text-sm text-navy/70">{joined}</p>
        {/* Last Updated */}
        <p className="truncate text-sm text-navy/70">{lastUpdated}</p>
        {/* Status + Edit */}
        <div className="flex items-center gap-2">
          <StatusBadge isActive={isActive} labels={labels} />
          <Link
            href={`/dashboard/children/${profile.id}/edit`}
            className="relative z-20 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-navy/60 motion-safe:transition-colors hover:bg-stone hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <PencilIcon className="size-3" aria-hidden="true" />
            {labels.edit}
          </Link>
        </div>
      </div>
    </article>
  )
}
