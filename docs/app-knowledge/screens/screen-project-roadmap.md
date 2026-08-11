---
slug: screen-project-roadmap
route: /projects/[projectId]/roadmap
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/roadmap/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/roadmap/actions.ts
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/page.tsx
---

# EN: Project Roadmap screen (redirect to Execution Map)

The `/roadmap` route still renders no UI of its own: its `page.tsx` is nothing but a server `redirect` to `/projects/[projectId]/execution-map`, preserving the locale through `localizedHref`. Anyone who opens the Roadmap URL — a bookmark, an old link, an Isabella suggestion — lands on the Execution Map, which loads `projects`, `milestones`, `roadmap_tasks` and `task_dependencies`, computes per-milestone counts, overall progress and a recommended next step, and additionally evaluates the KPIs pinned to each milestone through `loadMilestoneKpis`. The folder nevertheless remains central, because `roadmap/actions.ts` holds the canonical server actions for the whole task and milestone domain: `createTaskAction`, `updateTaskAction` (preserve-on-absent), `updateTaskStatusAction` with `dependency_not_met` enforcement and blocker reasons, `reorderTasksAction`, `createMilestoneAction`, `updateMilestoneAction`, `reorderMilestoneAction`, `archiveTaskAction`, `archiveMilestoneAction`, `recordPromptSentAction`, `getTaskAuditTrailAction`, plus `getTaskFormOptionsAction` and `createPersonResourceAction`, which feed the task form's people, resources, team, materials and dependency pickers. Between them they read and write `milestones`, `roadmap_tasks`, `task_dependencies`, `resources`, `project_team_members`, `material_requirements`, `profiles` and `audit_logs`, always scoped by organization and project. The Workboard, the Execution Map and the Living Graph all import from here. Related: screen-execution-map, screen-project-workboard, screen-living-graph.
Source: roadmap/page.tsx (redirect only), roadmap/actions.ts, execution-map/page.tsx.
Verify: open a project and visit /projects/{id}/roadmap; the browser lands on /projects/{id}/execution-map.

# ES: Pantalla Roadmap del proyecto (redirección al Mapa de Ejecución)

La ruta `/roadmap` sigue sin tener interfaz propia: su `page.tsx` es únicamente un `redirect` de servidor a `/projects/[projectId]/execution-map`, conservando el idioma mediante `localizedHref`. Quien abra la URL del Roadmap —un marcador, un enlace antiguo o una sugerencia de Isabella— aterriza en el Mapa de Ejecución, que carga `projects`, `milestones`, `roadmap_tasks` y `task_dependencies`, calcula los conteos por hito, el progreso general y el siguiente paso recomendado, y además evalúa los KPIs fijados a cada hito con `loadMilestoneKpis`. Aun así la carpeta sigue siendo central, porque `roadmap/actions.ts` contiene las acciones de servidor canónicas de todo el dominio de tareas e hitos: `createTaskAction`, `updateTaskAction` (conserva los valores ausentes), `updateTaskStatusAction` con validación `dependency_not_met` y motivos de bloqueo, `reorderTasksAction`, `createMilestoneAction`, `updateMilestoneAction`, `reorderMilestoneAction`, `archiveTaskAction`, `archiveMilestoneAction`, `recordPromptSentAction`, `getTaskAuditTrailAction`, además de `getTaskFormOptionsAction` y `createPersonResourceAction`, que alimentan los selectores de personas, recursos, equipo, materiales y dependencias del formulario de tarea. Entre todas leen y escriben `milestones`, `roadmap_tasks`, `task_dependencies`, `resources`, `project_team_members`, `material_requirements`, `profiles` y `audit_logs`, siempre acotadas por organización y proyecto. El Workboard, el Mapa de Ejecución y el Grafo Vivo importan desde aquí. Relacionadas: screen-execution-map, screen-project-workboard, screen-living-graph.
Fuente: roadmap/page.tsx (solo redirección), roadmap/actions.ts, execution-map/page.tsx.
Verifica: abre un proyecto y visita /projects/{id}/roadmap; el navegador termina en /projects/{id}/execution-map.
