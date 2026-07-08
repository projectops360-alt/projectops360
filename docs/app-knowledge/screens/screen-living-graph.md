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
  - src/lib/roadmap/living-graph-sync.ts
---

# EN: Living Graph screen

The Living Graph is the project's visual digital twin and primary intelligence surface (ADR-002), reached from the Execution Map's "Living Graph" tab button. The server page validates org ownership, auto-cleans orphan graph nodes (`removeOrphanGraphNodes`), then loads `process_nodes`, `process_edges`, `milestones`, the `get_process_timeline` RPC, labor tables (`labor_resources`, `construction_activities`, `activity_dependencies`, `trade_taxonomy`), full `roadmap_tasks` and `task_subtasks`. Node labels always come from the canonical owners (tasks/milestones), never stale snapshots, and completed tasks are never shown blocked (REG-008). It runs deterministic engines server-side: `computeLaborCapacity`, `computeLookahead`, `computeLaborVariance`, `computeProductivityVariance`, variance-cause classification and `computeResourceCapacity` (4 weeks). The client (LivingGraphView, React Flow) offers overlays — normal, bottleneck, criticalPath, rework, traceabilityGap, risk, sopCandidate, blocker, timeline, simulation, laborCapacity, readiness, variance, workforceCapacity — plus view levels (milestones/activities/events), layout modes with saved layouts (localStorage), search, timeline playback, a what-if simulation panel, an executive Insights panel, in-graph task/milestone editing, subtask expansion, and a Recalculate action (`refreshLivingGraphAction`, which removes orphans and re-runs the `backfill_living_graph` RPC). Header links go to the Realtime view and back to the Execution Map; an auto-refresh component polls a content signature. Related: screen-execution-map, screen-living-graph-realtime, screen-milestone-flow, screen-resource-capacity, screen-labor-capacity.
Source: living-graph/page.tsx, living-graph/actions.ts, components/graph/living-graph-view.tsx.
Verify: Execution Map > "Living Graph" (/projects/[projectId]/execution-map/living-graph).

# ES: Pantalla Grafo Vivo

El Grafo Vivo es el gemelo digital visual del proyecto y su superficie principal de inteligencia (ADR-002); se llega desde el botón "Grafo Vivo" del Mapa de Ejecución. La página de servidor valida la pertenencia a la organización, limpia nodos huérfanos (`removeOrphanGraphNodes`) y carga `process_nodes`, `process_edges`, `milestones`, el RPC `get_process_timeline`, las tablas laborales (`labor_resources`, `construction_activities`, `activity_dependencies`, `trade_taxonomy`), todas las `roadmap_tasks` y `task_subtasks`. Las etiquetas de nodo provienen siempre de los dueños canónicos (tareas e hitos) y una tarea completada nunca aparece bloqueada (REG-008). Ejecuta motores deterministas en el servidor: `computeLaborCapacity`, `computeLookahead`, `computeLaborVariance`, `computeProductivityVariance`, clasificación de causas de varianza y `computeResourceCapacity` (4 semanas). El cliente (LivingGraphView, React Flow) ofrece superposiciones — normal, cuellos de botella, ruta crítica, retrabajo, brecha de trazabilidad, riesgo, candidato a SOP, bloqueos, línea de tiempo, simulación, capacidad laboral, preparación, varianza y capacidad de fuerza de trabajo —, niveles de vista (hitos/actividades/eventos), modos de diseño con posiciones guardadas (localStorage), búsqueda, reproducción de línea de tiempo, panel de simulación "qué pasaría si", panel ejecutivo de Insights, edición de tareas e hitos dentro del grafo, expansión de subtareas y el botón Recalcular (`refreshLivingGraphAction`, que elimina huérfanos y reejecuta el RPC `backfill_living_graph`). El encabezado enlaza a la vista en tiempo real y de regreso al Mapa de Ejecución; un componente de autoactualización sondea una firma de contenido. Relacionadas: screen-execution-map, screen-living-graph-realtime, screen-milestone-flow, screen-resource-capacity, screen-labor-capacity.
Fuente: living-graph/page.tsx, living-graph/actions.ts, components/graph/living-graph-view.tsx.
Verifica: Mapa de Ejecución > "Grafo Vivo" (/projects/[projectId]/execution-map/living-graph).
