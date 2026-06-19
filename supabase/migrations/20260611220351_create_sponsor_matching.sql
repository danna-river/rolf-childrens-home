-- External event sponsors do not need an auth account. A sponsor can fund
-- multiple children, while a child can have only one current sponsorship.

begin;

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  contact_type text not null default 'sponsor',
  receipt_preference text not null default 'unknown',
  notes text,
  profile_id uuid unique references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.sponsors
  add column if not exists contact_type text not null default 'sponsor',
  add column if not exists receipt_preference text not null default 'unknown';

alter table public.sponsorships
  alter column donor_id drop not null,
  add column if not exists sponsor_id uuid references public.sponsors(id) on delete restrict,
  add column if not exists amount numeric(10, 2),
  add column if not exists frequency text,
  add column if not exists payment_method text,
  add column if not exists notes text,
  add column if not exists assigned_by uuid references public.profiles(id) on delete set null;

do $$
begin
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
      and conname = 'sponsorships_date_range_check'
  ) then
    alter table public.sponsorships
      add constraint sponsorships_date_range_check
      check (end_date is null or end_date >= start_date)
      not valid;
  end if;
end
$$;

alter table public.sponsorships
  drop constraint if exists sponsorships_frequency_check;

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

create index if not exists sponsors_name_idx
  on public.sponsors (lower(full_name));

create index if not exists sponsors_email_idx
  on public.sponsors (lower(email))
  where email is not null;

create index if not exists sponsorships_sponsor_id_idx
  on public.sponsorships (sponsor_id);

create index if not exists sponsorships_assigned_by_idx
  on public.sponsorships (assigned_by);

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
end
$$;

alter table public.sponsors enable row level security;

drop policy if exists "sponsors: admin all" on public.sponsors;
create policy "sponsors: admin all"
on public.sponsors for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select, insert, update, delete on public.sponsors to authenticated;
grant all on public.sponsors to service_role;

commit;
