---
slug: screen-project-workboard
route: /projects/[projectId]/workboard
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/workboard/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/workboard/workboard-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/roadmap/actions.ts
  - src/lib/workboard/milestone-filter.ts
  - src/lib/workboard/density.ts
  - src/lib/workboard/task-schemas.ts
  - src/lib/roadmap/topological-sort.ts
  - src/lib/subtasks/map-model.ts
  - src/lib/delivery/config.ts
---

# EN: Project Workboard screen

The Kanban execution board, reached from the project's Workboard tab. Columns map to the nine `TaskStatus` values (not_started, prompt_ready, sent_to_ai, in_progress, implemented, tested, done, blocked, deferred); `workboardColumnLabels` relabels them for the project's delivery method, but the board always operates on the same statuses. `topologicalSortTasks` puts predecessors before successors, grouped by milestone. Cards show owner (`assigned_to` person or `assigned_resource_id` crew, names resolved with the admin client from `profiles`, `project_team_members` and `resources`), priority, dependencies, subtask badges from `task_subtasks`, and a link to the Task Execution Map. The filter bar toggles Sprint/Milestone; `milestoneFilterOptions` now lists **every** milestone with its task count, including zero-count ones — previously only milestones that already had tasks appeared, which circularly hid the gates you needed to plan into — and `isEmptyByMilestoneFilter` renders an explicit "This milestone has no tasks planned yet" panel instead of a blank board. A density toggle (`density.ts`, Compact = 212px columns, UX-013) avoids browser zoom. Drag-and-drop calls `updateTaskStatusAction` and `reorderTasksAction`; a move can fail with `dependency_not_met`. `updateTaskAction` can move a task to another `milestone_id` and recalculates both milestones — but note it does **not** write the `task_milestone_reassignments` audit table, which exists in migration `20260907000000` with no code reading or writing it yet. Reads `projects`, `milestones`, `roadmap_tasks`, `task_dependencies`, `task_subtasks`, `project_delivery_frameworks`. Related: screen-project-task-detail, screen-execution-map, screen-project-overview.
Source: workboard/page.tsx, workboard-client.tsx, roadmap/actions.ts, lib/workboard/milestone-filter.ts.
Verify: open a project → Workboard tab → switch the filter to Milestone and look for a chip with a `0` count.

# ES: Pantalla Workboard del proyecto

El tablero Kanban de ejecución; se llega desde la pestaña Workboard del proyecto. Las columnas corresponden a los nueve valores de `TaskStatus` (not_started, prompt_ready, sent_to_ai, in_progress, implemented, tested, done, blocked, deferred); `workboardColumnLabels` cambia las etiquetas según el método de entrega, pero el tablero siempre opera sobre los mismos estados. `topologicalSortTasks` coloca las predecesoras antes que las sucesoras, agrupadas por hito. Las tarjetas muestran responsable (`assigned_to` persona o `assigned_resource_id` cuadrilla, con nombres resueltos mediante el cliente admin desde `profiles`, `project_team_members` y `resources`), prioridad, dependencias, insignias de subtareas desde `task_subtasks` y un enlace al Mapa de Ejecución de la tarea. La barra de filtros alterna Sprint/Hito; `milestoneFilterOptions` ahora lista **todos** los hitos con su conteo de tareas, incluidos los que tienen cero — antes solo aparecían los hitos que ya tenían tareas, lo que ocultaba de forma circular las compuertas donde hacía falta planificar — e `isEmptyByMilestoneFilter` muestra un aviso explícito ("Este hito todavía no tiene tareas planificadas") en lugar de un tablero vacío. Un botón de densidad (`density.ts`, Compacto = columnas de 212px, UX-013) evita usar el zoom del navegador. Arrastrar y soltar llama a `updateTaskStatusAction` y `reorderTasksAction`; el movimiento puede fallar con `dependency_not_met`. `updateTaskAction` puede mover una tarea a otro `milestone_id` y recalcula ambos hitos, pero **no** escribe la tabla de auditoría `task_milestone_reassignments`, que existe en la migración `20260907000000` sin código que la lea ni la escriba. Lee `projects`, `milestones`, `roadmap_tasks`, `task_dependencies`, `task_subtasks` y `project_delivery_frameworks`. Relacionadas: screen-project-task-detail, screen-execution-map, screen-project-overview.
Fuente: workboard/page.tsx, workboard-client.tsx, roadmap/actions.ts, lib/workboard/milestone-filter.ts.
Verifica: abre un proyecto → pestaña Workboard → cambia el filtro a Hito y busca un chip con conteo `0`.
