-- Service-role-only count of children whose current profile photo still needs
-- face enrollment (same predicate as get_face_enrollment_queue, count only).
-- Used by the weekday admin digest cron: children reach this state through
-- server-side photo writes (mobile offline sync) or failed client enrollments,
-- and stay unsearchable until an admin runs the backfill in Settings — so the
-- digest surfaces the count instead of waiting for an admin to look.
--
-- get_face_enrollment_queue cannot serve the cron: private.face_caller_profile
-- requires a signed-in admin/staff profile via auth.uid(), which a service-key
-- call does not have. This function returns a bare count (no child data, no
-- embeddings) and is executable by the service role alone.

begin;

create or replace function public.get_face_enrollment_pending_count(
  expected_model_version text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Grants below already restrict execution to the service role; re-check the
  -- JWT role here so a future grant mistake cannot open this to browser calls.
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'face pending count: service role only';
  end if;

  return (
    select count(*)
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
  );
end;
$$;

revoke execute on function public.get_face_enrollment_pending_count(text) from public, anon, authenticated;
grant execute on function public.get_face_enrollment_pending_count(text) to service_role;

commit;
