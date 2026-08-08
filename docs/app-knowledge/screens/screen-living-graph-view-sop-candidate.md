---
slug: screen-living-graph-view-sop-candidate
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/graph/living-graph-analysis.ts
  - src/lib/graph/overlay-metadata.ts
  - src/components/graph/living-graph-view.tsx
  - docs/product-brain/28-sprint-03-overlay-clarity.md
---

# EN: Living Graph — SOP Candidate View

SOP Candidate View highlights clean, well-evidenced, repeatable work worth turning into a Standard Operating Procedure. The rule is deterministic (`sopCandidateScore` in living-graph-analysis.ts): a node only qualifies if it is completed (status done/completed/tested), not blocked, and shows no rework signal; its score is then 0.4 base + up to 0.35 for evidence (the inverse of its traceability gap) + up to 0.25 for connectivity (about six links saturates it). Score ≥ 0.6 highlights green, anything above 0 stays normal, zero dims. Plainly: an SOP candidate is a finished step that ran without loops or blockers and left a documented trail. This is a Sprint #3 advanced overlay with its own clarity card (overlay-metadata.ts): legend — green "suggested candidate", slate "not yet linked to a process"; data requirements — completed work, evidence/traceability, repeated patterns; recommended layout: force. The state is deterministic: empty ("No SOP candidates detected — complete and document more work") when no node reaches 0.6; the incomplete note reminds you candidates come from repeated patterns and may not yet be a formal process. The health header counts SOP Candidates. Note: candidates are heuristic suggestions — there is no formalize/dismiss workflow inside the graph yet; the metadata's user action ("formalize as an SOP, or dismiss") is guidance, not a button. Action: review each candidate and document it as a reusable SOP.
Source: src/lib/graph/living-graph-analysis.ts, src/lib/graph/overlay-metadata.ts, docs/product-brain/28-sprint-03-overlay-clarity.md.
Verify: open a project → Execution Map → Living Graph → view selector → SOP Candidate View.

# ES: Living Graph — Vista de candidatos a SOP

La Vista de candidatos a SOP resalta trabajo limpio, bien evidenciado y repetible que merece convertirse en un Procedimiento Operativo Estándar. La regla es determinista (`sopCandidateScore` en living-graph-analysis.ts): un nodo solo califica si está completado (estado done/completed/tested), no está bloqueado y no tiene señal de retrabajo; su puntuación es 0.4 base + hasta 0.35 por evidencia (el inverso de su brecha de trazabilidad) + hasta 0.25 por conectividad (unas seis conexiones la saturan). Con ≥ 0.6 se resalta en verde, por encima de 0 queda normal y con 0 se atenúa. En llano: un candidato a SOP es un paso terminado que corrió sin bucles ni bloqueos y dejó rastro documentado. Es un overlay avanzado del Sprint #3 con tarjeta de claridad propia (overlay-metadata.ts): leyenda — verde "candidato sugerido", gris "aún sin proceso formal"; datos requeridos — trabajo completado, evidencia/trazabilidad, patrones repetidos; layout recomendado: force. El estado es determinista: vacío ("Sin candidatos a SOP detectados — completa y documenta más trabajo") cuando ningún nodo llega a 0.6; el aviso de incompleto recuerda que los candidatos surgen de patrones repetidos y pueden no ser aún un proceso formal. La cabecera de salud cuenta los candidatos. Nota: son sugerencias heurísticas — todavía no existe un flujo de formalizar/descartar dentro del grafo; la acción de los metadatos es una guía, no un botón. Acción: revisar cada candidato y documentarlo como SOP reutilizable.
Fuente: src/lib/graph/living-graph-analysis.ts, src/lib/graph/overlay-metadata.ts, docs/product-brain/28-sprint-03-overlay-clarity.md.
Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Vista de candidatos a SOP.
