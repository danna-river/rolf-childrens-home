-- Heartbeat table: a Vercel cron upserts this single row daily so the Supabase
-- free-tier project always sees API activity and never auto-pauses.
create table if not exists public.heartbeat (
  id integer primary key default 1,
  beat_at timestamptz not null default now(),
  -- keep it to exactly one row — the cron upserts id=1 forever
  constraint heartbeat_single_row check (id = 1)
);

-- RLS on with no policies: only the service role (used by the cron) can touch it.
alter table public.heartbeat enable row level security;

insert into public.heartbeat (id, beat_at)
values (1, now())
on conflict (id) do update set beat_at = now();
