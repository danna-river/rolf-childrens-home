-- Security hardening for public signup and self-service profile edits.
--
-- Public auth metadata is client-controlled, so self-signup must never assign
-- privileged roles or staff country scopes. New accounts always start as
-- unapproved and can only be promoted by an admin.
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

-- Staff and donors can update their own display preference fields only.
-- The trigger below prevents direct PostgREST calls from changing role, country,
-- email, ids, or timestamps through this self-update policy.
create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_role = 'service_role' or (select public.is_admin()) then
    return new;
  end if;

  if (to_jsonb(new) - 'full_name' - 'ui_locale')
    is distinct from
    (to_jsonb(old) - 'full_name' - 'ui_locale') then
    raise exception 'Only display preferences can be updated on your own profile.';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_self_update() from public, anon, authenticated;

drop trigger if exists guard_profile_self_update on public.profiles;
create trigger guard_profile_self_update
before update on public.profiles
for each row execute function public.guard_profile_self_update();

drop policy if exists "profiles: own update display preferences" on public.profiles;
create policy "profiles: own update display preferences"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Donors must not receive raw children rows because the table contains staff
-- notes and edit_log. Donor-facing pages use server-side verified, explicit
-- column selects instead.
drop policy if exists "children: donor assigned read" on public.children;

drop policy if exists "child_media: donor assigned approved read" on public.child_media;
create policy "child_media: donor assigned approved read"
on public.child_media for select
to authenticated
using (
  approved
  and exists (
    select 1
    from public.sponsorships as sponsorship
    join public.sponsors as sponsor
      on sponsor.id = sponsorship.sponsor_id
    where sponsorship.child_id = child_media.child_id
      and sponsorship.status = 'active'
      and sponsor.profile_id = (select auth.uid())
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
    join public.sponsors as sponsor
      on sponsor.id = sponsorship.sponsor_id
    where sponsorship.child_id = child_updates.child_id
      and sponsorship.status = 'active'
      and sponsor.profile_id = (select auth.uid())
  )
);
