---
slug: screen-org-teams
route: /organization/teams
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/organization/teams/page.tsx
  - src/app/[locale]/(app)/organization/teams/teams-client.tsx
  - src/app/[locale]/(app)/organization/teams/actions.ts
  - src/lib/team-roles/service.ts
  - src/lib/team-roles/config.ts
---

# EN: Organization Teams screen

The Teams & Groups screen manages reusable company teams (development, QA, steering committee, etc.) that can later be added wholesale to a project. You reach it from the Billing screen header (Teams button) at /organization/teams. At the top, a create panel takes a team name and a team type (from TEAM_TYPES in lib/team-roles/config) and calls createTeamAction. Below, each team renders as a card showing its name, type badge and member count, with a Member button that opens an add-member form and a trash button that soft-deletes the team (deleteTeamAction sets deleted_at). The add form lets you pick either an internal user (from the company directory) or an external contact — mutually exclusive — plus an optional default project role (datalist fed by PROJECT_ROLES), then calls addTeamMemberAction; members appear as removable chips (removeTeamMemberAction). Server-side, the page loads data through lib/team-roles/service: getCompanyTeams (organization_teams and organization_team_members tables), getCompanyDirectory (organization_members + profiles) and getExternalContacts (external_contacts). Actions require an authenticated org context (getOrgContext) and audit team creation via logAudit; there is no explicit owner/admin gate in these actions beyond authentication. Related screens: Members (internal users), External Contacts (people without login), Billing, and the project Team & Roles page where teams get applied.
Source: src/app/[locale]/(app)/organization/teams/{page.tsx,teams-client.tsx,actions.ts}, src/lib/team-roles/service.ts.
Verify: open Billing (sidebar) then click Teams, or go to /organization/teams.

# ES: Pantalla Equipos de la organización

La pantalla de Equipos y grupos administra equipos reutilizables de la empresa (desarrollo, QA, comité directivo, etc.) que luego pueden agregarse completos a un proyecto. Se accede desde el encabezado de Facturación (botón Equipos), en /organization/teams. Arriba, un panel de creación pide nombre y tipo de equipo (TEAM_TYPES en lib/team-roles/config) y llama a createTeamAction. Debajo, cada equipo se muestra como una tarjeta con nombre, insignia de tipo y número de miembros, con un botón Miembro que abre el formulario para agregar personas y un botón de papelera que hace borrado suave (deleteTeamAction escribe deleted_at). El formulario permite elegir un usuario interno (del directorio de la empresa) o un contacto externo — excluyentes entre sí — más un rol de proyecto por defecto opcional (lista PROJECT_ROLES), y llama a addTeamMemberAction; los miembros aparecen como fichas removibles (removeTeamMemberAction). En el servidor, la página carga datos con lib/team-roles/service: getCompanyTeams (tablas organization_teams y organization_team_members), getCompanyDirectory (organization_members + profiles) y getExternalContacts (external_contacts). Las acciones requieren contexto de organización autenticado y auditan la creación con logAudit; no hay un control adicional de propietario/administrador más allá de la autenticación. Pantallas relacionadas: Miembros, Contactos externos, Facturación y la página de Equipo y roles del proyecto.
Fuente: src/app/[locale]/(app)/organization/teams/{page.tsx,teams-client.tsx,actions.ts}, src/lib/team-roles/service.ts.
Verifica: abre Facturación en la barra lateral y pulsa Equipos, o navega a /organization/teams.
