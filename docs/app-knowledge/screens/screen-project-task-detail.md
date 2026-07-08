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

The drill-down for one task, reached from a Workboard card's "Execution Map" link (there is a "Back to Workboard" breadcrumb). While the Living Graph is the project-level visualization, this page is the task-level execution mind map: a parent task node (title, status, progress, owner, critical flag, estimate vs actual hours), its subtasks, and its external predecessor tasks drawn as dotted dependency nodes. Progress is calculated from subtasks; the parent can be overridden. The server page loads the roadmap_tasks row, task_subtasks, task_dependencies (predecessors), owner names from profiles (admin client, names only) and the assignable-owner list via getAssignableProjectOwners (org workspace users plus project team members, always including current owners). The ExecutionMapClient offers a canvas view and a table view, a subtask detail panel and a subtask form dialog. Writes go through lib/subtasks/actions.ts: createSubtaskAction, updateSubtaskAction, completeSubtaskAction, blockSubtaskAction/unblockSubtaskAction (blocking is an explicit action with a reason — separate from dependency waiting), reassignSubtaskAction, deleteSubtaskAction, overrideParentProgressAction, clearParentProgressOverrideAction and closeParentTaskWithIncompleteAction. Managing requires org owner/admin (canManage); uploads are blocked for viewers. Related screens: Workboard, Execution Map, Living Graph.
Source: tasks/[taskId]/page.tsx, components/task-execution-map/execution-map-client.tsx, lib/subtasks/actions.ts.
Verify: Workboard → open a task card's Execution Map link.

# ES: Pantalla Mapa de Ejecución de tarea (detalle de tarea)

El detalle de una tarea; se llega desde el enlace "Execution Map" de una tarjeta del Workboard (hay una miga "Volver al Workboard"). Mientras el Living Graph es la visualización a nivel de proyecto, esta página es el mapa mental de ejecución de UNA tarea: un nodo padre (título, estado, progreso, responsable, marca de ruta crítica, horas estimadas y reales), sus subtareas y sus tareas predecesoras externas dibujadas como nodos punteados de dependencia. El progreso se calcula a partir de las subtareas; el del padre puede sobrescribirse. El servidor carga la fila de roadmap_tasks, task_subtasks, task_dependencies (predecesoras), nombres de responsables desde profiles (cliente admin, solo nombres) y la lista de responsables asignables con getAssignableProjectOwners (usuarios del workspace más miembros del equipo del proyecto, incluyendo siempre a los responsables actuales). El ExecutionMapClient ofrece vista de lienzo y de tabla, panel de detalle y formulario de subtareas. Las escrituras pasan por lib/subtasks/actions.ts: crear, actualizar, completar, bloquear/desbloquear (bloquear es una acción explícita con motivo, distinta de esperar una dependencia), reasignar y eliminar subtareas, además de sobrescribir o limpiar el progreso del padre y cerrar el padre con subtareas incompletas. Gestionar requiere rol owner/admin; los viewers no pueden subir archivos. Relacionadas: Workboard, Execution Map, Living Graph.
Fuente: tasks/[taskId]/page.tsx, components/task-execution-map/execution-map-client.tsx, lib/subtasks/actions.ts.
Verifica: Workboard → enlace Execution Map de una tarjeta de tarea.
