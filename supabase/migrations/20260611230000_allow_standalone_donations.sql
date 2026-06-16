-- A "request" recorded against a sponsor can either be earmarked for a child
-- (a sponsorship) or be a general donation with no child attached. Donations
-- live in the same table so they share amount, frequency, payment, and notes.

alter table public.sponsorships
  alter column child_id drop not null;

-- The unique "one active sponsorship per child" index already ignores nulls in
-- Postgres, so any number of childless donation rows can be active at once.
