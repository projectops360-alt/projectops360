---
slug: screen-living-graph-view-critical-path
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/graph/living-graph-analysis.ts
  - src/lib/execution/critical-path.ts
  - src/components/graph/living-graph-view.tsx
  - src/components/graph/living-graph-node.tsx
  - src/lib/graph/living-graph-styles.ts
---

# EN: Living Graph — Critical Path View

Critical Path View isolates the chain of work that determines the project end date: any delay on it delays everything. Emphasis is binary — nodes with `onCriticalPath` are highlighted, all others are dimmed, and the connecting critical edges render with visible flow only in this view. A node is on the path if the source data flags it critical (`node.isCritical`) or if it belongs to the client-side approximation in living-graph-analysis.ts: the longest duration-weighted path through the acyclic part of the graph (Kahn topological order + dynamic programming, counting node durations plus edge lag days; cycle-closing edges are skipped, and a "path" of fewer than two nodes is discarded). Separately, the full CPM engine (src/lib/execution/critical-path.ts) computes forward/backward passes, total float ≤ 0 and near-critical tasks (float ≤ 3 days) over roadmap tasks and dependencies — the graph approximation is the fallback when those flags are absent. The critical color is rose (#f43f5e); critical nodes also show a small rose dot in every other view. The view is deep-linkable via `?overlay=criticalPath`. It requires connected dependencies with durations or dates; a graph without chains dims everything (no dedicated empty-state card). Action: protect and monitor highlighted work, combine with the "Critical only" filter or What-if Simulation to test delays.
Source: src/lib/graph/living-graph-analysis.ts, src/lib/execution/critical-path.ts, src/components/graph/living-graph-view.tsx.
Verify: open a project → Execution Map → Living Graph → view selector → Critical Path View.

# ES: Living Graph — Vista de ruta crítica

La Vista de ruta crítica aísla la cadena de trabajo que determina la fecha final del proyecto: cualquier retraso ahí retrasa todo. El énfasis es binario: los nodos con `onCriticalPath` se resaltan, el resto se atenúa, y las aristas críticas muestran flujo visible solo en esta vista. Un nodo está en la ruta si los datos de origen lo marcan crítico (`node.isCritical`) o si pertenece a la aproximación de living-graph-analysis.ts: la ruta más larga ponderada por duración sobre la parte acíclica del grafo (orden topológico de Kahn + programación dinámica, sumando duraciones de nodos y días de lag de aristas; se omiten aristas que cierran ciclos y se descarta una "ruta" de menos de dos nodos). Aparte, el motor CPM completo (src/lib/execution/critical-path.ts) calcula pases hacia adelante/atrás, holgura total ≤ 0 y tareas casi críticas (holgura ≤ 3 días) sobre tareas y dependencias del roadmap; la aproximación del grafo es el respaldo cuando faltan esas marcas. El color crítico es rosa (#f43f5e); los nodos críticos muestran además un punto rosa en las demás vistas. Admite enlace directo con `?overlay=criticalPath`. Requiere dependencias conectadas con duraciones o fechas; un grafo sin cadenas se atenúa por completo (sin tarjeta de estado vacío propia). Acción: proteger y vigilar el trabajo resaltado, y combinar con el filtro "solo crítico" o la simulación what-if.
Fuente: src/lib/graph/living-graph-analysis.ts, src/lib/execution/critical-path.ts, src/components/graph/living-graph-view.tsx.
Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Vista de ruta crítica.
