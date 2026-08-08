---
slug: screen-living-graph-view-traceability-gap
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/graph/living-graph-analysis.ts
  - src/components/graph/living-graph-view.tsx
  - src/components/graph/living-graph-node.tsx
  - src/lib/graph/living-graph-styles.ts
---

# EN: Living Graph — Traceability Gap View

Traceability Gap View highlights work with little or no linked evidence — nodes whose history would be hard to audit later. The rule is deterministic (`traceabilityGapScore` in living-graph-analysis.ts): gap = 1 − evidence. Evidence uses the node's own `traceabilityScore` when the backend provides one; otherwise it is computed as 0.35 per "informed" (informational/evidence) edge, +0.4 if the node is connected to a document-link or decision-cascade node, +0.2 if it has a description, capped at 1. Document-link nodes themselves always score gap 0 — they are evidence. Nodes with gap ≥ 0.6 are highlighted, 0.3–0.6 stay normal, below 0.3 dim. In plain terms: a traceability gap is a step with no attached documents, decisions or informational links. The indicator color is yellow (#eab308), and high-gap nodes show a file-question icon in every view; the health header counts "Trace Gaps" (≥ 0.6), which also feed the process-confidence metric. Activate it from the toolbar's "Layer" view selector. It requires informational edges and document/decision nodes; a project that captures no evidence will highlight almost everything rather than show an empty state — this view has no Sprint #3 clarity card. Action: link the relevant document, decision or evidence to each highlighted node.
Source: src/lib/graph/living-graph-analysis.ts, src/components/graph/living-graph-node.tsx, src/lib/graph/living-graph-styles.ts.
Verify: open a project → Execution Map → Living Graph → view selector → Traceability Gap View.

# ES: Living Graph — Vista de brechas de trazabilidad

La Vista de brechas de trazabilidad resalta trabajo con poca o ninguna evidencia vinculada — nodos cuya historia sería difícil de auditar después. La regla es determinista (`traceabilityGapScore` en living-graph-analysis.ts): brecha = 1 − evidencia. La evidencia usa el `traceabilityScore` del nodo si el backend lo provee; si no, se calcula como 0.35 por cada arista "informed" (informativa/evidencia), +0.4 si el nodo está conectado a un nodo de documento o de cascada de decisión, +0.2 si tiene descripción, con tope 1. Los nodos de tipo documento siempre puntúan brecha 0 — ellos son la evidencia. Con brecha ≥ 0.6 el nodo se resalta, entre 0.3 y 0.6 queda normal y por debajo se atenúa. En lenguaje llano: una brecha de trazabilidad es un paso sin documentos, decisiones ni enlaces informativos adjuntos. El color del indicador es amarillo (#eab308) y los nodos con brecha alta muestran un icono de archivo con interrogación en todas las vistas; la cabecera de salud cuenta las brechas (≥ 0.6), que además alimentan la métrica de confianza del proceso. Se activa desde el selector de vistas ("Capa"). Requiere aristas informativas y nodos de documento/decisión; un proyecto sin evidencia capturada resaltará casi todo en vez de mostrar un estado vacío — esta vista no tiene tarjeta de claridad del Sprint #3. Acción: vincular el documento, decisión o evidencia pertinente a cada nodo resaltado.
Fuente: src/lib/graph/living-graph-analysis.ts, src/components/graph/living-graph-node.tsx, src/lib/graph/living-graph-styles.ts.
Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Vista de brechas de trazabilidad.
