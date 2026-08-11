---
slug: screen-projects-list
route: /projects
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/page.tsx
  - src/app/[locale]/(app)/projects/project-list-client.tsx
  - src/app/[locale]/(app)/projects/actions.ts
  - src/components/projects/project-card.tsx
  - src/components/projects/create-project-dialog.tsx
---

# EN: Projects list screen

The organization's portfolio at `/projects`, reached from the main navigation. The server page queries `projects` scoped to the current organization (soft-deleted rows excluded, newest first) and resolves localized status labels with next-intl. `ProjectListClient` renders a create button opening `CreateProjectDialog`, then either an empty state or a grid of `ProjectCard`s linking to `/projects/{id}`. Each card shows a status badge and start date; the ellipsis icon that appears on hover is decorative — there is no card menu, and the card title reads `title_i18n.en` regardless of the active locale, so a Spanish-only project falls back to its slug. Creation is now governed: the dialog first calls `loadProjectCreationScopeAction` (RPC `v2_creatable_organizations`) and, when more than one organization is creatable, forces an organization choice; `loadGovernanceUnitsAction` (RPC `v2_creatable_units`) then populates a **required** governance unit selector — `createProjectAction` returns `governance_unit_required` without one. The insert itself no longer uses the admin client: it calls the `create_project_v2` RPC on the session client so RLS and the capability resolver decide, writing the project, its `multi_pmo_v2` contract and one owner assignment in a single transaction (`42501` surfaces as `not_authorized`). Afterwards `createCharterForProject` and, if "use template" is ticked, `instantiateTemplate` run best-effort; a failure there is logged but never loses the project. Related: screen-project-overview, screen-import, screen-home-dashboard.
Source: projects/page.tsx, project-list-client.tsx, actions.ts, create-project-dialog.tsx.
Verify: open Projects from the navigation and press create — the governance unit field must be filled before Save succeeds.

# ES: Pantalla Lista de proyectos

El portafolio de la organización en `/projects`, accesible desde la navegación principal. La página de servidor consulta `projects` limitada a la organización actual (excluyendo eliminados, más recientes primero) y resuelve etiquetas de estado con next-intl. `ProjectListClient` muestra un botón de crear que abre `CreateProjectDialog` y, después, un estado vacío o una cuadrícula de tarjetas `ProjectCard` que enlazan a `/projects/{id}`. Cada tarjeta muestra una insignia de estado y la fecha de inicio; el icono de tres puntos que aparece al pasar el cursor es decorativo — no hay menú en la tarjeta — y el título se lee de `title_i18n.en` sin importar el idioma activo, por lo que un proyecto solo en español acaba mostrando su slug. La creación ahora está gobernada: el diálogo llama primero a `loadProjectCreationScopeAction` (RPC `v2_creatable_organizations`) y, si hay más de una organización disponible, obliga a elegir una; luego `loadGovernanceUnitsAction` (RPC `v2_creatable_units`) llena un selector de unidad de gobernanza **obligatorio**, ya que `createProjectAction` devuelve `governance_unit_required` si falta. La inserción ya no usa el cliente admin: invoca el RPC `create_project_v2` sobre el cliente de sesión para que decidan RLS y el resolutor de capacidades, escribiendo el proyecto, su contrato `multi_pmo_v2` y una asignación de owner en una sola transacción (`42501` se traduce a `not_authorized`). Después se ejecutan `createCharterForProject` y, si se marcó usar plantilla, `instantiateTemplate`, ambos con tolerancia a fallos: un error se registra pero nunca pierde el proyecto. Relacionadas: screen-project-overview, screen-import, screen-home-dashboard.
Fuente: projects/page.tsx, project-list-client.tsx, actions.ts, create-project-dialog.tsx.
Verifica: abre Proyectos desde la navegación y pulsa crear — la unidad de gobernanza debe estar seleccionada para que Guardar funcione.
