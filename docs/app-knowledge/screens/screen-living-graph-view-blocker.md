---
slug: screen-living-graph-view-blocker
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/graph/living-graph-analysis.ts
  - src/lib/graph/living-graph-status.ts
  - src/components/graph/living-graph-view.tsx
  - src/components/graph/living-graph-toolbar.tsx
  - messages/en.json
---

# EN: Living Graph — Blocker View

The Blocker View highlights work that is explicitly blocked and the work it is holding back. It is activated from the Living Graph's view selector (the "Overlay" dropdown in the toolbar, inside Execution Map). The rule is deterministic: a node lights up if it has an explicit active impediment (`is_blocked`) or is a `blocker_event` node; nodes reachable downstream of a blocked node (within 6 dependency hops) stay at normal emphasis because they are exposed to the blockage; everything else is dimmed. Per ADR-006 (REG-006/REG-008), "blocked" is never derived from dependencies: an item merely waiting on an unfinished predecessor is counted separately as "waiting on dependency", and a completed or cancelled task is never shown as blocked even if a stale blocked flag remains. The toolbar summary therefore reports blocked and waiting counts separately. Selecting a blocked node shows the insight "this node is blocked and is holding back N downstream nodes" in the detail panel. This overlay has no Sprint #3 clarity card or dedicated empty state: with zero blocked items the whole graph simply appears dimmed. Recommended action: open each blocked item, resolve or escalate the recorded impediment, and let waiting items clear themselves by finishing predecessors. Source: src/lib/graph/living-graph-analysis.ts, src/lib/graph/living-graph-status.ts, src/components/graph/living-graph-view.tsx. Verify: open a project → Execution Map → Living Graph → view selector → Blocker View.

# ES: Living Graph — Vista de bloqueos

La Vista de bloqueos resalta el trabajo bloqueado explícitamente y el trabajo que está frenando. Se activa desde el selector de vistas del Living Graph (menú "Capa" de la barra de herramientas, dentro de Execution Map). La regla es determinista: un nodo se resalta si tiene un impedimento activo explícito (`is_blocked`) o es un nodo `blocker_event`; los nodos alcanzables aguas abajo de un nodo bloqueado (hasta 6 saltos de dependencia) quedan con énfasis normal porque están expuestos al bloqueo; el resto se atenúa. Según ADR-006 (REG-006/REG-008), "bloqueado" nunca se deriva de dependencias: un elemento que solo espera un predecesor sin terminar se cuenta aparte como "esperando dependencia", y una tarea completada o cancelada nunca aparece bloqueada aunque conserve una marca obsoleta. Por eso la barra muestra los conteos de bloqueados y en espera por separado. Al seleccionar un nodo bloqueado, el panel de detalle muestra "este nodo está bloqueado y frena N nodos aguas abajo". Esta capa no tiene tarjeta de claridad de Sprint #3 ni estado vacío propio: sin elementos bloqueados, todo el grafo simplemente se ve atenuado. Acción recomendada: abre cada elemento bloqueado, resuelve o escala el impedimento registrado, y deja que los elementos en espera se liberen al terminar sus predecesores. Fuente: src/lib/graph/living-graph-analysis.ts, src/lib/graph/living-graph-status.ts, src/components/graph/living-graph-view.tsx. Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Blocker View.
