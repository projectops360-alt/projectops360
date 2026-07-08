---
slug: screen-execution-map
route: /projects/[projectId]/execution-map
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/execution-map-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/dependency-actions.ts
  - src/app/[locale]/(app)/projects/[projectId]/roadmap/actions.ts
---

# EN: Execution Map screen

The Execution Map is the roadmap/execution hub of a project, reached from the project navigation at /projects/[projectId]/execution-map. The server page loads the project, its milestones, roadmap tasks and task dependencies (tables `projects`, `milestones`, `roadmap_tasks`, `task_dependencies`), computes overall progress (`computeRoadmapProgress`), a recommended next step (`computeNextStep`), and sorts tasks topologically by dependency within milestone order. The client renders six tabs: Overview (RoadmapHero with phase/progress/blockers, NextStepPanel with actions such as resolve blocker or mark completed, and an ExecutionDashboard of status counts), Timeline (VisualRoadmapTimeline), Tasks (TaskListByMilestone with status updates, AI-prompt copy, edit/archive of tasks and milestones, reorder milestones, add predecessors), Gantt (GanttRoadmap where dragging task bars calls `updateTaskDatesAction`), Critical Path (a pointer panel that redirects to the Living Graph, where critical path actually renders), and Dependencies (DependenciesView backed by `createDependencyAction`, `deleteDependencyAction`, `getDependenciesAction` in dependency-actions.ts). Header buttons open dialogs to create tasks and milestones (actions in the sibling roadmap/actions.ts). Two extra tab buttons navigate to the Living Graph and Milestone Flow routes, which live on their own pages. Related screens: screen-living-graph, screen-milestone-flow, screen-living-graph-realtime.
Source: execution-map/page.tsx, execution-map-client.tsx, dependency-actions.ts.
Verify: open a project and go to Execution Map (/projects/[projectId]/execution-map).

# ES: Pantalla Mapa de Ejecución

El Mapa de Ejecución es el centro de hoja de ruta y ejecución del proyecto, accesible desde la navegación del proyecto en /projects/[projectId]/execution-map. La página de servidor carga el proyecto, sus hitos, tareas y dependencias (tablas `projects`, `milestones`, `roadmap_tasks`, `task_dependencies`), calcula el progreso general (`computeRoadmapProgress`), el siguiente paso recomendado (`computeNextStep`) y ordena las tareas topológicamente según dependencias. El cliente muestra seis pestañas: Vista General (RoadmapHero con fase, progreso y bloqueos; NextStepPanel con acciones como resolver bloqueo o marcar completada; y un panel ExecutionDashboard con conteos por estado), Línea de Tiempo, Tareas (lista por hito con cambio de estado, copia de prompts de IA, edición y archivado de tareas e hitos, reordenar hitos y agregar predecesoras), Cronograma (Gantt donde arrastrar barras llama a `updateTaskDatesAction`), Ruta Crítica (un panel indicativo que redirige al Grafo Vivo, donde realmente se visualiza) y Dependencias (crear y eliminar dependencias con las acciones de dependency-actions.ts). Los botones del encabezado abren diálogos para crear tareas e hitos (acciones en roadmap/actions.ts). Dos botones adicionales navegan al Grafo Vivo y al Flujo entre Hitos, que tienen sus propias rutas. Pantallas relacionadas: screen-living-graph, screen-milestone-flow, screen-living-graph-realtime.
Fuente: execution-map/page.tsx, execution-map-client.tsx, dependency-actions.ts.
Verifica: abre un proyecto y entra a Mapa de Ejecución (/projects/[projectId]/execution-map).
