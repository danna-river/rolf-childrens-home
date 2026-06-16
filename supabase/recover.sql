-- ============================================================
-- ROLF Children's Home - idempotent pre-sponsor schema repair
--
-- This script preserves existing rows. It repairs tables, columns,
-- constraints, indexes, grants, functions, triggers, and RLS policies
-- required by the current application.
-- ============================================================

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Tables ---------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null,
  country text[] default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  id_rolf text,
  display_name text not null,
  first_name text,
  last_name text,
  birth_year integer,
  birth_month integer,
  birth_day integer,
  profile_photo text,
  profile_video text,
  age integer,
  country text,
  year_joined integer,
  date_joined date,
  career_aspiration text,
  favorite_subject text,
  hobby text,
  bio text,
  notes text,
  status text not null default 'active',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edit_log jsonb not null default '[]'::jsonb
);

create table if not exists public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.profiles(id),
  child_id uuid not null references public.children(id),
  status text not null default 'active',
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.child_media (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  type text not null,
  s3_key text not null,
  filename text,
  content_type text,
  file_size_mb numeric,
  caption text,
  approved boolean not null default false,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.child_updates (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  title text not null,
  body text not null,
  visible_to_donor boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.countries (
  id bigint generated always as identity primary key,
  name text not null unique,
  iso_code varchar not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_settings (
  id bigint generated always as identity primary key,
  countries text[] not null default '{}'::text[],
  updated_at timestamptz not null default timezone('utc', now())
);

-- Existing policies can depend on columns whose types need repair. Remove
-- them before changing the schema, then recreate the complete policy set below.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'children',
        'sponsorships',
        'child_media',
        'child_updates',
        'app_settings',
        'countries'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

-- Restore the country mappings that survived in app_settings and are used by
-- the existing child IDs.
insert into public.countries (name, iso_code)
values
  ('Kenya', 'KE'),
  ('Uganda', 'UG')
on conflict do nothing;

-- Repair columns that were lost or changed -----------------------------------

alter table public.children
  add column if not exists profile_video text,
  add column if not exists year_joined integer,
  add column if not exists date_joined date,
  add column if not exists career_aspiration text,
  add column if not exists favorite_subject text,
  add column if not exists hobby text;

do $$
declare
  country_udt text;
begin
  select udt_name
    into country_udt
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and column_name = 'country';

  if country_udt in ('text', 'varchar') then
    alter table public.profiles alter column country drop default;
    alter table public.profiles
      alter column country type text[]
      using case
        when country is null then null
        when btrim(country) = '' then '{}'::text[]
        else array[btrim(country)]
      end;
  end if;
end
$$;

alter table public.profiles
  alter column country set default '{}'::text[];

-- Normalize legacy roles before restoring the role constraint.
update public.profiles
set role = case
  when lower(btrim(role)) in (
    'data_inputer',
    'data-inputer',
    'data_inputter',
    'data-inputter'
  ) then 'staff'
  when lower(btrim(role)) = 'super_admin' then 'admin'
  when lower(btrim(role)) in ('admin', 'staff', 'donor', 'unapproved')
    then lower(btrim(role))
  else 'unapproved'
end;

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format(
      'alter table public.profiles drop constraint %I',
      constraint_record.conname
    );
  end loop;
end
$$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'staff', 'donor', 'unapproved'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.children'::regclass
      and conname = 'children_status_check'
  ) then
    alter table public.children
      add constraint children_status_check
      check (status in ('active', 'inactive'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sponsorships'::regclass
      and conname = 'sponsorships_status_check'
  ) then
    alter table public.sponsorships
      add constraint sponsorships_status_check
      check (status in ('active', 'ended'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.child_media'::regclass
      and conname = 'child_media_type_check'
  ) then
    alter table public.child_media
      add constraint child_media_type_check
      check (type in ('photo', 'video'));
  end if;
end
$$;

-- Restore the intended cascade behavior on deleted auth users and children.
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

alter table public.child_media drop constraint if exists child_media_child_id_fkey;
alter table public.child_media
  add constraint child_media_child_id_fkey
  foreign key (child_id) references public.children(id) on delete cascade;

alter table public.child_updates drop constraint if exists child_updates_child_id_fkey;
alter table public.child_updates
  add constraint child_updates_child_id_fkey
  foreign key (child_id) references public.children(id) on delete cascade;

-- Keep any sponsor-era orphan rows for manual review instead of deleting them.
do $$
begin
  if not exists (select 1 from public.sponsorships where donor_id is null) then
    alter table public.sponsorships alter column donor_id set not null;
  end if;
end
$$;

-- Required singleton settings row. Populate it from configured countries when
-- possible, but do not overwrite an existing list.
insert into public.app_settings (id, countries)
overriding system value
select
  1,
  coalesce(array_agg(name order by name), '{}'::text[])
from public.countries
on conflict (id) do nothing;

select setval(
  pg_get_serial_sequence('public.app_settings', 'id'),
  greatest((select coalesce(max(id), 1) from public.app_settings), 1),
  true
);

-- Backfill auth users whose public profile row was deleted. Authorization is
-- deliberately restored to the safest role until an admin approves them.
insert into public.profiles (id, email, full_name, role, country)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(users.raw_user_meta_data ->> 'full_name', ''),
  case
    when lower(coalesce(users.raw_app_meta_data ->> 'role', '')) in ('admin', 'staff', 'donor')
      then lower(users.raw_app_meta_data ->> 'role')
    else 'unapproved'
  end,
  '{}'::text[]
from auth.users as users
on conflict (id) do nothing;

-- Functions and triggers -----------------------------------------------------

-- This helper avoids recursive profiles RLS checks. It only reports whether
-- the current authenticated user is an admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.audit_children_edit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.edit_log = coalesce(new.edit_log, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'edited_by', (select auth.uid())::text,
      'edited_at', now()
    )
  );
  return new;
end;
$$;

revoke all on function public.audit_children_edit() from public, anon, authenticated;

drop trigger if exists children_audit on public.children;
create trigger children_audit
before update on public.children
for each row execute function public.audit_children_edit();

-- Public signup metadata is user-controlled, so every new account starts as
-- unapproved. Admin approval is the only path to an authorized role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, country)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'unapproved',
    '{}'::text[]
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.append_setting_country(country_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean_name text := btrim(country_name);
begin
  if clean_name = '' then
    raise exception 'Country name cannot be empty';
  end if;

  update public.app_settings
  set
    countries = array_append(countries, clean_name),
    updated_at = timezone('utc', now())
  where id = 1
    and not (countries @> array[clean_name]);
end;
$$;

revoke all on function public.append_setting_country(text) from public, anon;
grant execute on function public.append_setting_country(text) to authenticated, service_role;

-- Indexes --------------------------------------------------------------------

create index if not exists profiles_role_created_at_idx
  on public.profiles (role, created_at desc);
create index if not exists profiles_country_gin_idx
  on public.profiles using gin (country);

create index if not exists children_country_idx
  on public.children (country);
create index if not exists children_status_idx
  on public.children (status);
create index if not exists children_year_joined_idx
  on public.children (year_joined);
create index if not exists children_created_by_idx
  on public.children (created_by);
create index if not exists children_id_rolf_lookup_idx
  on public.children (id_rolf);

do $$
begin
  if not exists (
    select id_rolf
    from public.children
    where id_rolf is not null
    group by id_rolf
    having count(*) > 1
  ) then
    create unique index if not exists children_id_rolf_unique_idx
      on public.children (id_rolf)
      where id_rolf is not null;
  end if;
end
$$;

create index if not exists sponsorships_donor_status_idx
  on public.sponsorships (donor_id, status);
create index if not exists sponsorships_child_status_idx
  on public.sponsorships (child_id, status);

create index if not exists child_media_child_id_idx
  on public.child_media (child_id);
create index if not exists child_media_uploaded_by_idx
  on public.child_media (uploaded_by);

create index if not exists child_updates_child_id_idx
  on public.child_updates (child_id);
create index if not exists child_updates_created_by_idx
  on public.child_updates (created_by);

-- RLS policies ---------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.sponsorships enable row level security;
alter table public.child_media enable row level security;
alter table public.child_updates enable row level security;
alter table public.app_settings enable row level security;
alter table public.countries enable row level security;

create policy "profiles: own read"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles: admin read all"
on public.profiles for select
to authenticated
using ((select public.is_admin()));

create policy "profiles: admin write"
on public.profiles for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "children: admin all"
on public.children for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "children: staff select"
on public.children for select
to authenticated
using (
  exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'staff'
      and children.country = any(profile.country)
  )
);

create policy "children: staff insert"
on public.children for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'staff'
      and children.country = any(profile.country)
  )
);

