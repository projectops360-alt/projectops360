# Supabase Auth transactional email rollout

**Status:** Prepared for review; not applied to production

## Approved provider configuration

| Setting | Value |
|---|---|
| Provider | Microsoft 365 authenticated SMTP submission |
| Host | `smtp.office365.com` |
| Port | `587` |
| Transport | STARTTLS enabled |
| Username | `support@projectops360.com` |
| Sender email | `support@projectops360.com` |
| Sender name | `ProjectOps360°` |
| Password | Enter directly in Supabase Dashboard; never store in this repository |

The domain currently exposes Microsoft 365 tenant/DKIM records together with GoDaddy/Proofpoint mail-protection records. The requested SMTP endpoint is Microsoft 365, not GoDaddy SMTP. The acceptance reference to “GoDaddy SMTP” is therefore interpreted as the GoDaddy-managed Microsoft 365 tenant, not `smtpout.secureserver.net`.

## Required Microsoft 365 gate

Before changing Supabase, verify only the mailbox `support@projectops360.com`:

1. Microsoft 365 Admin Center → Users → Active users → `support@projectops360.com`.
2. Mail → Manage email apps.
3. Confirm **Authenticated SMTP** is enabled for this mailbox.
4. If Security Defaults, an authentication policy or a tenant-wide control blocks SMTP AUTH, stop. Do not weaken the global policy without explicit approval.

No SMTP credential may be pasted into an issue, chat, command history, source file, frontend variable or log.

## Supabase production settings for review

Project: `ocopmlnkvidvmxgiwvxw`

- Authentication → Providers → Email:
  - Email provider: enabled.
  - Allow new users to sign up: preserve enabled.
  - Confirm email: enabled (`Autoconfirm` disabled).
  - Secure email change: enabled; preserve double confirmation.
- Authentication → Email → SMTP Settings:
  - Enable custom SMTP.
  - Apply the provider values above.
  - Enter the mailbox password directly in the protected Dashboard field.
- Authentication → URL Configuration:
  - Site URL: `https://projectops360.com`.
  - Redirect URLs:
    - `https://projectops360.com/auth/callback`
    - `https://projectops360.vercel.app/auth/callback`
    - `http://localhost:3000/auth/callback`

Do not add broad redirect wildcards for production. Add a Vercel Preview pattern only if Preview email testing is explicitly enabled and reviewed.

## Templates

Copy the reviewed subjects and HTML from `supabase/config.toml` and `supabase/templates/` into the hosted Supabase Email Templates page:

- Confirm sign up → `confirmation.html`
- Reset password → `recovery.html`
- Invite user → `invite.html`
- Magic link / Email OTP → `magic-link.html` (prepared, but the current frontend does not invoke passwordless sign-in)
- Change email address → `email-change.html`
- Reauthentication → `reauthentication.html`

All link-based templates use `{{ .ConfirmationURL }}`. Reauthentication correctly uses `{{ .Token }}` because it is an OTP template.

## Controlled rollout order

1. Apply and test the same Auth configuration in staging `gcxcljfzleasrleyyyda`.
2. Verify sender, SPF/DKIM/DMARC results, delivery, confirmation, recovery, invitation and Auth logs.
3. Review the application diff and staging evidence.
4. Obtain explicit production approval.
5. Apply production Auth settings in Supabase Dashboard.
6. Repeat the controlled test matrix and retain the Auth log timestamps.

No database table, RLS policy, role or application deployment is part of this rollout.
