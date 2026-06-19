-- Harden sponsor matching without deleting, truncating, or rewriting existing
-- sponsorship data. This migration is intentionally defensive because it may
-- run against databases that already contain legacy donor sponsorship rows.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Table and column shape
-- ---------------------------------------------------------------------------

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  contact_type text not null default 'sponsor',
  receipt_preference text not null default 'unknown',
  notes text,
  profile_id uuid,
  created_at timestamptz not null default now()
);

alter table public.sponsors
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists contact_type text not null default 'sponsor',
  add column if not exists receipt_preference text not null default 'unknown',
  add column if not exists notes text,
  add column if not exists profile_id uuid,
  add column if not exists created_at timestamptz not null default now();

alter table public.sponsors
  alter column contact_type set default 'sponsor',
  alter column receipt_preference set default 'unknown',
  alter column created_at set default now();

alter table public.sponsorships
  alter column donor_id drop not null,
  alter column child_id drop not null,
  add column if not exists sponsor_id uuid,
  add column if not exists amount numeric(10, 2),
  add column if not exists frequency text,
  add column if not exists payment_method text,
  add column if not exists notes text,
  add column if not exists assigned_by uuid;

-- ---------------------------------------------------------------------------
-- Foreign keys, uniqueness, and checks
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsors'::regclass
      and conname = 'sponsors_profile_id_fkey'
  ) then
    alter table public.sponsors
      add constraint sponsors_profile_id_fkey
      foreign key (profile_id)
      references public.profiles(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsorships'::regclass
      and conname = 'sponsorships_sponsor_id_fkey'
  ) then
    alter table public.sponsorships
      add constraint sponsorships_sponsor_id_fkey
      foreign key (sponsor_id)
      references public.sponsors(id)
      on delete restrict
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsorships'::regclass
      and conname = 'sponsorships_assigned_by_fkey'
  ) then
    alter table public.sponsorships
      add constraint sponsorships_assigned_by_fkey
      foreign key (assigned_by)
      references public.profiles(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsors'::regclass
      and conname = 'sponsors_full_name_present_check'
  ) then
    alter table public.sponsors
      add constraint sponsors_full_name_present_check
      check (full_name is not null and btrim(full_name) <> '')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsors'::regclass
      and conname = 'sponsors_contact_type_check'
  ) then
    alter table public.sponsors
      add constraint sponsors_contact_type_check
      check (contact_type in ('sponsor', 'donor_only', 'prospect'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsors'::regclass
      and conname = 'sponsors_receipt_preference_check'
  ) then
    alter table public.sponsors
      add constraint sponsors_receipt_preference_check
      check (receipt_preference in ('unknown', 'requested', 'not_needed'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsorships'::regclass
      and conname = 'sponsorships_contact_present_check'
  ) then
    alter table public.sponsorships
      add constraint sponsorships_contact_present_check
      check (donor_id is not null or sponsor_id is not null)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsorships'::regclass
      and conname = 'sponsorships_amount_check'
  ) then
    alter table public.sponsorships
      add constraint sponsorships_amount_check
      check (amount is null or amount >= 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsorships'::regclass
      and conname = 'sponsorships_date_range_check'
  ) then
    alter table public.sponsorships
      add constraint sponsorships_date_range_check
      check (end_date is null or end_date >= start_date)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsorships'::regclass
      and conname = 'sponsorships_payment_method_check'
  ) then
    alter table public.sponsorships
      add constraint sponsorships_payment_method_check
      check (
        payment_method is null
        or payment_method in (
          'square',
          'pushpay',
          'check',
          'stock',
          'fidelity',
          'charity_account',
          'other'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsorships'::regclass
      and conname = 'sponsorships_frequency_check'
  ) then
    alter table public.sponsorships
      add constraint sponsorships_frequency_check
      check (
        frequency is null
        or frequency in (
          'one_time',
          'weekly',
          'biweekly',
          'monthly',
          'quarterly',
          'semiannual',
          'annual'
        )
      )
      not valid;
  end if;
end
$$;

create index if not exists sponsors_name_idx
  on public.sponsors (lower(full_name));

create index if not exists sponsors_email_idx
  on public.sponsors (lower(email))
  where email is not null;

create index if not exists sponsorships_sponsor_id_idx
  on public.sponsorships (sponsor_id);

create index if not exists sponsorships_assigned_by_idx
  on public.sponsorships (assigned_by);

-- Preserve a one-active-child rule only when existing rows are already clean.
-- If duplicates exist, keep every row and skip the index so an admin can review
-- the duplicate active matches instead of having this migration fail or delete.
do $$
begin
  if not exists (
    select 1
    from pg_class index_class
    join pg_namespace namespace on namespace.oid = index_class.relnamespace
    where namespace.nspname = 'public'
      and index_class.relname = 'sponsorships_one_active_child_idx'
  ) then
    if exists (
      select 1
      from public.sponsorships
      where status = 'active'
        and child_id is not null
      group by child_id
      having count(*) > 1
    ) then
      raise notice 'Skipped sponsorships_one_active_child_idx because duplicate active child sponsorships already exist.';
    else
      execute '
        create unique index sponsorships_one_active_child_idx
          on public.sponsorships (child_id)
          where status = ''active''
            and child_id is not null
      ';
    end if;
  end if;

  if not exists (
    select 1
    from pg_class index_class
    join pg_namespace namespace on namespace.oid = index_class.relnamespace
    where namespace.nspname = 'public'
      and index_class.relname = 'sponsors_profile_id_unique_idx'
  )
  and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sponsors'::regclass
      and conname = 'sponsors_profile_id_key'
  ) then
    if exists (
      select 1
      from public.sponsors
      where profile_id is not null
      group by profile_id
      having count(*) > 1
    ) then
      raise notice 'Skipped sponsors_profile_id_unique_idx because duplicate sponsor profile links already exist.';
    else
      execute '
        create unique index sponsors_profile_id_unique_idx
          on public.sponsors (profile_id)
          where profile_id is not null
      ';
    end if;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- RLS and Data API grants