create policy "children: staff update"
on public.children for update
to authenticated
using (
  exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'staff'
      and children.country = any(profile.country)
  )
)
with check (
  exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'staff'
      and children.country = any(profile.country)
  )
);

create policy "children: donor assigned read"
on public.children for select
to authenticated
using (
  status = 'active'
  and exists (
    select 1
    from public.sponsorships as sponsorship
    where sponsorship.child_id = children.id
      and sponsorship.donor_id = (select auth.uid())
      and sponsorship.status = 'active'
  )
);

create policy "sponsorships: admin all"
on public.sponsorships for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "sponsorships: donor own read"
on public.sponsorships for select
to authenticated
using (donor_id = (select auth.uid()));

create policy "child_media: admin all"
on public.child_media for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "child_media: staff country"
on public.child_media for all
to authenticated
using (
  exists (
    select 1
    from public.profiles as profile
    join public.children as child on child.id = child_media.child_id
    where profile.id = (select auth.uid())
      and profile.role = 'staff'
      and child.country = any(profile.country)
  )
)
with check (
  exists (
    select 1
    from public.profiles as profile
    join public.children as child on child.id = child_media.child_id
    where profile.id = (select auth.uid())
      and profile.role = 'staff'
      and child.country = any(profile.country)
  )
);

