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
---

# EN: Organization Members screen

The Members & Seats screen manages the internal members of the organization and their billing seat types. You reach it from the Billing screen header (Members button) at /organization/members. Three summary cards show billable seats, free members (viewers/external) and pending invites, followed by filter chips (All, Billable, Free, Pending) and a members table with name, email, seat type, workspace role, status, active project count and a Billable badge. Owners and admins (canManage) see two provisioning panels: "Invite by email" (inviteMemberAction, sends a Supabase auth invite; status stays "invited" until accepted) and "Create login with a temporary password" (createMemberWithPasswordAction, no SMTP needed; the user must change the password on first login, and credentials are shown once with a copy button). Inline controls edit seat type, workspace role and status (updateMemberSeatAction) and rename a member (renameWorkspaceUserAction). Data comes from organization_members, profiles, project_team_members and the Supabase auth admin API for emails; writes go through server actions gated to owner/admin and logged via logAudit. Seat types come from SEAT_TYPES in lib/billing/config: only owner, admin, full_seat and contributor_seat are billable; viewers and external are free. Related screens: Billing, Teams, External Contacts, and the workspace /team page, which reuses these same actions.
Source: src/app/[locale]/(app)/organization/members/{page.tsx,members-client.tsx,actions.ts}, src/lib/billing/config.ts.
Verify: open Billing (sidebar) then click Members, or go to /organization/members.

# ES: Pantalla Miembros de la organización

La pantalla de Miembros y asientos administra a los miembros internos de la organización y su tipo de asiento de facturación. Se accede desde el encabezado de la pantalla de Facturación (botón Miembros), en /organization/members. Tres tarjetas de resumen muestran asientos facturables, miembros gratuitos (observadores/externos) e invitaciones pendientes, seguidas de filtros (Todos, Facturables, Gratis, Pendientes) y una tabla con nombre, correo, tipo de asiento, rol de workspace, estado, cantidad de proyectos activos y una insignia de facturable. Propietarios y administradores ven dos paneles de alta: "Invitar por correo" (inviteMemberAction, invitación por Supabase Auth; el estado queda "invitado" hasta aceptarse) y "Crear acceso con clave temporal" (createMemberWithPasswordAction, sin SMTP; el usuario debe cambiar la clave en su primer ingreso y las credenciales se muestran una sola vez con botón de copiar). Controles en línea permiten editar asiento, rol de workspace y estado (updateMemberSeatAction) y renombrar miembros (renameWorkspaceUserAction). Los datos provienen de organization_members, profiles, project_team_members y la API admin de Supabase Auth para correos; las escrituras pasan por acciones de servidor restringidas a propietario/administrador y se registran con logAudit. Solo los asientos owner, admin, full_seat y contributor_seat son facturables. Pantallas relacionadas: Facturación, Equipos, Contactos externos y la página /team, que reutiliza estas mismas acciones.
Fuente: src/app/[locale]/(app)/organization/members/{page.tsx,members-client.tsx,actions.ts}, src/lib/billing/config.ts.
Verifica: abre Facturación en la barra lateral y pulsa Miembros, o navega a /organization/members.
