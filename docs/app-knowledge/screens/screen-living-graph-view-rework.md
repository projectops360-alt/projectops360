---
slug: screen-living-graph-view-rework
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/graph/living-graph-analysis.ts
  - src/components/graph/living-graph-view.tsx
  - src/lib/graph/living-graph-styles.ts
  - src/components/graph/living-graph-legend.tsx
---

# EN: Living Graph — Rework View

Rework View surfaces work that went backwards — steps the project had to revisit after moving forward. The rule is deterministic and binary (`reworkSignal` in living-graph-analysis.ts): a node is highlighted if it participates in a detected cycle (a loop found by bounded depth-first search, cycles up to 8 nodes, at most 10 reported) or if it touches a "delayed" edge in either direction; every other node is dimmed. In user terms: rework is a step caught in a loop or connected to a delay signal. Delayed edges themselves render as dashed, curved amber lines, and the shared legend marks the rework indicator in amber (#f59e0b). The executive health header counts "Rework Signals", and each of them lowers the composite health score. Activate the view from the toolbar's "Layer" view selector. It requires edges with meaningful types — specifically "delayed" edges or actual loops in the event flow; a clean linear project dims entirely, and this view has no dedicated clarity card or empty state (it is not one of the Sprint #3 advanced overlays). The node insight explains that work likely came back to the highlighted step; the recommended action is to review what caused the loop and add an acceptance gate before that step so the same work is not redone again.
Source: src/lib/graph/living-graph-analysis.ts, src/components/graph/living-graph-view.tsx, src/lib/graph/living-graph-styles.ts.
Verify: open a project → Execution Map → Living Graph → view selector → Rework View.

# ES: Living Graph — Vista de retrabajo

La Vista de retrabajo muestra el trabajo que retrocedió: pasos que el proyecto tuvo que revisitar después de avanzar. La regla es determinista y binaria (`reworkSignal` en living-graph-analysis.ts): un nodo se resalta si participa en un ciclo detectado (bucle hallado por búsqueda en profundidad acotada, ciclos de hasta 8 nodos, máximo 10 reportados) o si toca una arista "delayed" en cualquier dirección; el resto de nodos se atenúa. En lenguaje de usuario: retrabajo es un paso atrapado en un bucle o conectado a una señal de retraso. Las aristas "delayed" se dibujan como curvas discontinuas en ámbar, y la leyenda marca el indicador de retrabajo en ámbar (#f59e0b). La cabecera ejecutiva cuenta las "señales de retrabajo" y cada una baja la puntuación compuesta de salud. Se activa desde el selector de vistas ("Capa") de la barra de herramientas. Requiere aristas con tipos significativos — en concreto aristas "delayed" o bucles reales en el flujo de eventos; un proyecto lineal y limpio se atenúa por completo, y esta vista no tiene tarjeta de claridad ni estado vacío propio (no es un overlay avanzado del Sprint #3). La acción recomendada: revisar qué causó el bucle y añadir una puerta de aceptación antes de ese paso para no repetir el mismo trabajo.
Fuente: src/lib/graph/living-graph-analysis.ts, src/components/graph/living-graph-view.tsx, src/lib/graph/living-graph-styles.ts.
Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Vista de retrabajo.
