---
slug: screen-org-members
route: /organization/members
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/organization/members/page.tsx
  - src/app/[locale]/(app)/organization/members/members-client.tsx
  - src/app/[locale]/(app)/organization/members/actions.ts
  - src/lib/billing/config.ts
  - src/lib/auth/email-redirects.server.ts
---

# EN: Organization Members screen

The Members & seats screen at `/organization/members`, reached from the Members button in the Billing header. The server page reads `organization_members` for the current org, joins display names from `profiles`, counts active rows in `project_team_members`, and resolves emails through the `admin_get_user_emails` RPC — scoped to this tenant's user ids so global Auth users are never enumerated. Three stat cards (billable seats, free viewers/external, pending invites) sit above filter chips (All, Billable, Free, Pending) and a table with member, seat, workspace role, status, project count and a Billable badge. Owners and admins (`canManage`) get inline selects that call `updateMemberSeatAction`, a pencil to rename via `renameWorkspaceUserAction`, and two provisioning panels: "Invite by email" (`inviteMemberAction`, a Supabase Auth invite redirecting to `/change-password?invite=1`, status `invited` until accepted — it returns `email_not_configured` when SMTP is not set up) and "Create login with a temporary password" (`createMemberWithPasswordAction`, minimum 12 characters with a generator button; no SMTP needed, the user is forced to change it on first login, and the credentials are shown once with a copy button). Writes are gated to owner/admin and recorded with `logAudit`. Only `owner`, `admin`, `full_seat` and `contributor_seat` are billable. Related: screen-org-billing, screen-team, screen-change-password.
Source: organization/members/{page.tsx,members-client.tsx,actions.ts}, lib/billing/config.ts.
Verify: open Billing from the sidebar, click Members, or go to /organization/members.

# ES: Pantalla Miembros de la organización

La pantalla de Miembros y asientos en `/organization/members`, accesible desde el botón Miembros del encabezado de Facturación. La página de servidor lee `organization_members` de la organización actual, toma los nombres de `profiles`, cuenta las filas activas de `project_team_members` y resuelve los correos con el RPC `admin_get_user_emails`, limitado a los identificadores de este inquilino para no enumerar jamás a los usuarios globales de Auth. Tres tarjetas de resumen (asientos facturables, gratuitos u observadores/externos, invitaciones pendientes) preceden a los filtros (Todos, Facturables, Gratis, Pendientes) y a una tabla con miembro, asiento, rol de workspace, estado, número de proyectos e insignia de facturable. Propietarios y administradores (`canManage`) disponen de selectores en línea que llaman a `updateMemberSeatAction`, un lápiz para renombrar con `renameWorkspaceUserAction` y dos paneles de alta: "Invitar por correo" (`inviteMemberAction`, invitación de Supabase Auth que redirige a `/change-password?invite=1`, con estado `invited` hasta aceptarse; devuelve `email_not_configured` cuando no hay SMTP configurado) y "Crear acceso con clave temporal" (`createMemberWithPasswordAction`, mínimo 12 caracteres con botón generador; no necesita SMTP, obliga a cambiar la clave en el primer ingreso y muestra las credenciales una sola vez con botón de copiar). Las escrituras se restringen a propietario o administrador y quedan registradas con `logAudit`. Solo `owner`, `admin`, `full_seat` y `contributor_seat` son facturables. Relacionadas: screen-org-billing, screen-team, screen-change-password.
Fuente: organization/members/{page.tsx,members-client.tsx,actions.ts}, lib/billing/config.ts.
Verifica: abre Facturación desde la barra lateral, pulsa Miembros o navega a /organization/members.
