-- Allow the backend Supabase service-role client used by the Vercel cron to
-- update the single heartbeat row. RLS bypass alone does not grant table
-- privileges through PostgREST.
grant select, insert, update on table public.heartbeat to service_role;
