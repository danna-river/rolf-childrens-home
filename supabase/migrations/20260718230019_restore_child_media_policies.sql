begin;

alter table public.child_media enable row level security;

grant select, insert, update, delete on table public.child_media to authenticated;
grant select, insert, update, delete on table public.child_media to service_role;

drop policy if exists "child_media: admin all" on public.child_media;
drop policy if exists "child_media: donor assigned approved read" on public.child_media;
drop policy if exists "child_media: donor assigned profile media read" on public.child_media;
drop policy if exists "child_media: staff country" on public.child_media;
drop policy if exists "child_media: staff regional isolation access" on public.child_media;

create policy "child_media: admin all"
on public.child_media for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "child_media: staff regional isolation access"
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

create policy "child_media: donor assigned profile media read"
on public.child_media for select
to authenticated
using (
  usage_type in ('profile_picture', 'profile_video')
  and exists (
    select 1
    from public.sponsorships as sponsorship
    join public.children as child
      on child.id = child_media.child_id
    join public.sponsors as sponsor
      on sponsor.id = sponsorship.sponsor_id
    where sponsorship.child_id = child_media.child_id
      and sponsorship.status = 'active'
      and child.status = 'active'
      and sponsor.profile_id = (select auth.uid())
  )
);

commit;
