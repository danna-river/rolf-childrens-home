-- Staff UI language preference. Purely additive: one new column on profiles
-- with a safe default — no existing rows or tables are modified beyond
-- gaining the default value. UI translation only; all stored content
-- (bios, letters, notes) stays English.
alter table public.profiles
add column if not exists ui_locale text not null default 'en';

-- Guarded so the migration is safe to re-run (ADD CONSTRAINT has no IF NOT EXISTS).
do $$
begin
  alter table public.profiles
  add constraint profiles_ui_locale_check check (ui_locale in ('en', 'fr'));
exception
  when duplicate_object then null;
end $$;
