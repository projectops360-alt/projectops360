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
  - src/lib/billing/config.ts
---

# EN: Team screen

The org-wide people directory at `/team`, opened from the app navigation. The server page uses the Supabase admin client to load `organization_members` for the current org (excluding `removed`), their `profiles` fetched by user id — deliberately not filtered by the profile's home org, which used to hide members — plus `resources` of type person/crew/team/role/vendor/subcontractor, and `projects` for name resolution. Emails now come from the `admin_get_user_emails` RPC restricted to this tenant's member ids, never from enumerating global Auth users. `TeamClient` shows two populations: Workspace users as cards (name, role, email, non-active status, a "you" marker) and People, crews & vendors as a table, grouped by normalised name so duplicates can be merged. Managers (`owner` or `admin`) get "Create login" and "Add person" plus, per row, edit, merge (`mergeTeamResourcesAction`), archive (`archiveTeamResourceAction`) and invite-as-user (`inviteResourceAsUserAction`); `createMemberWithPasswordAction` creates a member with a generated readable temporary password. The Manage-user dialog edits name, seat, workspace role, status, department, job title and a **financial rate card** — the cost rate is stored on the user's linked `resources` row, and saving one creates an org-wide person resource if none exists — plus Remove. Two things it deliberately does not do: email is read-only (identity changes must go through the account owner) and permanent deletion is no longer offered here, only in the Admin console. Writes: `resources`, `organization_members`, `profiles`, `project_team_members`, Supabase Auth users, `audit_logs`. Related: screen-org-members, screen-project-team, screen-change-password, screen-admin-console.
Source: team/{page,team-client,actions}, ../organization/members/actions.ts.
Verify: open Team from the navigation; as an owner/admin click "Manage" on a workspace user and set a cost rate.

# ES: Pantalla Equipo

El directorio de personas de toda la organización en `/team`, accesible desde la navegación. La página de servidor usa el cliente admin de Supabase para cargar `organization_members` de la organización actual (excluyendo los `removed`), sus `profiles` buscados por id de usuario —a propósito sin filtrar por la organización personal del perfil, que antes ocultaba miembros—, más `resources` de tipo persona/cuadrilla/equipo/rol/proveedor/subcontratista y `projects` para resolver nombres. Los correos ahora provienen del RPC `admin_get_user_emails` acotado a los ids de miembros de este tenant, nunca de enumerar usuarios globales de Auth. `TeamClient` muestra dos poblaciones: los usuarios del workspace como tarjetas (nombre, rol, correo, estado si no está activo y marcador "tú") y las personas, cuadrillas y proveedores como tabla, agrupados por nombre normalizado para poder fusionar duplicados. Los gestores (`owner` o `admin`) disponen de "Crear acceso" y "Agregar persona" y, por fila, editar, fusionar (`mergeTeamResourcesAction`), archivar (`archiveTeamResourceAction`) e invitar como usuario (`inviteResourceAsUserAction`); `createMemberWithPasswordAction` crea un miembro con una contraseña temporal legible generada. El diálogo Gestionar usuario edita nombre, asiento, rol de workspace, estado, departamento, cargo y una **tarifa financiera** — la tarifa se guarda en el `resources` vinculado al usuario y, si no existe, guardarla crea un recurso de persona a nivel organización — además de Remover. Dos cosas que a propósito no hace: el correo es de solo lectura (el cambio de identidad debe hacerlo el titular de la cuenta) y el borrado permanente ya no se ofrece aquí, solo en la consola de administración. Escribe en: `resources`, `organization_members`, `profiles`, `project_team_members`, usuarios de Supabase Auth y `audit_logs`. Relacionadas: screen-org-members, screen-project-team, screen-change-password, screen-admin-console.
Fuente: team/{page,team-client,actions}, ../organization/members/actions.ts.
Verifica: abre Equipo desde la navegación; como propietario o administrador pulsa "Gestionar" en un usuario del workspace y define una tarifa de costo.
