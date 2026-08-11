---
slug: screen-project-overview
route: /projects/[projectId]
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/dashboard-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/project-header-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/project-detail-client.tsx
  - src/app/[locale]/(app)/projects/actions.ts
  - src/lib/time-tracking/project-effort.ts
  - src/lib/project-briefing/briefing-engine.ts
  - src/lib/roadmap/progress.ts
---

# EN: Project Overview (Command Center) screen

The project home, reached by opening any project from the projects list. `ProjectHeaderClient` shows title, status, type and dates with Edit and Archive; owners and admins additionally get **Delete permanently**, a two-step dialog that first calls `getProjectDeletionImpactAction` to show exactly how many tasks, milestones, dependencies and `project_event_log` rows will be destroyed, then `deleteProjectPermanentlyAction` — the only sanctioned way to remove append-only event-log rows, recorded in `compliance_archive.project_purges`. Below sit three navigation strips: Charter & Governance (status, completion %, locked state), Delivery Framework (method, active cycle, open scope-creep alerts — hidden entirely when no framework row exists) and Team & Roles (member count, missing critical roles, score). An AI Communication Summary generates on demand. `ProjectDashboard` renders stat cards, recent-item lists, unresolved action items, traceability health, a roadmap snapshot, an effort block (estimated / logged / remaining / variance from `getProjectEffortSummary`, where actual hours are summed from `subtask_time_entries` and never typed in) and a deterministic Status card built with `buildProjectBriefing` (REG-013/REG-015) where waiting on a dependency is never counted as blocked. Reads `projects`, `project_charters`, `project_delivery_frameworks`, `project_scope_creep_alerts`, `project_execution_cycles`, `communication_items`, `meetings`, `decisions`, `documents`, `action_items`, `milestones`, `roadmap_tasks`, `task_dependencies`, `risks`, `traceability_links`. Related: screen-project-workboard, screen-project-status, screen-project-charter, screen-project-delivery, screen-project-team.
Source: projects/[projectId]/page.tsx, dashboard-client.tsx, project-header-client.tsx, lib/project-briefing/briefing-engine.ts.
Verify: open a project from the projects list; the Command Center is the landing tab.

# ES: Pantalla Resumen del Proyecto (Command Center)

La página de inicio del proyecto; se llega al abrir cualquier proyecto desde la lista. `ProjectHeaderClient` muestra título, estado, tipo y fechas con Editar y Archivar; además, los roles owner y admin ven **Eliminar permanentemente**, un diálogo de dos pasos que primero llama a `getProjectDeletionImpactAction` para mostrar cuántas tareas, hitos, dependencias y filas de `project_event_log` se destruirán, y luego a `deleteProjectPermanentlyAction`: la única vía autorizada para borrar filas del registro de eventos de solo anexado, que queda asentada en `compliance_archive.project_purges`. Debajo hay tres franjas de navegación: Charter y Gobernanza (estado, % de completitud, si está aprobado), Marco de Ejecución (método, ciclo activo, alertas de scope creep abiertas; se oculta por completo si no existe la fila del marco) y Equipo y Roles (miembros, roles críticos faltantes, puntaje). El Resumen de Comunicaciones con IA se genera bajo demanda. `ProjectDashboard` muestra tarjetas de conteo, listas de elementos recientes, acciones sin resolver, salud de trazabilidad, un snapshot del roadmap, un bloque de esfuerzo (estimado / registrado / restante / variación desde `getProjectEffortSummary`, donde las horas reales se suman de `subtask_time_entries` y nunca se escriben a mano) y una tarjeta de Estado determinista calculada con `buildProjectBriefing` (REG-013/REG-015), donde esperar una dependencia nunca cuenta como bloqueo. Lee `projects`, `project_charters`, `project_delivery_frameworks`, `project_scope_creep_alerts`, `project_execution_cycles`, `communication_items`, `meetings`, `decisions`, `documents`, `action_items`, `milestones`, `roadmap_tasks`, `task_dependencies`, `risks` y `traceability_links`. Relacionadas: screen-project-workboard, screen-project-status, screen-project-charter, screen-project-delivery, screen-project-team.
Fuente: projects/[projectId]/page.tsx, dashboard-client.tsx, project-header-client.tsx, lib/project-briefing/briefing-engine.ts.
Verifica: abre un proyecto desde la lista; el Command Center es la pestaña inicial.
