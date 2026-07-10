-- Private face lookup: pgvector templates for the children registry.
-- One row per child, derived from the child's CURRENT profile photo. The
-- 1024-value embedding is computed in the staff browser (@vladmandic/human,
-- faceres model) and stored in a non-exposed schema. Nothing in this file is
-- reachable through the Data API; all access flows through the SECURITY
-- DEFINER functions below, which re-check the caller's role and country scope
-- on every call and never return an embedding.

begin;

-- pgvector, kept in the extensions schema per Supabase convention.
create extension if not exists vector with schema extensions;

-- PostgREST only serves exposed schemas, so `private` is unreachable from the
-- browser regardless of grants. Definer functions are the only door in.
create schema if not exists private;

create table if not exists private.child_face_templates (
  child_id uuid primary key references public.children(id) on delete cascade,
  source_media_id uuid not null references public.child_media(id) on delete cascade,
  -- Null embedding + status 'unsearchable' records "current profile photo has
  -- no usable face", so backfill treats the child as done instead of retrying.
  embedding extensions.vector(1024),
  status text not null default 'active' check (status in ('active', 'unsearchable')),
  model_version text not null check (char_length(model_version) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint child_face_templates_embedding_status_check
    check ((status = 'active') = (embedding is not null))
);

comment on table private.child_face_templates is
  'Face embeddings for child profile photos. Never exposed to the Data API; read/written only via the public.*_face_* definer functions.';

-- ~600 children today: exact scans are fast, no vector index needed yet.

-- Belt and braces: even if `private` were ever exposed, no browser role can
-- touch the table directly.
revoke all on table private.child_face_templates from public, anon, authenticated, service_role;
alter table private.child_face_templates enable row level security;

-- Caller context shared by every entry point: resolves the signed-in profile
-- and rejects everyone who is not an admin or staff member.
create or replace function private.face_caller_profile(
  out caller_is_admin boolean,
  out caller_countries text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text;
begin
  select lower(btrim(p.role)), p.country
    into caller_role, caller_countries
    from public.profiles p
   where p.id = (select auth.uid());

  if caller_role is null or caller_role not in ('admin', 'super_admin', 'staff') then
    raise exception 'face lookup: not authorized';
  end if;

  caller_is_admin := caller_role in ('admin', 'super_admin');
end;
$$;

-- Nearest profile-photo faces for a query embedding, restricted to the
-- caller's country scope. Returns at most 3 child ids + exact L2 distances;
-- embeddings themselves never leave the private schema.
create or replace function public.match_child_face(
  query_embedding extensions.vector(1024),
  query_model_version text
)
returns table (child_id uuid, distance double precision)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean;
  caller_countries text[];
begin
  select * into caller_is_admin, caller_countries from private.face_caller_profile();

  return query
  select t.child_id,
         (t.embedding operator(extensions.<->) query_embedding)::double precision
    from private.child_face_templates t
    join public.children c on c.id = t.child_id
   where t.status = 'active'
     and t.model_version = query_model_version
     and (
       caller_is_admin
       or (caller_countries is not null and c.country = any (caller_countries))
     )
   order by t.embedding operator(extensions.<->) query_embedding
   limit 3;
end;
$$;

-- Create or replace the single template for a child. A null embedding marks
-- the current photo 'unsearchable' (valid photo, no usable face) and clears
-- any stale vector. Validates that the media row is the child's CURRENT
-- profile photo so a race with a photo swap can never index the wrong image.
create or replace function public.upsert_child_face_template(
  target_child_id uuid,
  target_media_id uuid,
  face_embedding extensions.vector(1024),
  face_model_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean;
  caller_countries text[];
  child_country text;
  child_current_photo uuid;
  media_child_id uuid;
  media_kind text;
begin
  select * into caller_is_admin, caller_countries from private.face_caller_profile();

  if face_model_version is null or btrim(face_model_version) = '' then
    raise exception 'face template: model version is required';
  end if;

  select c.country, c.profile_photo
    into child_country, child_current_photo
    from public.children c
   where c.id = target_child_id;

  if not found then
    raise exception 'face template: child not found';
  end if;

  if not caller_is_admin
     and (caller_countries is null or child_country is null
          or not (child_country = any (caller_countries))) then
    raise exception 'face template: child outside caller country scope';
  end if;

  select m.child_id, m.media_type
    into media_child_id, media_kind
    from public.child_media m
   where m.id = target_media_id;

  if media_child_id is null or media_child_id <> target_child_id then
    raise exception 'face template: media does not belong to this child';
  end if;

  if media_kind <> 'photo' then
    raise exception 'face template: media is not a photo';
  end if;

  if child_current_photo is null or child_current_photo <> target_media_id then
    raise exception 'face template: media is not the current profile photo';
  end if;

  insert into private.child_face_templates as t
    (child_id, source_media_id, embedding, status, model_version)
  values (
    target_child_id,
    target_media_id,
    face_embedding,
    case when face_embedding is null then 'unsearchable' else 'active' end,
    btrim(face_model_version)
  )
  on conflict (child_id) do update
    set source_media_id = excluded.source_media_id,
        embedding = excluded.embedding,
        status = excluded.status,
        model_version = excluded.model_version,
        updated_at = now();
end;
$$;

-- Admin-only backfill queue: children whose current profile photo has no
-- template for the active model version. Enrolled and unsearchable children
-- drop out, so the backfill is idempotent and resumable by construction.
create or replace function public.get_face_enrollment_queue(
  expected_model_version text
)
returns table (child_id uuid, media_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean;
  caller_countries text[];
begin
  select * into caller_is_admin, caller_countries from private.face_caller_profile();
  if not caller_is_admin then
    raise exception 'face backfill: admin only';
  end if;

  return query
  select c.id, c.profile_photo, c.display_name
    from public.children c
    join public.child_media m on m.id = c.profile_photo
   where m.media_type = 'photo'
     and not exists (
       select 1
         from private.child_face_templates t
        where t.child_id = c.id
          and t.source_media_id = c.profile_photo
          and t.model_version = expected_model_version
     )
   order by c.display_name, c.id;
end;
$$;

-- Admin-only enrollment counters for the settings screen.
create or replace function public.get_face_template_stats(
  expected_model_version text
)
returns table (
  children_with_photo bigint,
  templates_active bigint,
  templates_unsearchable bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_admin boolean;
  caller_countries text[];
begin
  select * into caller_is_admin, caller_countries from private.face_caller_profile();
  if not caller_is_admin then
    raise exception 'face stats: admin only';
  end if;

  return query
  select
    count(*) filter (where m.id is not null),
    count(*) filter (where t.status = 'active'
                       and t.source_media_id = c.profile_photo
                       and t.model_version = expected_model_version),
    count(*) filter (where t.status = 'unsearchable'
                       and t.source_media_id = c.profile_photo
                       and t.model_version = expected_model_version)
    from public.children c
    left join public.child_media m
      on m.id = c.profile_photo and m.media_type = 'photo'
    left join private.child_face_templates t
      on t.child_id = c.id;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC on new functions by default; reset that
-- and allow only signed-in users (the functions re-check roles internally)
-- plus the service role.
revoke execute on function private.face_caller_profile() from public, anon, authenticated;
revoke execute on function public.match_child_face(extensions.vector, text) from public, anon;
revoke execute on function public.upsert_child_face_template(uuid, uuid, extensions.vector, text) from public, anon;
revoke execute on function public.get_face_enrollment_queue(text) from public, anon;
revoke execute on function public.get_face_template_stats(text) from public, anon;

grant execute on function public.match_child_face(extensions.vector, text) to authenticated, service_role;
grant execute on function public.upsert_child_face_template(uuid, uuid, extensions.vector, text) to authenticated, service_role;
grant execute on function public.get_face_enrollment_queue(text) to authenticated, service_role;
grant execute on function public.get_face_template_stats(text) to authenticated, service_role;

-- Replacing or removing a profile photo invalidates the template immediately.
-- (Enrollment then re-creates it for the new photo.) Deleting the child or the
-- source media row is covered by the ON DELETE CASCADE foreign keys.
create or replace function private.handle_profile_photo_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profile_photo is distinct from old.profile_photo then
    delete from private.child_face_templates t
     where t.child_id = new.id
       and (new.profile_photo is null or t.source_media_id is distinct from new.profile_photo);
  end if;
  return new;
end;
$$;

drop trigger if exists on_children_profile_photo_change on public.children;
create trigger on_children_profile_photo_change
  after update of profile_photo on public.children
  for each row execute function private.handle_profile_photo_change();

commit;
