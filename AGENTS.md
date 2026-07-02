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

A DB trigger `on_auth_user_created` (`public.handle_new_user`) **auto-creates the `profiles` row** from the signUp metadata. A manual `profiles.insert` in `signUpAction` collides with it (duplicate-key) and aborts the action before emails send. Signup only emails the new user (registration received); it must not re-insert the profile.

## Admin "accounts awaiting approval" digest

Admins are **not** emailed per signup (avoids spam on bulk-registration days). Instead a Vercel Cron hits `src/app/api/cron/pending-accounts-digest/route.ts` **Mon–Fri** (`30 16 * * 1-5` in `vercel.json`; 16:30 UTC ≈ morning Pacific, so the UTC weekday matches Pacific). It emails admins the current count of `role = 'unapproved'` profiles, and **sends nothing when zero are pending**. The route is guarded by the `CRON_SECRET` env var (Vercel injects it as the `Authorization: Bearer` header on cron runs).

## Required env vars (Vercel Production)

`RESEND_API_KEY` (sensitive), `NEXT_PUBLIC_APP_URL`, `CRON_SECRET` (sensitive), plus the existing Supabase/Google keys.
