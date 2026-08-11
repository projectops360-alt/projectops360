---
slug: screen-living-graph
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/living-graph/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/living-graph/actions.ts
  - src/components/graph/living-graph-view.tsx
  - src/components/graph/living-graph-toolbar.tsx
  - src/components/graph/milestone-kpi-context-menu.tsx
  - src/components/graph/milestone-metrics-picker.tsx
  - src/lib/roadmap/living-graph-sync.ts
  - src/lib/roadmap/milestone-cost-rollup.ts
  - src/lib/kpi/load-milestone-kpis.ts
  - src/lib/kpi/milestone-pin-actions.ts
---

# EN: Living Graph screen

The Living Graph is the project's visual digital twin (ADR-002), reached from the Execution Map's "Living Graph" tab button. The server page validates org ownership, removes orphan nodes (`removeOrphanGraphNodes`), then loads `process_nodes`, `process_edges`, `milestones`, `roadmap_tasks`, `task_subtasks`, `project_task_attachments`, the `get_process_timeline` RPC, the labor tables (`labor_resources`, `construction_activities`, `activity_dependencies`, `trade_taxonomy`), and — new — `budget_items` and `resources` for cost. Node labels come from the canonical owners, and a completed task is never shown blocked (REG-008). Server engines: labor capacity, lookahead, labor and productivity variance, variance-cause classification and `computeResourceCapacity`. Beyond the classic operational views it now offers five view levels — milestones, activities, events (a read-only canonical-event projection with an explicit disabled/empty/ready/error/truncated banner), knowledge and trust (the Trust lens is off unless its flag is set) — plus the overlays normal, bottleneck, criticalPath, rework, traceabilityGap, risk, sopCandidate, blocker, timeline, simulation, laborCapacity, readiness, variance and workforceCapacity. At the milestones level, `computeMilestoneCostRollups` derives per-milestone hours, duration, budget and spend; a metrics picker chooses which of those appear on a card (default none), and right-clicking a milestone card pins up to eight KPIs into `milestone_kpi_pins` — the same pins the Gantt shows. Layouts persist in localStorage; Recalculate re-runs `backfill_living_graph`. Related: screen-execution-map, screen-execution-map-kpis, screen-living-graph-realtime, screen-milestone-flow.
Source: living-graph/page.tsx, components/graph/living-graph-view.tsx, lib/roadmap/milestone-cost-rollup.ts, lib/kpi/milestone-pin-actions.ts.
Verify: Execution Map > "Living Graph" (/projects/[projectId]/execution-map/living-graph), then right-click a milestone card.

# ES: Pantalla Grafo Vivo

El Grafo Vivo es el gemelo digital visual del proyecto (ADR-002) y se abre desde el botón "Grafo Vivo" del Mapa de Ejecución. La página de servidor valida la pertenencia a la organización, elimina nodos huérfanos (`removeOrphanGraphNodes`) y carga `process_nodes`, `process_edges`, `milestones`, `roadmap_tasks`, `task_subtasks`, `project_task_attachments`, el RPC `get_process_timeline`, las tablas laborales (`labor_resources`, `construction_activities`, `activity_dependencies`, `trade_taxonomy`) y —novedad— `budget_items` y `resources` para el coste. Las etiquetas provienen de los dueños canónicos y una tarea completada nunca aparece bloqueada (REG-008). Motores en servidor: capacidad laboral, lookahead, varianza laboral y de productividad, clasificación de causas y `computeResourceCapacity`. Además de las vistas operativas clásicas hay cinco niveles: hitos, actividades, eventos (proyección de solo lectura del registro canónico, con un aviso explícito de estado desactivado/vacío/listo/error/truncado), conocimiento y confianza (esta última desactivada salvo que su bandera esté activa), junto con las superposiciones normal, cuello de botella, ruta crítica, retrabajo, brecha de trazabilidad, riesgo, candidato a SOP, bloqueos, línea de tiempo, simulación, capacidad laboral, preparación, varianza y capacidad de fuerza de trabajo. En el nivel de hitos, `computeMilestoneCostRollups` calcula horas, duración, presupuesto y gasto por hito; un selector decide cuáles aparecen en la tarjeta (por omisión, ninguno) y el clic derecho sobre una tarjeta fija hasta ocho KPIs en `milestone_kpi_pins`, los mismos que muestra el Cronograma. Los diseños se guardan en localStorage; Recalcular reejecuta `backfill_living_graph`. Relacionadas: screen-execution-map, screen-execution-map-kpis, screen-living-graph-realtime, screen-milestone-flow.
Fuente: living-graph/page.tsx, components/graph/living-graph-view.tsx, lib/roadmap/milestone-cost-rollup.ts, lib/kpi/milestone-pin-actions.ts.
Verifica: Mapa de Ejecución > "Grafo Vivo" (/projects/[projectId]/execution-map/living-graph) y haz clic derecho en la tarjeta de un hito.
