begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'mobile-app-releases',
  'mobile-app-releases',
  false,
  209715200,
  array[
    'application/vnd.android.package-archive',
    'application/octet-stream'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

commit;
