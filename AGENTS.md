# Git rules

**NEVER run `git commit`, `git push`, or any other write operation on the repo.** The developer reviews and commits all changes themselves. Leave changes in the working tree.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Transactional email (Resend)

All transactional email goes through `src/lib/email.ts` using [Resend](https://resend.com).

- **Sender:** `noreply@childrenshome.rolfusa.org` (override locally with `RESEND_FROM`, e.g. `onboarding@resend.dev` before a domain is verified). Env: `RESEND_API_KEY`.
- **Sending domain** is `childrenshome.rolfusa.org`, verified in Resend. Its DNS lives in the `rolfusa.org` zone (hosted at NS1) — the app subdomain also CNAMEs to Vercel there.
- `deliver()` wraps every send: Resend returns errors as a **value, not a throw**, so always check `result.error` (already handled). Note: server-action/`lib` `console.log` does **not** surface in Vercel's runtime log view (only middleware logs do) — use the Resend dashboard / API as the source of truth when debugging deliverability.
- Email links use `NEXT_PUBLIC_APP_URL` (`https://childrenshome.rolfusa.org`).

## Signup gotcha — do NOT insert the profile row in `signUpAction`

A DB trigger `on_auth_user_created` (`public.handle_new_user`) **auto-creates the `profiles` row** from the signUp metadata. A manual `profiles.insert` in `signUpAction`/`verifyOtpAction` collides with it (duplicate-key) and aborts the action before emails send. These actions must never re-insert the profile.

## Email verification (6-digit OTP)

Signup requires email verification via a 6-digit code (Supabase Auth OTP), handled entirely by Supabase — not the Resend transactional layer:

- `signUpAction` calls `supabase.auth.signUp` (which emails the code) and returns `{ success, email }` — it does **not** create a session or redirect. `register-form.tsx` then shows the code-entry step.
- `verifyOtpAction` calls `supabase.auth.verifyOtp({ type: 'signup', ... })`; on success it sends the registration-received email and redirects to `/dashboard`. The account is still `unapproved` until an admin approves (verification and approval are separate gates).
- **Supabase dashboard config is required** for this to work (do it before deploying the OTP code, or signup breaks):
  1. Auth → Providers → Email → **Confirm email** ON.
  2. Auth → Email Templates → **Confirm signup** → use `{{ .Token }}` (renders the 6-digit code) instead of `{{ .ConfirmationURL }}`.
  3. Project Settings → Auth → **SMTP** → point at Resend: host `smtp.resend.com`, port `465`, user `resend`, pass = `RESEND_API_KEY`, sender `noreply@childrenshome.rolfusa.org`. (Supabase's built-in sender is rate-limited and poor deliverability.)

## Admin "accounts awaiting approval" digest

Admins are **not** emailed per signup (avoids spam on bulk-registration days). Instead a Vercel Cron hits `src/app/api/cron/pending-accounts-digest/route.ts` **Mon–Fri** (`30 16 * * 1-5` in `vercel.json`; 16:30 UTC ≈ morning Pacific, so the UTC weekday matches Pacific). It emails admins the current count of `role = 'unapproved'` profiles, and **sends nothing when zero are pending**. The route is guarded by the `CRON_SECRET` env var (Vercel injects it as the `Authorization: Bearer` header on cron runs).

## Required env vars (Vercel Production)

`RESEND_API_KEY` (sensitive), `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` (sensitive), plus the existing Supabase/Google keys.

# UI translations (src/i18n)

Staff-facing UI strings go through the i18n system in `src/i18n/` (`en.ts` is the source of truth, `fr.ts` must cover every key — compiler-checked). Components read strings via `useTranslations()` (`t('some.key')`), never hardcoded literals. **Stored content — bios, letters, working notes — stays English and is never run through this system**; only chrome/labels/UI copy is translated.

**Whenever a change adds, edits, or removes user-facing UI text (new component, new label, new button, new error/success message, etc.), stop and think about translation before finishing the task:**

- Does this string need a key in `src/i18n/locales/en.ts`, with a matching entry in `src/i18n/locales/fr.ts`?
- If you're unsure whether new text belongs in the i18n system (e.g. admin-only debug text, or something that's arguably stored content, not UI chrome) or unsure of the correct French translation, **ask the developer** rather than guessing — don't silently hardcode a string or invent a French translation that ships to real users.
- Don't add a key to `en.ts` without a matching `fr.ts` entry (the type will fail to compile, but check anyway before calling it done).

@SOFTWARE_ARCHITECTURE_AND_SSOT.md
@USER_GUIDE_NON_TECHNICAL.md