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
  - src/components/roadmap/gantt-roadmap.tsx
  - src/components/roadmap/cash-flow-panel.tsx
  - src/lib/kpi/load-milestone-kpis.ts
  - src/lib/kpi/milestone-pin-actions.ts
  - src/lib/roadmap/gantt-zoom.ts
---

# EN: Execution Map screen

The Execution Map is a project's roadmap and execution hub. The server page reads `projects`, `milestones`, `roadmap_tasks` and `task_dependencies`, computes progress (`computeRoadmapProgress`), a next step (`computeNextStep`) and a topological task order, then calls `loadMilestoneKpis`, which reads `milestone_kpi_pins`, `kpi_definitions`, `budget_items` and `resources` so a pinned KPI reads identically here and in the Living Graph. Six tabs render inline: Overview (`RoadmapHero`, `NextStepPanel`, `ExecutionDashboard`), Timeline, Tasks (status changes, edit/archive, reorder milestones, add predecessors), Gantt, Critical Path and Dependencies. Critical Path renders no chart — it is a panel whose button opens the Living Graph with `?overlay=criticalPath`. The Gantt now has real zoom (Fit/Quarter/Month/Week/Day, auto-chosen from plan length via `gantt-zoom.ts`), draggable bars calling `updateTaskDatesAction`, a dashed "Original plan" ghost bar drawn from `roadmap_tasks.baseline_start_date/baseline_end_date` with a drift count, and right-click on a milestone row to pin up to eight KPIs (`pinKpiToMilestone`/`unpinKpiFromMilestone`, writing `milestone_kpi_pins`). Below it, `CashFlowPanel` plots monthly planned/baseline/spent cost. No screen writes the baseline columns — they are read-only until something populates them. Header buttons create tasks and milestones. Five extra tab buttons navigate to living-graph, milestone-flow, variants, root-causes and kpis. Related: screen-living-graph, screen-milestone-flow, screen-execution-map-kpis, screen-project-roadmap.
Source: execution-map/page.tsx, execution-map-client.tsx, components/roadmap/gantt-roadmap.tsx, lib/kpi/load-milestone-kpis.ts.
Verify: open a project and go to Execution Map (/projects/[projectId]/execution-map), then the "Gantt" tab.

# ES: Pantalla Mapa de Ejecución

El Mapa de Ejecución es el centro de hoja de ruta y ejecución del proyecto. La página de servidor lee `projects`, `milestones`, `roadmap_tasks` y `task_dependencies`, calcula el progreso (`computeRoadmapProgress`), el siguiente paso (`computeNextStep`) y un orden topológico de tareas, y luego llama a `loadMilestoneKpis`, que consulta `milestone_kpi_pins`, `kpi_definitions`, `budget_items` y `resources` para que un KPI fijado se lea igual aquí y en el Grafo Vivo. Seis pestañas se muestran en la misma página: Vista General (`RoadmapHero`, `NextStepPanel`, `ExecutionDashboard`), Línea de Tiempo, Tareas (cambio de estado, editar y archivar, reordenar hitos, añadir predecesoras), Cronograma, Ruta Crítica y Dependencias. Ruta Crítica no dibuja nada: es un panel cuyo botón abre el Grafo Vivo con `?overlay=criticalPath`. El Cronograma ya tiene zoom real (Todo/Trimestre/Mes/Semana/Día, elegido automáticamente según la duración del plan mediante `gantt-zoom.ts`), barras arrastrables que llaman a `updateTaskDatesAction`, una barra fantasma punteada de "Plan inicial" tomada de `roadmap_tasks.baseline_start_date/baseline_end_date` con recuento de desviación, y clic derecho sobre la fila de un hito para fijar hasta ocho KPIs (`pinKpiToMilestone`/`unpinKpiFromMilestone`, que escriben en `milestone_kpi_pins`). Debajo, `CashFlowPanel` grafica el coste mensual planificado, de línea base y gastado. Ninguna pantalla escribe las columnas de línea base: hoy solo se leen. Los botones del encabezado crean tareas e hitos. Cinco botones adicionales navegan a living-graph, milestone-flow, variants, root-causes y kpis. Relacionadas: screen-living-graph, screen-milestone-flow, screen-execution-map-kpis, screen-project-roadmap.
Fuente: execution-map/page.tsx, execution-map-client.tsx, components/roadmap/gantt-roadmap.tsx, lib/kpi/load-milestone-kpis.ts.
Verifica: abre un proyecto, entra a Mapa de Ejecución (/projects/[projectId]/execution-map) y luego a la pestaña "Cronograma".