create policy "child_media: donor assigned approved read"
on public.child_media for select
to authenticated
using (
  approved
  and exists (
    select 1
    from public.sponsorships as sponsorship
    join public.children as child on child.id = child_media.child_id
    where sponsorship.child_id = child_media.child_id
      and sponsorship.donor_id = (select auth.uid())
      and sponsorship.status = 'active'
      and child.status = 'active'
  )
);

create policy "child_updates: admin all"
on public.child_updates for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "child_updates: staff country"
on public.child_updates for all
to authenticated
using (
  exists (
    select 1
    from public.profiles as profile
    join public.children as child on child.id = child_updates.child_id
    where profile.id = (select auth.uid())
      and profile.role = 'staff'
      and child.country = any(profile.country)
  )
)
with check (
  exists (
    select 1
    from public.profiles as profile
    join public.children as child on child.id = child_updates.child_id
    where profile.id = (select auth.uid())
      and profile.role = 'staff'
      and child.country = any(profile.country)
  )
);

create policy "child_updates: donor assigned visible read"
on public.child_updates for select
to authenticated
using (
  visible_to_donor
  and exists (
    select 1
    from public.sponsorships as sponsorship
    join public.children as child on child.id = child_updates.child_id
    where sponsorship.child_id = child_updates.child_id
      and sponsorship.donor_id = (select auth.uid())
      and sponsorship.status = 'active'
      and child.status = 'active'
  )
);

create policy "app_settings: authenticated read"
on public.app_settings for select
to authenticated
using (true);

create policy "app_settings: admin all"
on public.app_settings for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "countries: authenticated read"
on public.countries for select
to authenticated
using (true);

create policy "countries: admin all"
on public.countries for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Grants ---------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

revoke all on table
  public.profiles,
  public.children,
  public.sponsorships,
  public.child_media,
  public.child_updates,
  public.app_settings,
  public.countries
from public, anon;

grant select, insert, update, delete on table
  public.profiles,
  public.children,
  public.sponsorships,
  public.child_media,
  public.child_updates,
  public.app_settings,
  public.countries
to authenticated;

grant all on table
  public.profiles,
  public.children,
  public.sponsorships,
  public.child_media,
  public.child_updates,
  public.app_settings,
  public.countries
to service_role;

grant usage, select on sequence public.app_settings_id_seq, public.countries_id_seq
to authenticated, service_role;

commit;
