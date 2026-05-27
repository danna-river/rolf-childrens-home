-- ============================================================
-- ROLF Children's Home — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── PROFILES ────────────────────────────────────────────────
-- Extends Supabase Auth users with role and display name.
-- Created automatically via trigger when a user signs up.

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  role         text not null check (role in ('admin', 'data_inputer', 'donor')),
  created_at   timestamptz not null default now()
);

alter table profiles enable row level security;

-- Users can read their own profile; admins can read all
create policy "profiles: own read"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles: admin read all"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Only admins can insert/update profiles (accounts created by admin)
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
  id_rolf      text,
  display_name text not null,
  first_name   text,
  last_name    text,
  birth_year   int,
  birth_month  int,
  birth_day
  profile_photo text,  -- S3 key, e.g. "children/uuid/profile.jpg"
  age          int,
  country      text,
  favorite_subject text,
  hobby         text,
  bio          text,
  notes        text,
  status       text not null default 'active'
               check (status in ('active', 'inactive')),
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  edit_log jsonb default '[]'::jsonb,  -- Array of {edited_by: uuid, edited_at: timestamptz}
);

alter table children enable row level security;

-- Admins: full access
create policy "children: admin all"
  on children for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Data inputers: see only their own drafts/pending
create policy "children: data_inputer own"
  on children for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'data_inputer')
    and created_by = auth.uid()
    and status in ('draft', 'pending_review')
  );

-- Donors: read-only, only approved/sponsored children assigned to them
create policy "children: donor assigned read"
  on children for select
  using (
    status in ('approved', 'sponsored')
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
-- Stores S3 keys only. Actual files live in a private S3 bucket.

create table if not exists child_media (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references children(id) on delete cascade,
  type         text not null check (type in ('photo', 'video')),
  s3_key       text not null,            -- e.g. "children/uuid/photo.jpg"
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

-- Data inputers: manage media for children they created
create policy "child_media: data_inputer own children"
  on child_media for all
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'data_inputer'
    )
    and exists (
      select 1 from children c
      where c.id = child_id and c.created_by = auth.uid()
    )
  );

-- Donors: read-only, only approved media for assigned children
create policy "child_media: donor assigned approved read"
  on child_media for select
  using (
    approved = true
    and exists (
      select 1 from sponsorships s
      where s.child_id = child_media.child_id
        and s.donor_id = auth.uid()
        and s.status = 'active'
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
  created_at        timestamptz not null default now()
);

alter table child_updates enable row level security;

-- Admins: full access
create policy "child_updates: admin all"
  on child_updates for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Data inputers: manage updates for children they created
create policy "child_updates: data_inputer own children"
  on child_updates for all
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'data_inputer'
    )
    and exists (
      select 1 from children c
      where c.id = child_id and c.created_by = auth.uid()
    )
  );

-- Donors: read-only, only donor-visible updates for assigned children
create policy "child_updates: donor assigned visible read"
  on child_updates for select
  using (
    visible_to_donor = true
    and exists (
      select 1 from sponsorships s
      where s.child_id = child_updates.child_id
        and s.donor_id = auth.uid()
        and s.status = 'active'
    )
  );


-- ─── TRIGGER: auto-update updated_at on children ─────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger children_updated_at
  before update on children
  for each row execute function update_updated_at();


-- ─── TRIGGER: create profile on auth signup ───────────────────
-- Staff creates users via Supabase Auth admin API with user_metadata.role set.
-- This trigger copies that into the profiles table automatically.

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'donor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
