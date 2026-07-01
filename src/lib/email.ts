"use server"

import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

// Defaults to the production sender; override with RESEND_FROM for local testing
// (e.g. "ROLF Children's Home <onboarding@resend.dev>" before the domain is verified).
const FROM = process.env.RESEND_FROM ?? "ROLF Children's Home <noreply@childrenshome.rolfusa.org>"

// ---------------------------------------------------------------------------
// Shared layout
// ---------------------------------------------------------------------------

function layout(title: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8f8fa;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8fa;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:#152c4b;padding:28px 40px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">ROLF Children&rsquo;s Home</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;color:#1a1a2e;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8f8fa;padding:20px 40px;border-top:1px solid #e9e9e9;">
              <p style="margin:0;font-size:12px;color:#888;text-align:center;">
                ROLF Children&rsquo;s Home &mdash; This is an automated message, please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function btn(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#3CB6B2;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${label}</a>`
}

// Central send wrapper. Resend returns errors as a value (not a throw), so we
// must inspect `error` explicitly and log it — otherwise failures are invisible
// (no exception, no log). Logs surface in Vercel runtime logs for debugging.
async function deliver(args: { to: string | string[]; subject: string; html: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.error(`[email] RESEND_API_KEY missing — cannot send "${args.subject}"`)
    return { data: null, error: { name: "config", message: "RESEND_API_KEY is not set" } }
  }
  try {
    const result = await resend.emails.send({ from: FROM, ...args })
    if (result.error) {
      console.error(`[email] send failed "${args.subject}" → ${args.to}:`, JSON.stringify(result.error))
    } else {
      console.log(`[email] sent "${args.subject}" → ${args.to} (id: ${result.data?.id})`)
    }
    return result
  } catch (err) {
    console.error(`[email] threw sending "${args.subject}" → ${args.to}:`, err)
    return { data: null, error: { name: "exception", message: String(err) } }
  }
}

// ---------------------------------------------------------------------------
// 1. Account registration received → new user
// ---------------------------------------------------------------------------

export async function sendRegistrationReceivedEmail(to: string, fullName: string) {
  const body = `
    <p>Hi ${fullName},</p>
    <p>Thank you for registering with ROLF Children&rsquo;s Home. Your account request has been received and is currently pending review by our administrative team.</p>
    <p>You will receive another email once your account has been approved. If you have any questions, please reach out to your ROLF contact directly.</p>
    <p style="color:#888;font-size:13px;margin-top:32px;">If you did not create this account, you can safely ignore this email.</p>
  `
  return deliver({
    to,
    subject: "Your ROLF account request has been received",
    html: layout("Account Request Received", body),
  })
}

// ---------------------------------------------------------------------------
// 2. New account awaiting approval → admins
// ---------------------------------------------------------------------------

export async function sendNewAccountAlertToAdmins(
  adminEmails: string[],
  newUserName: string,
  newUserEmail: string,
  appUrl: string,
) {
  if (adminEmails.length === 0) return
  const body = `
    <p>A new account is waiting for your review:</p>
    <table style="margin:20px 0;font-size:14px;">
      <tr><td style="padding:4px 12px 4px 0;color:#888;">Name</td><td><strong>${newUserName}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#888;">Email</td><td>${newUserEmail}</td></tr>
    </table>
    <p>Visit the settings page to approve or deny access.</p>
    ${btn(`${appUrl}/dashboard/settings`, "Review in Dashboard")}
  `
  return deliver({
    to: adminEmails,
    subject: `New account request from ${newUserName}`,
    html: layout("New Account Awaiting Approval", body),
  })
}

// ---------------------------------------------------------------------------
// 3. Account approved → approved user
// ---------------------------------------------------------------------------

export async function sendAccountApprovedEmail(
  to: string,
  fullName: string,
  role: string,
  appUrl: string,
) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)
  const body = `
    <p>Hi ${fullName},</p>
    <p>Great news &mdash; your ROLF Children&rsquo;s Home account has been approved. You can now log in and access the platform as a <strong>${roleLabel}</strong>.</p>
    ${btn(`${appUrl}/login`, "Log In to ROLF")}
    <p style="color:#888;font-size:13px;margin-top:32px;">If you have any questions, please contact your ROLF administrator.</p>
  `
  return deliver({
    to,
    subject: "Your ROLF account has been approved",
    html: layout("Account Approved", body),
  })
}

// ---------------------------------------------------------------------------
// 4. Account denied/deleted → denied user
// ---------------------------------------------------------------------------

export async function sendAccountDeniedEmail(to: string, fullName: string) {
  const body = `
    <p>Hi ${fullName},</p>
    <p>After review, we were unable to approve your ROLF Children&rsquo;s Home account request at this time.</p>
    <p>If you believe this is an error or would like more information, please reach out to your ROLF contact directly.</p>
  `
  return deliver({
    to,
    subject: "Update on your ROLF account request",
    html: layout("Account Request Update", body),
  })
}

// ---------------------------------------------------------------------------
// 5. Password changed → user
// ---------------------------------------------------------------------------

export async function sendPasswordChangedEmail(to: string, fullName: string) {
  const body = `
    <p>Hi ${fullName},</p>
    <p>This is a confirmation that your ROLF Children&rsquo;s Home account password was recently changed.</p>
    <p>If you made this change, no action is needed.</p>
    <p style="color:#c0392b;font-size:14px;"><strong>If you did not change your password</strong>, please contact your ROLF administrator immediately.</p>
  `
  return deliver({
    to,
    subject: "Your ROLF account password has been changed",
    html: layout("Password Changed", body),
  })
}

// ---------------------------------------------------------------------------
// 6. Sponsor/donor portal invitation → sponsor
// ---------------------------------------------------------------------------

export async function sendSponsorInvitationEmail(
  to: string,
  sponsorName: string,
  appUrl: string,
) {
  const body = `
    <p>Hi ${sponsorName},</p>
    <p>You&rsquo;ve been set up as a sponsor in the ROLF Children&rsquo;s Home system. We warmly invite you to create your donor portal account, where you can view updates about the child you are sponsoring.</p>
    ${btn(`${appUrl}/login`, "Access the Donor Portal")}
    <p style="color:#888;font-size:13px;margin-top:32px;">
      Use the email address this message was sent to when signing up.<br/>
      If you have any questions, please reach out to your ROLF contact.
    </p>
  `
  return deliver({
    to,
    subject: "You're invited to the ROLF donor portal",
    html: layout("Donor Portal Invitation", body),
  })
}
