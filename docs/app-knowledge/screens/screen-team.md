---
slug: screen-team
route: /team
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/team/page.tsx
  - src/app/[locale]/(app)/team/team-client.tsx
  - src/app/[locale]/(app)/team/actions.ts
  - src/app/[locale]/(app)/organization/members/actions.ts
---

# EN: Team screen

The org-wide people directory at `/team`. The server page uses the Supabase admin client to load: `organization_members` for the current org (excluding removed members), their `profiles` fetched by user id (deliberately not filtered by the profile's home org), best-effort emails from the auth admin API, org `resources` of types person/crew/team/role/vendor/subcontractor, and `projects` for name resolution. The `TeamClient` then shows two populations: workspace users (name, email, role, seat type, workspace role, status, department, job title — with a "you" marker) and project people/crews/vendors. For managers (`canManage`) it exposes real management actions: add, edit, merge duplicate resources, archive, and invite a resource as a workspace user (`createTeamResourceAction`, `updateTeamResourceAction`, `mergeTeamResourcesAction`, `archiveTeamResourceAction`, `inviteResourceAsUserAction` in the local `actions.ts`), plus workspace-user administration reused from `/organization/members/actions.ts`: create a member with a generated temporary password, update role/seat, reset password, remove, or permanently delete a user. A client-side helper generates readable temporary passwords; users created this way are pushed through the forced change-password flow. Data written: `resources`, `organization_members`, and Supabase Auth users. Related screens: Organization members, Change password, and per-project Team/RACI.

Source: src/app/[locale]/(app)/team/page.tsx, team-client.tsx, actions.ts, ../organization/members/actions.ts.
Verify: open Team from the app navigation; workspace users and project resources are listed, with management buttons if you are a manager.

# ES: Pantalla Equipo

El directorio de personas de toda la organización en `/team`. La página de servidor usa el cliente admin de Supabase para cargar: `organization_members` de la organización actual (excluyendo removidos), sus `profiles` buscados por id de usuario (a propósito sin filtrar por la organización personal del perfil), correos de mejor esfuerzo desde la API admin de auth, `resources` de tipos persona/cuadrilla/equipo/rol/proveedor/subcontratista y `projects` para resolver nombres. El `TeamClient` muestra dos poblaciones: usuarios del workspace (nombre, correo, rol, tipo de asiento, rol de workspace, estado, departamento, puesto — con marcador "tú") y personas/cuadrillas/proveedores de proyecto. Para gestores (`canManage`) expone acciones reales: agregar, editar, fusionar duplicados, archivar e invitar un recurso como usuario (`createTeamResourceAction`, `updateTeamResourceAction`, `mergeTeamResourcesAction`, `archiveTeamResourceAction`, `inviteResourceAsUserAction`), más administración de usuarios reutilizada de `/organization/members/actions.ts`: crear miembro con contraseña temporal generada, actualizar rol/asiento, restablecer contraseña, remover o eliminar permanentemente. Los usuarios creados así pasan por el flujo forzado de cambio de contraseña. Escribe: `resources`, `organization_members` y usuarios de Supabase Auth. Pantallas relacionadas: Miembros de la organización, Cambio de contraseña y Equipo/RACI por proyecto.

Fuente: src/app/[locale]/(app)/team/page.tsx, team-client.tsx, actions.ts, ../organization/members/actions.ts.
Verifica: abre Equipo desde la navegación; se listan usuarios del workspace y recursos de proyecto, con botones de gestión si eres gestor.
