-- Offline Android synchronization support.
--
-- These tables are intentionally reachable only by the backend service role.
-- Android authenticates with a normal Supabase user JWT, then calls the
-- Next.js mobile API which performs authorization and mutation server-side.

begin;

alter table public.children
  add column if not exists sync_version bigint not null default 1;

-- Do not silently create a uniqueness constraint over ambiguous existing data.
-- This migration stops before changing the index when duplicates are present.
do $$
begin
  if exists (
    select id_rolf
      from public.children
     where id_rolf is not null
     group by id_rolf
    having count(*) > 1
  ) then
    raise exception
      'Cannot create the mobile ROLF ID uniqueness index: duplicate children.id_rolf values exist. Resolve them first.';
  end if;

  -- The schema-repair migration used the _idx name. Keep it if it already
  -- exists instead of maintaining a redundant identical unique index.
  if to_regclass('public.children_id_rolf_unique') is null
     and to_regclass('public.children_id_rolf_unique_idx') is null then
    create unique index children_id_rolf_unique
      on public.children (id_rolf)
      where id_rolf is not null;
  end if;
end;
$$;

create or replace function public.bump_children_sync_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.sync_version = old.sync_version + 1;
  return new;
end;
$$;

revoke all on function public.bump_children_sync_version() from public, anon, authenticated;

drop trigger if exists children_sync_version on public.children;
create trigger children_sync_version
before update on public.children
for each row execute function public.bump_children_sync_version();

create table if not exists public.mobile_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id text not null check (char_length(btrim(installation_id)) between 3 and 200),
  device_label text not null check (char_length(btrim(device_label)) between 1 and 200),
  app_version text not null check (char_length(btrim(app_version)) between 1 and 80),
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  offline_access_expires_at timestamptz not null default (now() + interval '90 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, installation_id)
);

-- One active handset per staff account avoids two offline copies racing each
-- other. Re-enrolling on bootstrap revokes the previous active device.
create unique index if not exists mobile_devices_one_active_per_user
  on public.mobile_devices (user_id)
  where revoked_at is null;

