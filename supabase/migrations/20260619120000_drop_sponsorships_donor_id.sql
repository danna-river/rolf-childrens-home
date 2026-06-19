-- Retire the legacy sponsorships.donor_id column.
--
-- Sponsorships now link to a person exclusively through sponsor_id ->
-- sponsors.profile_id. The harden migration rewrote the donor-facing RLS
-- policies to accept BOTH the old donor_id and the new sponsor link; this
-- migration drops the donor_id branch from those policies, swaps the
-- contact-present check onto sponsor_id, and finally removes the column.
--
-- Run only after every sponsorship row is reachable via sponsor_id
-- (select id from public.sponsorships where sponsor_id is null) returns none.

begin;

-- ---------------------------------------------------------------------------
-- Repoint the donor read policies onto sponsor_id -> sponsors.profile_id
-- ---------------------------------------------------------------------------

drop policy if exists "sponsorships: donor own read" on public.sponsorships;
create policy "sponsorships: donor own read"
on public.sponsorships for select
to authenticated
using (
  exists (
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
    join public.sponsors as sponsor
      on sponsor.id = sponsorship.sponsor_id
    where sponsorship.child_id = children.id
      and sponsorship.status = 'active'
      and sponsor.profile_id = (select auth.uid())
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
    join public.sponsors as sponsor
      on sponsor.id = sponsorship.sponsor_id
    where sponsorship.child_id = child_media.child_id
      and sponsorship.status = 'active'
      and child.status = 'active'
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
    join public.children as child
      on child.id = child_updates.child_id
    join public.sponsors as sponsor
      on sponsor.id = sponsorship.sponsor_id
    where sponsorship.child_id = child_updates.child_id
      and sponsorship.status = 'active'
      and child.status = 'active'
      and sponsor.profile_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Drop donor_id, swapping its dependent objects onto sponsor_id
-- ---------------------------------------------------------------------------

-- A sponsorship must now be attached to a sponsor.
alter table public.sponsorships
  drop constraint if exists sponsorships_contact_present_check;

alter table public.sponsorships
  add constraint sponsorships_contact_present_check
  check (sponsor_id is not null)
  not valid;

drop index if exists public.sponsorships_donor_status_idx;

alter table public.sponsorships
  drop column if exists donor_id;

commit;
