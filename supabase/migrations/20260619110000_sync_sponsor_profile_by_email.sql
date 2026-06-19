-- Link donor accounts to admin-entered sponsor records by email.
--
-- Flow: an admin enters sponsors (name + email) with no login. Later a donor
-- creates an account (a profiles row). The two are the same person, matched by
-- email, and the link is recorded in sponsors.profile_id. Once linked, the
-- donor RLS policies (which key off sponsors.profile_id) let that donor see the
-- children / media / updates for sponsorships attached to their sponsor record.
--
-- Either side can be created first, so this installs a trigger on each side
-- plus a one-time backfill for pairs that already exist. Everything here is
-- additive: it only fills a null sponsors.profile_id, never overwrites or
-- deletes. sponsors.profile_id is unique, so a profile links to at most one
-- sponsor; when several sponsors share an email the oldest one wins.

begin;

-- ---------------------------------------------------------------------------
-- A new profile (donor signup) adopts a matching, unlinked sponsor record.
-- ---------------------------------------------------------------------------
create or replace function public.sponsor_link_on_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  -- Skip if this profile is already linked to some sponsor.
  if exists (
    select 1 from public.sponsors as linked where linked.profile_id = new.id
  ) then
    return new;
  end if;

  update public.sponsors as s
  set profile_id = new.id
  where s.id = (
    select candidate.id
    from public.sponsors as candidate
    where candidate.profile_id is null
      and lower(candidate.email) = lower(new.email)
    order by candidate.created_at, candidate.id
    limit 1
  );

  return new;
end;
$$;

revoke all on function public.sponsor_link_on_profile() from public, anon, authenticated;

drop trigger if exists sponsor_link_on_profile_trg on public.profiles;
create trigger sponsor_link_on_profile_trg
after insert or update of email on public.profiles
for each row execute function public.sponsor_link_on_profile();

-- ---------------------------------------------------------------------------
-- A newly entered sponsor adopts a matching profile (donor who signed up
-- before the admin added them). BEFORE so we set the row's own profile_id.
-- ---------------------------------------------------------------------------
create or replace function public.sponsor_link_on_sponsor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Respect an explicit link; only auto-fill when profile_id is absent.
  if new.profile_id is not null then
    return new;
  end if;
  if new.email is null or btrim(new.email) = '' then
    return new;
  end if;

  select p.id
  into new.profile_id
  from public.profiles as p
  where lower(p.email) = lower(new.email)
    and not exists (
      select 1 from public.sponsors as s where s.profile_id = p.id
    )
  order by p.created_at, p.id
  limit 1;

  return new;
end;
$$;

revoke all on function public.sponsor_link_on_sponsor() from public, anon, authenticated;

drop trigger if exists sponsor_link_on_sponsor_trg on public.sponsors;
create trigger sponsor_link_on_sponsor_trg
before insert or update of email on public.sponsors
for each row execute function public.sponsor_link_on_sponsor();

-- ---------------------------------------------------------------------------
-- One-time backfill: link sponsor/profile pairs that already coexist.
-- ---------------------------------------------------------------------------
update public.sponsors as s
set profile_id = p.id
from public.profiles as p
where s.profile_id is null
  and s.email is not null
  and lower(s.email) = lower(p.email)
  and not exists (
    select 1 from public.sponsors as linked where linked.profile_id = p.id
  )
  and s.id = (
    select candidate.id
    from public.sponsors as candidate
    where candidate.profile_id is null
      and lower(candidate.email) = lower(s.email)
    order by candidate.created_at, candidate.id
    limit 1
  );

commit;
