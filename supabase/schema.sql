-- ============================================================
-- ROLF Children's Home — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── PROFILES ────────────────────────────────────────────────
-- Extends Supabase Auth users with role, display name, and countries.
-- Created automatically via trigger when a user is added to Auth.

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  role         text not null check (role in ('admin', 'data_inputer', 'donor')),
  -- 🇺🇬 Array structure lets an inputer manage multiple regions seamlessly (e.g., {"Uganda", "Kenya"})
  country      text[] default '{}'::text[],
  created_at   timestamptz not null default now()
);

alter table profiles enable row level security;

-- Users can read their own profile
create policy "profiles: own read"
  on profiles for select
  using (auth.uid() = id);

-- Admins can read all profiles
create policy "profiles: admin read all"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Only admins can insert/update/delete profiles (accounts created by admin)
create policy "profiles: admin write"
  on profiles for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );


-- ─── CHILDREN ────────────────────────────────────────────────

create table if not exists children (
  id                uuid primary key default gen_random_uuid(),
  id_rolf           text,                        -- internal ROLF ID code
  display_name      text not null,
  first_name        text,
  last_name         text,
  birth_year        int,
  birth_month       int,
  birth_day         int,
  profile_photo     text,                        -- S3 key for profile photo
  age               int,
  country           text,                        -- Single country string representing the child's home
  year_joined       int,                         -- Year the child joined the home
  career_aspiration text,                        -- What they want to be when they grow up
  favorite_subject  text,
  hobby             text,
  bio               text,
  notes             text,
  status            text not null default 'active'
                    check (status in ('active', 'inactive')),
  created_by        uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  edit_log          jsonb not null default '[]'::jsonb  -- [{edited_by, edited_at}, ...]
);

alter table children enable row level security;

-- Admins: full access to all children
create policy "children: admin all"
  on children for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Data inputers: SELECT any child if the child's country exists inside their whitelisted array
create policy "children: data_inputer select"
  on children for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'data_inputer'
        and children.country = any(p.country)
    )
  );

-- Data inputers: INSERT new children (The target child's country field must exist within their profile array)
create policy "children: data_inputer insert"
  on children for insert
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'data_inputer'
        and country = any(p.country)
    )
  );

-- Data inputers: UPDATE any child in their whitelisted countries
create policy "children: data_inputer update"
  on children for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'data_inputer'
        and children.country = any(p.country)
    )
  );

-- Donors: read-only, only active children assigned to them via sponsorships
create policy "children: donor assigned read"
  on children for select
  using (
    status = 'active'
    and exists (
      select 1 from sponsorships s
      where s.child_id = id
        and s.donor_id = auth.uid()
        and s.status = 'active'
    )
  );


-- ─── SPONSORSHIPS ────────────────────────────────────────────

create table if not exists sponsorships (
  id           uuid primary key default gen_random_uuid(),
  donor_id     uuid not null references profiles(id),
  child_id     uuid not null references children(id),
  status       text not null default 'active'
               check (status in ('active', 'ended')),
  start_date   date not null default current_date,
  end_date     date,
  created_at   timestamptz not null default now()
);

alter table sponsorships enable row level security;

-- Admins: full access
create policy "sponsorships: admin all"
  on sponsorships for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Donors: read their own sponsorships only
create policy "sponsorships: donor own read"
  on sponsorships for select
  using (donor_id = auth.uid());


-- ─── CHILD MEDIA ─────────────────────────────────────────────

create table if not exists child_media (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  type         text not null check (type in ('photo', 'video')),
  s3_key       text not null,            -- e.g. "children/uuid/filename.mp4"
  filename     text,
  content_type text,
  file_size_mb numeric,
  caption      text,
  approved     boolean not null default false,
  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);

alter table child_media enable row level security;

-- Admins: full access
create policy "child_media: admin all"
  on child_media for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Data inputers: manage media for any child inside their country array whitelist
create policy "child_media: data_inputer country"
  on child_media for all
  using (
    exists (
      select 1 from profiles p
      join children c on c.id = child_media.child_id
      where p.id = auth.uid()
        and p.role = 'data_inputer'
        and c.country = any(p.country)
    )
  );

-- Donors: read-only, only approved media for their assigned active children
create policy "child_media: donor assigned approved read"
  on child_media for select
  using (
    approved = true
    and exists (
      select 1 from sponsorships s
      join children c on c.id = child_media.child_id
      where s.child_id = child_media.child_id
        and s.donor_id = auth.uid()
        and s.status = 'active'
        and c.status = 'active'
    )
  );


-- ─── CHILD UPDATES ───────────────────────────────────────────

create table if not exists child_updates (
  id                uuid primary key default gen_random_uuid(),
  child_id          uuid not null references children(id) on delete cascade,
  title             text not null,
  body              text not null,
  visible_to_donor  boolean not null default false,
  created_by        uuid references profiles(id),
  created_at   timestamptz not null default now()
);

alter table child_updates enable row level security;

-- Admins: full access
create policy "child_updates: admin all"
  on child_updates for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Data inputers: manage updates for children in their country array whitelist
create policy "child_updates: data_inputer country"
  on child_updates for all
  using (
    exists (
      select 1 from profiles p
      join children c on c.id = child_updates.child_id
      where p.id = auth.uid()
        and p.role = 'data_inputer'
        and c.country = any(p.country)
    )
  );

-- Donors: read-only, only donor-visible updates for their assigned active children
create policy "child_updates: donor assigned visible read"
  on child_updates for select
  using (
    visible_to_donor = true
    and exists (
      select 1 from sponsorships s
      join children c on c.id = child_updates.child_id
      where s.child_id = child_updates.child_id
        and s.donor_id = auth.uid()
        and s.status = 'active'
        and c.status = 'active'
    )
  );


-- ─── TRIGGER: audit children edits ───────────────────────────

create or replace function audit_children_edit()
returns trigger language plpgsql security definer as $$
begin
  new.updated_at = now();
  new.edit_log = new.edit_log || jsonb_build_array(
    jsonb_build_object(
      'edited_by', auth.uid()::text,
      'edited_at', now()
    )
  );
  return new;
end;
$$;

drop trigger if exists children_audit on children;
create trigger children_audit
  before update on children
  for each row execute function audit_children_edit();


-- ─── TRIGGER: create profile on auth user creation ────────────
-- Automatically extracts metadata context and builds arrays dynamically.
-- Replaces raw text arrays passed down by the dashboard administration setup seamlessly.

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  country_raw text;
  country_array text[];
begin
  country_raw := new.raw_user_meta_data->>'country';
  
  -- If country payload metadata string is present, convert comma-separated values into a Postgres text array
  if country_raw is not null and country_raw <> '' then
    country_array := string_to_array(country_raw, ',');
    -- Clean leading/trailing spaces from items in array
    select array_agg(trim(val)) into country_array from unnest(country_array) as val;
  else
    country_array := array[]::text[];
  end if;

  insert into profiles (id, email, full_name, role, country)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'donor'),
    country_array
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ─── GRANTS ──────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on profiles, children, sponsorships, child_media, child_updates
  to anon, authenticated;

grant all
  on profiles, children, sponsorships, child_media, child_updates
  to service_role;