---
slug: screen-living-graph-view-risk
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/graph/living-graph-analysis.ts
  - src/lib/graph/overlay-metadata.ts
  - src/components/graph/living-graph-view.tsx
  - docs/product-brain/28-sprint-03-overlay-clarity.md
---

# EN: Living Graph — Risk View

Risk View shows project risks and the work they threaten, so you act on the risks that matter. Emphasis is deterministic (`riskScore` in living-graph-analysis.ts): the node's declared risk level (low 0.2 / medium 0.55 / high 1.0, weighted 50%) + 0.3 if blocked + up to 0.2 for downstream reach (10+ dependents) + 0.15 if it also shows a rework signal, capped at 1. Score ≥ 0.5 highlights, 0.25–0.5 stays normal, below dims. Plainly: a risky node is high-risk or blocked work that many other things depend on. This is a Sprint #3 "advanced overlay" with its own clarity card (overlay-metadata.ts): legend — red high risk, amber medium, green low, slate unlinked risk; data requirements — risks, risk→task/milestone links, severity/impact, status; recommended layout hierarchical. States are explicit: empty ("No risks to show") when there are no risk-event nodes and no medium/high-risk work; incomplete when some risk nodes have zero connections ("Some risks are not linked to tasks or milestones yet"). Isabella can narrate this card but never invents risks. Known limitation: node-level risk detail (severity/probability/owner) is not yet mapped into node metadata. Action: review high-impact risks and link unlinked risks to the affected task or milestone.
Source: src/lib/graph/living-graph-analysis.ts, src/lib/graph/overlay-metadata.ts, docs/product-brain/28-sprint-03-overlay-clarity.md.
Verify: open a project → Execution Map → Living Graph → view selector → Risk View.

# ES: Living Graph — Vista de riesgo

La Vista de riesgo muestra los riesgos del proyecto y el trabajo que amenazan, para actuar sobre los que importan. El énfasis es determinista (`riskScore` en living-graph-analysis.ts): nivel de riesgo declarado del nodo (bajo 0.2 / medio 0.55 / alto 1.0, ponderado al 50%) + 0.3 si está bloqueado + hasta 0.2 por alcance descendente (10+ dependientes) + 0.15 si además tiene señal de retrabajo, con tope 1. Con ≥ 0.5 se resalta, entre 0.25 y 0.5 queda normal y por debajo se atenúa. En llano: un nodo riesgoso es trabajo de alto riesgo o bloqueado del que dependen muchas otras cosas. Es un "overlay avanzado" del Sprint #3 con tarjeta de claridad propia (overlay-metadata.ts): leyenda — rojo riesgo alto, ámbar medio, verde bajo, gris riesgo sin vincular; datos requeridos — riesgos, enlaces riesgo→tarea/hito, severidad/impacto, estado; layout recomendado jerárquico. Los estados son explícitos: vacío ("Sin riesgos que mostrar") cuando no hay nodos de riesgo ni trabajo de riesgo medio/alto; incompleto cuando algunos riesgos no tienen conexiones ("Algunos riesgos aún no están vinculados a tareas o hitos"). Isabella puede narrar la tarjeta pero nunca inventa riesgos. Limitación conocida: el detalle a nivel de nodo (severidad/probabilidad/responsable) aún no está mapeado en los metadatos. Acción: revisar los riesgos de alto impacto y vincular los no enlazados a la tarea o hito afectado.
Fuente: src/lib/graph/living-graph-analysis.ts, src/lib/graph/overlay-metadata.ts, docs/product-brain/28-sprint-03-overlay-clarity.md.
Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Vista de riesgo.
