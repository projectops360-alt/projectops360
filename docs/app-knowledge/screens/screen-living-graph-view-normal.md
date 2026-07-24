---
slug: screen-living-graph-view-normal
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/components/graph/living-graph-toolbar.tsx
  - src/components/graph/living-graph-view.tsx
  - src/components/graph/living-graph-node.tsx
  - src/lib/graph/living-graph-analysis.ts
  - src/components/graph/living-graph-legend.tsx
---

# EN: Living Graph — Normal View

Normal View is the default, neutral layer of the Living Graph. It applies no emphasis at all: in `nodeOverlayEmphasis` every node resolves to "normal", so nothing is highlighted or dimmed. You see the full project graph as-is — nodes colored by type (task, milestone gate, decision, document link, risk event, etc.), edges styled by relationship type (caused, enabled, blocked in red, delayed as dashed amber curves, informed as thin dotted lines). Baseline indicators still appear on every node regardless of view: a red lock for blocked items, an amber link icon for waiting-on-dependency, a rose dot for critical-path membership, risk-level dots, evidence-gap icons, and progress bars. It is selected by default and restored from saved view preferences; switch back to it from the "Layer" view selector in the toolbar. There is no per-view calculation — the deterministic analysis pass (`analyzeGraph`) still runs to power the status icons and the health header, but nothing changes visual weight. Data required: project process events (nodes and edges); with no events the graph itself is empty, and there is no view-specific empty state. Use it to orient yourself with search, filters and detail levels (Milestones/Activities/Events) before switching to a diagnostic view. Not a placeholder — fully functional.
Source: src/components/graph/living-graph-toolbar.tsx, src/lib/graph/living-graph-analysis.ts, src/components/graph/living-graph-node.tsx.
Verify: open a project → Execution Map → Living Graph → view selector → Normal View.

# ES: Living Graph — Vista normal

La Vista normal es la capa neutral por defecto del Living Graph. No aplica ningún énfasis: en `nodeOverlayEmphasis` todos los nodos resuelven a "normal", así que nada se resalta ni se atenúa. Se ve el grafo completo tal cual: nodos coloreados por tipo (tarea, hito, decisión, enlace de documento, evento de riesgo, etc.) y aristas según el tipo de relación (caused, enabled, blocked en rojo, delayed como curva discontinua ámbar, informed como línea punteada fina). Los indicadores base aparecen en cualquier vista: candado rojo si está bloqueado, icono ámbar si espera una dependencia, punto rosa si está en la ruta crítica, puntos de riesgo, icono de brecha de evidencia y barras de progreso. Es la vista seleccionada por defecto y se restaura desde las preferencias guardadas; se vuelve a ella con el selector de vistas ("Capa") de la barra de herramientas. No hay cálculo propio: el análisis determinista (`analyzeGraph`) sigue ejecutándose para los iconos de estado y la cabecera de salud, pero no cambia el peso visual. Requiere los eventos de proceso del proyecto; sin eventos el grafo queda vacío y no hay estado vacío específico de esta vista. Úsala para orientarte con búsqueda, filtros y niveles de detalle antes de pasar a una vista diagnóstica. No es un placeholder.
Fuente: src/components/graph/living-graph-toolbar.tsx, src/lib/graph/living-graph-analysis.ts, src/components/graph/living-graph-node.tsx.
Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Vista normal.
