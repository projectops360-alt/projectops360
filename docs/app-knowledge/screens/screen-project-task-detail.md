---
slug: screen-project-task-detail
route: /projects/[projectId]/tasks/[taskId]
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/tasks/[taskId]/page.tsx
  - src/components/task-execution-map/execution-map-client.tsx
  - src/lib/subtasks/actions.ts
  - src/lib/subtasks/map-model.ts
  - src/lib/people/service.ts
---

# EN: Task Execution Map (task detail) screen

The drill-down for one task, reached from a Workboard card's Execution Map link; a "Back to Workboard" breadcrumb returns there. Where the Living Graph is the project-level visualization, this is the task-level mind map: a parent node (title, status, progress, owner, critical flag, estimate vs actual hours), its subtasks, and its external predecessor tasks drawn as dotted dependency nodes. The server page reads one `roadmap_tasks` row, its `task_subtasks` (sorted by `sort_order` then `created_at`), the `task_dependencies` rows where this task is the successor, then the predecessor titles. Owner display names come from `profiles` through the admin client — names only, because RLS hides other users' rows and an assignee may be a cross-org member. The assignable-owner dropdown comes from `getAssignableProjectOwners` (org workspace users plus project team members) merged with everyone currently assigned, so the real owner is never missing from the list even after leaving the team. `ExecutionMapClient` offers a canvas view and a table view, a subtask detail panel and a form dialog. Writes go through `lib/subtasks/actions.ts`: create, update, complete, block/unblock with a reason (an explicit impediment, distinct from waiting on a dependency), reassign, delete, override or clear the parent's calculated progress, and close the parent with incomplete subtasks. Editing requires org `owner` or `admin` (`canManage`); `viewer` cannot upload. Related: screen-project-workboard, screen-execution-map, screen-living-graph.
Source: tasks/[taskId]/page.tsx, components/task-execution-map/execution-map-client.tsx, lib/subtasks/actions.ts.
Verify: Workboard → open a card's Execution Map link.

# ES: Pantalla Mapa de Ejecución de tarea (detalle de tarea)

El detalle de una tarea; se llega desde el enlace Execution Map de una tarjeta del Workboard, con una miga "Volver al Workboard" para regresar. Mientras el Grafo Vivo es la visualización a nivel de proyecto, esta es el mapa mental de UNA tarea: un nodo padre (título, estado, progreso, responsable, marca de ruta crítica, horas estimadas y reales), sus subtareas y sus tareas predecesoras externas dibujadas como nodos punteados de dependencia. La página de servidor lee una fila de `roadmap_tasks`, sus `task_subtasks` (ordenadas por `sort_order` y luego `created_at`), las filas de `task_dependencies` donde esta tarea es la sucesora y después los títulos de las predecesoras. Los nombres de responsables provienen de `profiles` mediante el cliente admin — solo nombres, porque RLS oculta las filas de otros usuarios y un asignado puede pertenecer a otra organización. La lista de responsables asignables sale de `getAssignableProjectOwners` (usuarios del workspace más miembros del equipo del proyecto) combinada con quienes ya están asignados, de modo que el responsable real nunca desaparece del desplegable aunque haya dejado el equipo. `ExecutionMapClient` ofrece vista de lienzo y de tabla, panel de detalle y formulario de subtareas. Las escrituras pasan por `lib/subtasks/actions.ts`: crear, actualizar, completar, bloquear y desbloquear con motivo (un impedimento explícito, distinto de esperar una dependencia), reasignar, eliminar, sobrescribir o limpiar el progreso calculado del padre y cerrar el padre con subtareas incompletas. Editar exige rol `owner` o `admin` (`canManage`); un `viewer` no puede subir archivos. Relacionadas: screen-project-workboard, screen-execution-map, screen-living-graph.
Fuente: tasks/[taskId]/page.tsx, components/task-execution-map/execution-map-client.tsx, lib/subtasks/actions.ts.
Verifica: Workboard → enlace Execution Map de una tarjeta de tarea.
