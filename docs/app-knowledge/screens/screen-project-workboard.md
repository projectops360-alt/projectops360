---
slug: screen-project-workboard
route: /projects/[projectId]/workboard
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/workboard/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/workboard/workboard-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/roadmap/actions.ts
  - src/lib/roadmap/topological-sort.ts
  - src/lib/subtasks/map-model.ts
  - src/lib/delivery/config.ts
---

# EN: Project Workboard screen

The Kanban execution board, reached from the project's Workboard tab. Columns map to TaskStatus values (not_started, prompt_ready, sent_to_ai, in_progress, implemented, tested, done, blocked, deferred); labels adapt to the project's delivery framework via workboardColumnLabels, but the board always operates on the same statuses. Tasks are topologically sorted so predecessors appear before successors, grouped by milestone. Cards show owner (assigned_to person or assigned_resource_id crew/vendor, names resolved via the admin client from profiles, project_team_members and resources), priority (p1–p3), dependencies and subtask badges (blocked/overdue/done, aggregated from task_subtasks) plus a link to the Task Execution Map. Drag-and-drop calls updateTaskStatusAction and reorderTasksAction in roadmap/actions.ts; a move can fail with dependency_not_met if a predecessor is not done, and a status-change dialog captures an optional note (a blocked move stores blocker_reason — Blocked is an explicit impediment, distinct from waiting on a dependency). Other actions: create/edit tasks via TaskFormDialog (createTaskAction/updateTaskAction), delete (archiveTaskAction), filter by sprint or milestone, column visibility, collapse and resize. Reads projects, milestones, roadmap_tasks, task_dependencies, task_subtasks and project_delivery_frameworks; writes roadmap_tasks through the roadmap server actions. Related screens: Task Execution Map, Execution Map (roadmap), Command Center.
Source: workboard/page.tsx, workboard/workboard-client.tsx, roadmap/actions.ts.
Verify: open a project, then the Workboard tab.

# ES: Pantalla Workboard del proyecto

El tablero Kanban de ejecución; se llega desde la pestaña Workboard del proyecto. Las columnas corresponden a los estados de tarea (not_started, prompt_ready, sent_to_ai, in_progress, implemented, tested, done, blocked, deferred); las etiquetas se adaptan al marco de ejecución del proyecto con workboardColumnLabels, pero el tablero siempre opera sobre los mismos estados. Las tareas se ordenan topológicamente (predecesoras antes que sucesoras) y se agrupan por hito. Las tarjetas muestran responsable (persona en assigned_to o recurso/equipo en assigned_resource_id, con nombres resueltos desde profiles, project_team_members y resources), prioridad (p1–p3), dependencias e insignias de subtareas (bloqueadas/vencidas/hechas desde task_subtasks), con enlace al Mapa de Ejecución de la tarea. Arrastrar y soltar llama a updateTaskStatusAction y reorderTasksAction en roadmap/actions.ts; el movimiento puede fallar con dependency_not_met si una predecesora no está terminada, y un diálogo permite añadir una nota (al bloquear se guarda blocker_reason: bloqueado es un impedimento explícito, distinto de esperar una dependencia). También permite crear/editar tareas (TaskFormDialog), eliminarlas (archiveTaskAction), filtrar por sprint o hito y ajustar columnas. Lee projects, milestones, roadmap_tasks, task_dependencies, task_subtasks y project_delivery_frameworks; escribe en roadmap_tasks mediante las acciones de servidor de roadmap. Relacionadas: Mapa de Ejecución de tarea, Execution Map, Command Center.
Fuente: workboard/page.tsx, workboard/workboard-client.tsx, roadmap/actions.ts.
Verifica: abre un proyecto y entra a la pestaña Workboard.
