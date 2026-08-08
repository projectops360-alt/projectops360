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
---

# EN: Admin Console

A platform-wide administration cockpit at `/admin`, with no navigation link — you type the URL directly. Access is a strict server-side gate: `requirePlatformAdmin` checks active rows in `admin_authorized_users` first, then the hardcoded emergency owner (`ADMIN_CONSOLE_ALLOWED_EMAILS`); anyone else gets a 404 before a single business query runs, and denials are logged. The page loads cross-org data with the service role: KPI cards (companies, users, projects, tasks, active admins) and six tabs — Overview (top companies and projects), Companies (expandable rows that load per-company users via the SECURITY DEFINER RPC `admin_list_company_users`, plus inline rename through the `admin_rename_organization` RPC), Users & Projects (filterable table of projects per owner), Project Tasks (per-project drill-down with search, status filter and pagination via `getProjectTasksAction`), Plans (read-only global plan catalog from `plans`/`subscriptions`, linking to /organization/plans for edits), and Admin Access (grant, revoke or reactivate system admins in `admin_authorized_users` — revocation is soft, and the emergency owner can never be locked out). Server actions re-validate the gate on every call, and writes are recorded in `audit_logs`. User emails resolve via the `admin_get_user_emails` RPC. Related screens: Admin Backfill (`/admin/backfill`) and Living Graph Observability (`/admin/living-graph-observability`).
Source: src/app/[locale]/(app)/admin/page.tsx, actions.ts; src/components/admin-console/admin-console.tsx; src/lib/admin-console/access.server.ts, queries.ts.
Verify: sign in as an authorized platform admin and open /admin; a non-admin account gets a 404.

# ES: Consola de administración

Un centro de administración de toda la plataforma en `/admin`, sin enlace en la navegación: se accede escribiendo la URL. El acceso es una puerta estricta del lado del servidor: `requirePlatformAdmin` consulta primero las filas activas de `admin_authorized_users` y después al propietario de emergencia codificado (`ADMIN_CONSOLE_ALLOWED_EMAILS`); cualquier otro usuario recibe un 404 antes de ejecutar consulta alguna, y las denegaciones se registran. La página carga datos de todas las organizaciones con el service role: tarjetas KPI (compañías, usuarios, proyectos, tareas, administradores activos) y seis pestañas — Resumen (compañías y proyectos principales), Compañías (filas expandibles que cargan los usuarios de cada compañía mediante la RPC SECURITY DEFINER `admin_list_company_users`, más renombrado en línea con la RPC `admin_rename_organization`), Usuarios y proyectos (tabla filtrable de proyectos por propietario), Tareas por proyecto (detalle con búsqueda, filtro de estado y paginación vía `getProjectTasksAction`), Planes (catálogo global de solo lectura desde `plans`/`subscriptions`, con enlace a /organization/plans para editar) y Acceso de administradores (conceder, revocar o reactivar administradores del sistema en `admin_authorized_users` — la revocación es blanda y el propietario de emergencia nunca queda fuera). Las server actions revalidan la puerta en cada llamada y las escrituras quedan en `audit_logs`. Los correos se resuelven con la RPC `admin_get_user_emails`. Pantallas relacionadas: Backfill de administración (`/admin/backfill`) y Observabilidad del Living Graph (`/admin/living-graph-observability`).
Fuente: src/app/[locale]/(app)/admin/page.tsx, actions.ts; src/components/admin-console/admin-console.tsx; src/lib/admin-console/access.server.ts, queries.ts.
Verifica: inicia sesión como administrador de plataforma autorizado y abre /admin; una cuenta no autorizada recibe un 404.
