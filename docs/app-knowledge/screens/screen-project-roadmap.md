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

The /roadmap route no longer renders its own UI: its page.tsx is a server redirect that immediately sends the user to /projects/[projectId]/execution-map, preserving the locale (localizedHref + redirect). So anyone navigating to the Roadmap URL lands on the Execution Map, which loads projects, milestones, roadmap_tasks and task_dependencies, computes per-milestone task counts, overall roadmap progress (computeRoadmapProgress) and a recommended next step (computeNextStep), and renders the ExecutionMapClient with milestone/task views. Even though the roadmap page itself is only a redirect, the roadmap folder remains important: roadmap/actions.ts hosts the canonical server actions for the whole task/milestone domain — createTaskAction, updateTaskAction, updateTaskStatusAction (with dependency_not_met enforcement and blocker_reason notes), reorderTasksAction, createMilestoneAction, updateMilestoneAction, reorderMilestoneAction, archiveTaskAction, archiveMilestoneAction, recordPromptSentAction and getTaskAuditTrailAction — which the Workboard and Execution Map clients import. All of these write to the milestones and roadmap_tasks tables scoped by organization and project. Related screens: Workboard (same task data as a Kanban board), Execution Map (the actual destination), Task Execution Map, Command Center roadmap snapshot.
Source: roadmap/page.tsx (redirect), roadmap/actions.ts, execution-map/page.tsx.
Verify: open a project and visit /projects/{id}/roadmap; the browser redirects to /projects/{id}/execution-map.

# ES: Pantalla Roadmap del proyecto (redirección al Execution Map)

La ruta /roadmap ya no tiene interfaz propia: su page.tsx es una redirección de servidor que envía de inmediato a /projects/[projectId]/execution-map, conservando el idioma (localizedHref + redirect). Quien navegue a la URL del Roadmap aterriza en el Execution Map, que carga projects, milestones, roadmap_tasks y task_dependencies, calcula conteos de tareas por hito, el progreso general del roadmap (computeRoadmapProgress) y un siguiente paso recomendado (computeNextStep), y muestra el ExecutionMapClient con vistas de hitos y tareas. Aunque la página en sí solo redirige, la carpeta roadmap sigue siendo clave: roadmap/actions.ts contiene las acciones de servidor canónicas del dominio de tareas e hitos — createTaskAction, updateTaskAction, updateTaskStatusAction (con validación dependency_not_met y notas blocker_reason), reorderTasksAction, createMilestoneAction, updateMilestoneAction, reorderMilestoneAction, archiveTaskAction, archiveMilestoneAction, recordPromptSentAction y getTaskAuditTrailAction — que importan el Workboard y el Execution Map. Todas escriben en las tablas milestones y roadmap_tasks con alcance de organización y proyecto. Pantallas relacionadas: Workboard (los mismos datos como tablero Kanban), Execution Map (el destino real), Mapa de Ejecución de tarea y el snapshot del roadmap en el Command Center.
Fuente: roadmap/page.tsx (redirección), roadmap/actions.ts, execution-map/page.tsx.
Verifica: abre un proyecto y visita /projects/{id}/roadmap; el navegador redirige a /projects/{id}/execution-map.
