---
slug: screen-living-graph-view-bottleneck
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/graph/living-graph-analysis.ts
  - src/components/graph/living-graph-view.tsx
  - src/components/graph/living-graph-legend.tsx
  - src/lib/graph/living-graph-styles.ts
---

# EN: Living Graph — Bottleneck View

Bottleneck View highlights nodes where work funnels through and delays would ripple widely. The rule is deterministic (`bottleneckScore` in living-graph-analysis.ts): a 0–1 composite of connection density (the node's in+out links relative to the busiest node, 45%), duration (up to 14 days, 25%), downstream reach (up to 10 dependent nodes, 20%), plus blocked pressure (+0.35 if the node is blocked, +0.15 per incoming "blocked" edge). Nodes scoring ≥ 0.6 are highlighted with their accent ring, 0.35–0.6 stay normal, and everything below dims — so the busy hubs pop out. In plain terms: a bottleneck is a long or blocked step that many things feed into and many things wait on. The shared legend marks the bottleneck indicator in orange (#f97316), and the health header counts "Active Bottlenecks" (score ≥ 0.6). Activate it from the toolbar's "Layer" view selector. It requires edges (dependencies), node durations or dates, and blocked flags; sparse graphs with few edges simply dim everything — this view has no dedicated clarity card or empty state (it is not one of the Sprint #3 advanced overlays). Recommended action per the node insight: split responsibilities or parallelize the work feeding through the highlighted node.
Source: src/lib/graph/living-graph-analysis.ts, src/components/graph/living-graph-view.tsx, src/lib/graph/living-graph-styles.ts.
Verify: open a project → Execution Map → Living Graph → view selector → Bottleneck View.

# ES: Living Graph — Vista de cuellos de botella

La Vista de cuellos de botella resalta los nodos por donde se embudo el trabajo y donde un retraso se propagaría más. La regla es determinista (`bottleneckScore` en living-graph-analysis.ts): un compuesto 0–1 de densidad de conexiones (enlaces entrantes+salientes respecto al nodo más conectado, 45%), duración (hasta 14 días, 25%), alcance descendente (hasta 10 nodos dependientes, 20%), más presión de bloqueo (+0.35 si el nodo está bloqueado, +0.15 por cada arista entrante de tipo "blocked"). Los nodos con puntuación ≥ 0.6 se resaltan, entre 0.35 y 0.6 quedan normales y el resto se atenúa. En lenguaje llano: un cuello de botella es un paso largo o bloqueado del que muchas cosas dependen y al que muchas cosas alimentan. La leyenda marca el indicador en naranja (#f97316) y la cabecera de salud cuenta los "cuellos de botella activos" (≥ 0.6). Se activa desde el selector de vistas ("Capa") de la barra de herramientas. Requiere aristas (dependencias), duraciones o fechas y marcas de bloqueo; en grafos con pocas aristas simplemente se atenúa todo — esta vista no tiene tarjeta de claridad ni estado vacío propio (no es uno de los overlays avanzados del Sprint #3). Acción recomendada: dividir responsabilidades o paralelizar el trabajo que pasa por el nodo resaltado.
Fuente: src/lib/graph/living-graph-analysis.ts, src/components/graph/living-graph-view.tsx, src/lib/graph/living-graph-styles.ts.
Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Vista de cuellos de botella.