-- ---------------------------------------------------------------------------

alter table public.sponsors enable row level security;
alter table public.sponsorships enable row level security;
alter table public.children enable row level security;
alter table public.child_media enable row level security;
alter table public.child_updates enable row level security;

drop policy if exists "sponsors: admin all" on public.sponsors;
create policy "sponsors: admin all"
on public.sponsors for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "sponsors: linked profile read" on public.sponsors;
create policy "sponsors: linked profile read"
on public.sponsors for select
to authenticated
using (profile_id = (select auth.uid()));

drop policy if exists "sponsorships: donor own read" on public.sponsorships;
create policy "sponsorships: donor own read"
on public.sponsorships for select
to authenticated
using (
  donor_id = (select auth.uid())
  or exists (
    select 1
    from public.sponsors as sponsor
    where sponsor.id = sponsorships.sponsor_id
      and sponsor.profile_id = (select auth.uid())
  )
);

drop policy if exists "children: donor assigned read" on public.children;
create policy "children: donor assigned read"
on public.children for select
to authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.sponsorships as sponsorship
    left join public.sponsors as sponsor
      on sponsor.id = sponsorship.sponsor_id
    where sponsorship.child_id = children.id
      and sponsorship.status = 'active'
      and (
        sponsorship.donor_id = (select auth.uid())
        or sponsor.profile_id = (select auth.uid())
      )
  )
);

drop policy if exists "child_media: donor assigned approved read" on public.child_media;
create policy "child_media: donor assigned approved read"
on public.child_media for select
to authenticated
using (
  approved
  and exists (
    select 1
    from public.sponsorships as sponsorship
    join public.children as child
      on child.id = child_media.child_id
    left join public.sponsors as sponsor
      on sponsor.id = sponsorship.sponsor_id
    where sponsorship.child_id = child_media.child_id
      and sponsorship.status = 'active'
      and child.status = 'active'
      and (
        sponsorship.donor_id = (select auth.uid())
        or sponsor.profile_id = (select auth.uid())
      )
  )
);

drop policy if exists "child_updates: donor assigned visible read" on public.child_updates;
create policy "child_updates: donor assigned visible read"
on public.child_updates for select
to authenticated
using (
  visible_to_donor
  and exists (
    select 1
    from public.sponsorships as sponsorship
    join public.children as child
      on child.id = child_updates.child_id
    left join public.sponsors as sponsor
      on sponsor.id = sponsorship.sponsor_id
    where sponsorship.child_id = child_updates.child_id
      and sponsorship.status = 'active'
      and child.status = 'active'
      and (
        sponsorship.donor_id = (select auth.uid())
        or sponsor.profile_id = (select auth.uid())
      )
  )
);

grant select, insert, update, delete on table
  public.sponsors,
  public.sponsorships
to authenticated;

grant usage on schema public to authenticated, service_role;

grant all on table
  public.sponsors,
  public.sponsorships
to service_role;

comment on table public.sponsors is
  'External event contacts and optional profile links for sponsor matching.';
comment on column public.sponsorships.sponsor_id is
  'External sponsor contact for sponsor dashboard matches and standalone donations.';

commit;