create table if not exists public.rolf_id_counters (
  country text primary key references public.countries(name) on update cascade on delete restrict,
  next_sequence bigint not null check (next_sequence > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.rolf_id_reservations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.mobile_devices(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  country text not null references public.countries(name) on update cascade on delete restrict,
  id_rolf text not null unique,
  sequence bigint not null check (sequence > 0),
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  child_id uuid unique references public.children(id) on delete set null,
  constraint rolf_id_reservations_expiry_check check (expires_at > reserved_at)
);

create index if not exists rolf_id_reservations_device_country_idx
  on public.rolf_id_reservations (device_id, country, expires_at)
  where claimed_at is null;

create table if not exists public.mobile_sync_operations (
  operation_id uuid primary key,
  device_id uuid not null references public.mobile_devices(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  operation_type text not null check (operation_type in ('create_child', 'update_child')),
  payload_hash text not null check (char_length(payload_hash) = 64),
  status text not null check (status in ('processing', 'applied', 'conflict', 'rejected', 'failed')),
  result jsonb,
  attempt_started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mobile_sync_operations_device_created_idx
  on public.mobile_sync_operations (device_id, created_at desc);

create table if not exists public.mobile_media_uploads (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.mobile_devices(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  child_id uuid not null references public.children(id) on delete cascade,
  filename text not null check (char_length(btrim(filename)) between 1 and 255),
  mime_type text not null check (mime_type like 'image/%' or mime_type like 'video/%'),
  media_type text not null check (media_type in ('photo', 'video')),
  usage_type text not null check (usage_type in ('profile_picture', 'profile_video', 'library')),
  total_bytes bigint not null check (total_bytes > 0 and total_bytes <= 52428800),
  uploaded_bytes bigint not null default 0 check (uploaded_bytes >= 0 and uploaded_bytes <= total_bytes),
  drive_upload_url text not null,
  gdrive_file_id text unique,
  child_media_id uuid unique references public.child_media(id) on delete set null,
  status text not null check (status in ('uploading', 'uploaded', 'completed', 'failed')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mobile_media_uploads_device_status_idx
  on public.mobile_media_uploads (device_id, status, expires_at);

-- IDs are allocated atomically inside Postgres. The function is only callable
-- by service_role; its caller is the web backend after it has authenticated the
-- mobile user and device. No browser role receives table or function access.
create or replace function public.reserve_mobile_rolf_ids(
  p_device_id uuid,
  p_user_id uuid,
  p_country text,
  p_count integer default 50
)
returns table (id_rolf text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country text := btrim(p_country);
  v_role text;
  v_countries text[];
  v_iso_code text;
  v_next_sequence bigint;
begin
  if p_count < 1 or p_count > 50 then
    raise exception 'ROLF ID reservation count must be between 1 and 50';
  end if;

  select lower(btrim(p.role)), p.country
    into v_role, v_countries
    from public.mobile_devices d
    join public.profiles p on p.id = d.user_id
   where d.id = p_device_id
     and d.user_id = p_user_id
     and d.revoked_at is null
     and d.offline_access_expires_at > now();

  if not found or v_role not in ('admin', 'super_admin', 'staff') then
    raise exception 'Mobile device is not authorized to reserve ROLF IDs';
  end if;

  if v_role not in ('admin', 'super_admin') and not (v_country = any(coalesce(v_countries, '{}'::text[]))) then
    raise exception 'Mobile device cannot reserve ROLF IDs outside its assigned countries';
  end if;

  select c.iso_code
    into v_iso_code
    from public.countries c
   where c.name = v_country;

  if v_iso_code is null then
    raise exception 'Country is not configured for ROLF ID allocation';
  end if;

  insert into public.rolf_id_counters (country, next_sequence)
  select
    v_country,
    coalesce(
      max((substring(c.id_rolf from '^[^-]+-([0-9]+)$'))::bigint),
      0
    ) + 1
    from public.children c
   where c.id_rolf like v_iso_code || '-%'
  on conflict (country) do nothing;

  select next_sequence
    into v_next_sequence
    from public.rolf_id_counters
   where country = v_country
   for update;

  update public.rolf_id_counters
     set next_sequence = v_next_sequence + p_count,
         updated_at = now()
   where country = v_country;

  return query
  insert into public.rolf_id_reservations (
    device_id,
    user_id,
    country,
    id_rolf,
    sequence,
    expires_at
  )
  select
    p_device_id,
    p_user_id,
    v_country,
    v_iso_code || '-' || lpad((v_next_sequence + n)::text, 4, '0'),
    v_next_sequence + n,
    now() + interval '90 days'
  from generate_series(0, p_count - 1) as n
  returning rolf_id_reservations.id_rolf, rolf_id_reservations.expires_at;
end;
$$;

revoke all on function public.reserve_mobile_rolf_ids(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_mobile_rolf_ids(uuid, uuid, text, integer) to service_role;

alter table public.mobile_devices enable row level security;
alter table public.rolf_id_counters enable row level security;
alter table public.rolf_id_reservations enable row level security;
alter table public.mobile_sync_operations enable row level security;
alter table public.mobile_media_uploads enable row level security;

revoke all on table public.mobile_devices from public, anon, authenticated;
revoke all on table public.rolf_id_counters from public, anon, authenticated;
revoke all on table public.rolf_id_reservations from public, anon, authenticated;
revoke all on table public.mobile_sync_operations from public, anon, authenticated;
revoke all on table public.mobile_media_uploads from public, anon, authenticated;

grant select, insert, update, delete on table public.mobile_devices to service_role;
grant select, insert, update, delete on table public.rolf_id_counters to service_role;
grant select, insert, update, delete on table public.rolf_id_reservations to service_role;
grant select, insert, update, delete on table public.mobile_sync_operations to service_role;
grant select, insert, update, delete on table public.mobile_media_uploads to service_role;

comment on table public.mobile_devices is
  'Backend-only registry of offline Android devices. RLS enabled with no browser-role grants.';
comment on table public.rolf_id_reservations is
  'Backend-only blocks of country-scoped ROLF IDs allocated to a mobile device.';
comment on table public.mobile_sync_operations is
  'Backend-only idempotency log for Android sync operations.';
comment on table public.mobile_media_uploads is
  'Backend-only Drive resumable-upload sessions for Android media.';

commit;
