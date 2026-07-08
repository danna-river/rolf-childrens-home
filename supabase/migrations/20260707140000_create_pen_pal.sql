-- Pen Pal Letters: moderated correspondence between donors and sponsored
-- children. No donor ever messages a child directly; everything flows through
-- staff review. Raw letter content and staff notes are service-role only.

begin;

-- This composite key lets pen_pal_threads enforce that its denormalized
-- sponsor_id and child_id match the referenced sponsorship row.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsorships'::regclass
      and conname = 'sponsorships_id_sponsor_child_unique'
  ) then
    alter table public.sponsorships
      add constraint sponsorships_id_sponsor_child_unique
      unique (id, sponsor_id, child_id);
  end if;
end
$$;

-- One thread per sponsorship pairing.
create table if not exists public.pen_pal_threads (
  id uuid primary key default gen_random_uuid(),
  sponsorship_id uuid not null,
  sponsor_id uuid not null references public.sponsors(id) on delete restrict,
  child_id uuid not null references public.children(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'closed')),
  closed_reason text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pen_pal_threads_sponsorship_unique unique (sponsorship_id),
  constraint pen_pal_threads_sponsorship_match_fkey
    foreign key (sponsorship_id, sponsor_id, child_id)
    references public.sponsorships(id, sponsor_id, child_id)
    on delete restrict,
  constraint pen_pal_threads_closed_reason_length_check
    check (closed_reason is null or char_length(closed_reason) <= 1000)
);

create table if not exists public.pen_pal_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.pen_pal_threads(id) on delete restrict,
  direction text not null check (direction in ('donor_to_child', 'child_to_donor')),
  status text not null default 'submitted' check (
    status in ('submitted', 'under_review', 'approved', 'delivered', 'published', 'rejected')
  ),
  raw_body text not null,
  approved_body text,
  author_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  delivered_by uuid references public.profiles(id) on delete set null,
  delivered_at timestamptz,
  published_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pen_pal_messages_raw_body_length_check
    check (char_length(btrim(raw_body)) between 1 and 2000),
  constraint pen_pal_messages_approved_body_length_check
    check (approved_body is null or char_length(btrim(approved_body)) between 1 and 2000),
  constraint pen_pal_messages_rejection_reason_length_check
    check (rejection_reason is null or char_length(rejection_reason) <= 1000),
  constraint pen_pal_messages_approved_status_body_check
    check (
      status not in ('approved', 'delivered', 'published')
      or approved_body is not null
    ),
  constraint pen_pal_messages_review_fields_check
    check (
      (reviewed_by is null and reviewed_at is null)
      or (reviewed_by is not null and reviewed_at is not null)
    ),
  constraint pen_pal_messages_delivery_fields_check
    check (
      (delivered_by is null and delivered_at is null)
      or (delivered_by is not null and delivered_at is not null)
    )
);

-- Append-only moderation audit trail.
create table if not exists public.pen_pal_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.pen_pal_threads(id) on delete restrict,
  message_id uuid references public.pen_pal_messages(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (
    event_type in (
      'thread_created',
      'letter_submitted',
      'letter_approved',
      'letter_rejected',
      'letter_delivered',
      'reply_published',
      'staff_note',
      'thread_closed'
    )
  ),
  notes text,
  created_at timestamptz not null default now(),
  constraint pen_pal_events_notes_length_check
    check (notes is null or char_length(notes) <= 2000)
);

create index if not exists pen_pal_threads_sponsor_child_idx on public.pen_pal_threads (sponsor_id, child_id);
create index if not exists pen_pal_threads_child_idx on public.pen_pal_threads (child_id);
create index if not exists pen_pal_messages_thread_idx on public.pen_pal_messages (thread_id, created_at);
create index if not exists pen_pal_messages_status_idx on public.pen_pal_messages (status);
create index if not exists pen_pal_events_thread_idx on public.pen_pal_events (thread_id, created_at);

-- The Data API grant layer is separate from RLS. Reset broad default grants,
-- keep browser roles out, and grant service_role only what server actions need.
revoke all on table
  public.pen_pal_threads,
  public.pen_pal_messages,
  public.pen_pal_events
from anon, authenticated, service_role;

grant select, insert, update on table
  public.pen_pal_threads,
  public.pen_pal_messages
to service_role;

grant select, insert on table
  public.pen_pal_events
to service_role;

-- RLS on with NO policies: these tables hold raw drafts, staff notes, and
-- moderation history. Nothing may query them directly from the client.
alter table public.pen_pal_threads enable row level security;
alter table public.pen_pal_messages enable row level security;
alter table public.pen_pal_events enable row level security;

comment on table public.pen_pal_threads is
  'Service-role-only pen pal correspondence threads. No direct client access.';
comment on table public.pen_pal_messages is
  'Service-role-only moderated pen pal letter bodies, including raw drafts and approved text.';
comment on table public.pen_pal_events is
  'Service-role-only pen pal moderation audit log.';

commit;
