---
slug: screen-resource-capacity
route: /projects/[projectId]/resource-capacity
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/resource-capacity/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/resource-capacity/capacity-editor.tsx
  - src/app/[locale]/(app)/projects/[projectId]/resource-capacity/actions.ts
  - src/lib/capacity/service.ts
  - src/lib/capacity/insight.ts
---

# EN: Resource Capacity Intelligence screen

The Resource Capacity Intelligence screen (pillar P3, CAP-009) answers "do we have enough real workforce capacity to deliver the plan?", at /projects/[projectId]/resource-capacity. The server page runs the deterministic engine `computeResourceCapacity` (lib/capacity/service, 4-week window), which reads `project_resource_allocations` plus team/task/milestone data, and adapts its wording per project type (construction types say "Crew", software says "Resource"). Eight overview cards show Health Index (with band color), effective vs nominal capacity, assigned workload with average utilization, remaining hours, overallocated hours, workforce availability with overhead percent, bottleneck count and at-risk milestones. The Capacity Editor lets PM/PMO users add team members as allocations and edit weekly capacity hours, availability percent, overhead percent and role inline, via `getCapacityEditorDataAction`, `saveAllocationAction` and `removeAllocationAction` (writes to `project_resource_allocations`). A PMO Summary section (deterministic `buildCapacitySummary` from lib/capacity/insight) presents a headline, bullets, bottlenecks, missing-data warnings and recommended actions explicitly labeled as requiring your approval. Below are the per-resource capacity table (effective, assigned, remaining, utilization, overhead, status), a milestone capacity-risk section and a health-deductions breakdown explaining every point subtracted. The same engine feeds the Living Graph's workforceCapacity overlay. Related: screen-living-graph, screen-labor-capacity.
Source: resource-capacity/page.tsx, capacity-editor.tsx, actions.ts, lib/capacity/service.ts.
Verify: open a project > Resource Capacity (/projects/[projectId]/resource-capacity).

# ES: Pantalla Inteligencia de Capacidad de Recursos

La pantalla Inteligencia de Capacidad de Recursos (pilar P3, CAP-009) responde "¿tenemos capacidad real de fuerza de trabajo para entregar el plan?", en /projects/[projectId]/resource-capacity. La página de servidor ejecuta el motor determinista `computeResourceCapacity` (lib/capacity/service, ventana de 4 semanas), que lee `project_resource_allocations` junto con datos de equipo, tareas e hitos, y adapta la terminología por tipo de proyecto (en construcción dice "Cuadrilla"; en software, "Recurso"). Ocho tarjetas muestran el Índice de Salud (con color por banda), capacidad efectiva vs nominal, carga asignada con utilización promedio, horas restantes, horas sobreasignadas, disponibilidad con porcentaje de overhead, cuellos de botella e hitos en riesgo. El Editor de Capacidad permite a PM/PMO agregar miembros del equipo como asignaciones y editar en línea horas semanales, porcentaje de disponibilidad, porcentaje de overhead y rol, mediante `getCapacityEditorDataAction`, `saveAllocationAction` y `removeAllocationAction` (escribe en `project_resource_allocations`). La sección Resumen PMO (determinista, `buildCapacitySummary` de lib/capacity/insight) presenta un titular, viñetas, cuellos de botella, advertencias de datos faltantes y acciones recomendadas marcadas explícitamente como sujetas a tu aprobación. Debajo están la tabla de capacidad por recurso (efectiva, asignada, restante, utilización, overhead, estado), la sección de riesgo de capacidad por hito y el desglose de deducciones del índice de salud, que explica cada punto restado. El mismo motor alimenta la superposición de capacidad de fuerza de trabajo del Grafo Vivo. Relacionadas: screen-living-graph, screen-labor-capacity.
Fuente: resource-capacity/page.tsx, capacity-editor.tsx, actions.ts, lib/capacity/service.ts.
Verifica: abre un proyecto > Capacidad de Recursos (/projects/[projectId]/resource-capacity).
