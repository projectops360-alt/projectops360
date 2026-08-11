---
slug: screen-admin-console
route: /admin
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/admin/page.tsx
  - src/app/[locale]/(app)/admin/actions.ts
  - src/components/admin-console/admin-console.tsx
  - src/lib/admin-console/access.server.ts
  - src/lib/admin-console/queries.ts
  - src/lib/admin-console/audit.ts
---

# EN: Admin Console screen

The platform-wide administration surface at `/admin`, cross-tenant by design. The gate is strict and server-side: `requirePlatformAdmin` authorizes an email only if `admin_authorized_users` holds an active row for it, or it matches the hardcoded emergency owner in `ADMIN_CONSOLE_ALLOWED_EMAILS` (`efrain.pradas@gmail.com`). This list is deliberately independent of `PRODUCT_BRAIN_ALLOWED_EMAILS`. Denial is `notFound()`, logged as `admin_access_denied`, and the gate runs *before* any business query, so a rejected user causes zero reads.

Six tabs render after the gate: Overview, Companies, Users & Projects, Project Tasks, Plans and Admin Access. Data is loaded with the service-role client from `organizations`, `profiles`, `projects`, `roadmap_tasks`, `milestones`, `subscriptions`, `plans` and `admin_authorized_users`, plus the `SECURITY DEFINER` RPCs `admin_list_company_users`, `admin_get_user_emails` and `admin_rename_organization`. The Users & Projects and Project Tasks tabs add text search and company/user/project/status filters. Writes are few and each re-checks the gate: `renameOrgAdminAction` renames any organization through the RPC, and `grantSystemAdminAction` / `revokeSystemAdminAction` insert or deactivate rows in `admin_authorized_users`; all three record to `audit_logs`. The Plans tab is read-only and links out to `/organization/plans` to actually edit. Related: screen-admin-backfill, screen-org-plans, screen-org-members.
Source: src/app/[locale]/(app)/admin/{page,actions}.ts(x), src/components/admin-console/admin-console.tsx, src/lib/admin-console/{access.server,queries}.ts.
Verify: signed in as the platform owner, open /admin and switch to the "Admin Access" tab; any other account gets a 404.

# ES: Pantalla Consola de Administración

La superficie de administración a nivel de plataforma en `/admin`, transversal a todos los inquilinos por diseño. El control es estricto y del lado del servidor: `requirePlatformAdmin` autoriza un correo solo si `admin_authorized_users` tiene una fila activa para él, o si coincide con el propietario de emergencia fijo en `ADMIN_CONSOLE_ALLOWED_EMAILS` (`efrain.pradas@gmail.com`). Esa lista es deliberadamente independiente de `PRODUCT_BRAIN_ALLOWED_EMAILS`. La negación es `notFound()`, se registra como `admin_access_denied` y el control corre *antes* de cualquier consulta de negocio, de modo que un usuario rechazado no provoca ni una sola lectura.

Tras el control se muestran seis pestañas: Resumen, Compañías, Usuarios y proyectos, Tareas por proyecto, Planes y Acceso de administradores. Los datos se cargan con el cliente de rol de servicio desde `organizations`, `profiles`, `projects`, `roadmap_tasks`, `milestones`, `subscriptions`, `plans` y `admin_authorized_users`, además de los RPC `SECURITY DEFINER` `admin_list_company_users`, `admin_get_user_emails` y `admin_rename_organization`. Las pestañas de usuarios y de tareas añaden búsqueda por texto y filtros de compañía, usuario, proyecto y estado. Las escrituras son pocas y cada una revalida el control: `renameOrgAdminAction` renombra cualquier organización mediante el RPC, y `grantSystemAdminAction` / `revokeSystemAdminAction` insertan o desactivan filas en `admin_authorized_users`; las tres quedan asentadas en `audit_logs`. La pestaña de Planes es de solo lectura y enlaza a `/organization/plans` para editarlos. Relacionadas: screen-admin-backfill, screen-org-plans, screen-org-members.
Fuente: src/app/[locale]/(app)/admin/{page,actions}.ts(x), src/components/admin-console/admin-console.tsx, src/lib/admin-console/{access.server,queries}.ts.
Verifica: con la sesión del propietario de la plataforma, abre /admin y cambia a la pestaña "Acceso de administradores"; cualquier otra cuenta recibe un 404.
