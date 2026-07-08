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
  - src/lib/project-briefing/briefing-engine.ts
  - src/lib/roadmap/progress.ts
---

# EN: Project Overview (Command Center) screen

This is the project home, reached by opening any project from the projects list. The header shows title, status, type and dates, with Edit and Archive actions. Below it sit three navigation strips: Charter & Governance (status, completion %, locked/approved state, links to /charter), Delivery Framework (method, active cycle, open scope-creep alert count, links to /delivery) and Team & Roles (member count, missing critical roles, completeness score, links to /team). An AI Communication Summary section generates an on-demand summary of communications and decisions. The main ProjectDashboard renders stat cards (communications, meetings, decisions, documents, action items, links), recent-item lists, unresolved action items, traceability health with missing-link entities, a roadmap snapshot (current/next milestone, blocked and upcoming tasks) and a deterministic Status card built client-side with buildProjectBriefing — the same engine Isabella's briefing uses (REG-013/REG-015), where waiting on a dependency is never counted as blocked. "Resolve now" on a blocker only navigates to the task in the Workboard editor; it never mutates. Reads Supabase tables: projects, project_charters, project_delivery_frameworks, project_scope_creep_alerts, project_execution_cycles, communication_items, meetings, decisions, documents, action_items, milestones, roadmap_tasks, task_dependencies, risks, traceability_links. Related screens: Workboard, Status, Charter, Delivery, Team, Closeout, Export.
Source: src/app/[locale]/(app)/projects/[projectId]/page.tsx, dashboard-client.tsx, src/lib/project-briefing/briefing-engine.ts.
Verify: open a project from the projects list; the Command Center is the landing tab.

# ES: Pantalla Resumen del Proyecto (Command Center)

Es la página de inicio del proyecto; se llega al abrir cualquier proyecto desde la lista. El encabezado muestra título, estado, tipo y fechas, con acciones de editar y archivar. Debajo hay tres franjas de navegación: Charter y Gobernanza (estado, % de completitud, si está aprobado/bloqueado; enlaza a /charter), Marco de Ejecución (método, ciclo activo, alertas de scope creep abiertas; enlaza a /delivery) y Equipo y Roles (miembros, roles críticos faltantes, puntaje; enlaza a /team). La sección de Resumen de Comunicaciones con IA genera bajo demanda un resumen de comunicaciones y decisiones. El panel principal muestra tarjetas de conteo (comunicaciones, reuniones, decisiones, documentos, acciones, enlaces), listas de elementos recientes, acciones sin resolver, salud de trazabilidad con entidades sin enlaces, un snapshot del roadmap (hito actual/siguiente, tareas bloqueadas y próximas) y una tarjeta de Estado determinista calculada con buildProjectBriefing, el mismo motor del briefing de Isabella (REG-013/REG-015): esperar una dependencia nunca cuenta como bloqueado. "Resolver ahora" solo navega a la tarea en el Workboard; nunca modifica datos. Lee las tablas projects, project_charters, project_delivery_frameworks, project_scope_creep_alerts, project_execution_cycles, communication_items, meetings, decisions, documents, action_items, milestones, roadmap_tasks, task_dependencies, risks y traceability_links. Pantallas relacionadas: Workboard, Estado, Charter, Delivery, Equipo, Cierre, Exportación.
Fuente: src/app/[locale]/(app)/projects/[projectId]/page.tsx, dashboard-client.tsx, src/lib/project-briefing/briefing-engine.ts.
Verifica: abre un proyecto desde la lista de proyectos; el Command Center es la pestaña inicial.
