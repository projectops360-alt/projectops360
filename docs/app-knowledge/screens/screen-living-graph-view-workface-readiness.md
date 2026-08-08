---
slug: screen-living-graph-view-workface-readiness
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/labor/workface-readiness.ts
  - src/lib/labor/lookahead.ts
  - src/lib/graph/labor-graph-mapping.ts
  - src/lib/graph/living-graph-analysis.ts
  - src/components/graph/living-graph-detail-panel.tsx
---

# EN: Living Graph — Workface Readiness

Workface Readiness (overlay id `readiness`) answers "can this construction activity actually start?". Select it from the Living Graph view selector (Execution Map → Living Graph → Overlay → "Workface Readiness"). It is fed by the deterministic lookahead engine: each construction activity gets a readiness level — blocked (activity or a predecessor is blocked), not ready (no crew assigned, a high/critical labor gap for its trade, or 3+ required checklist items incomplete), at risk (incomplete predecessor, partial crew, medium/low labor gap, or 1–2 missing items), otherwise ready. Readiness % is the share of completed required items in a 9-point checklist: RFI answered, submittal approved, drawing current, material onsite, area released, safety/permit ready, predecessor complete, QA prerequisite, crew assigned. Only not-ready activities are enriched; selecting one shows a detail block with level, percentage bar, missing prerequisites, a short summary, and a recommended action ("Resolve blockers" or "Expedite missing prerequisites"). Be aware this view is limited today: the overlay defines no emphasis rule, so choosing it does not dim or highlight nodes — the value lives in the enriched detail panel of construction-activity nodes. It requires labor resources plus construction activities; without them nothing is enriched, and there is no clarity card or empty state. Action: clear the listed prerequisites before crews mobilize. Source: src/lib/labor/workface-readiness.ts, src/lib/labor/lookahead.ts, src/lib/graph/labor-graph-mapping.ts. Verify: open a project → Execution Map → Living Graph → view selector → Workface Readiness.

# ES: Living Graph — Vista Preparación de Frente de Obra

Preparación de Frente de Obra (id de capa `readiness`) responde "¿esta actividad de construcción realmente puede empezar?". Se elige en el selector de vistas del Living Graph (Execution Map → Living Graph → Capa → "Preparación de Frente de Obra"). La alimenta el motor determinista de lookahead: cada actividad recibe un nivel — bloqueada (la actividad o un predecesor está bloqueado), no lista (sin cuadrilla asignada, brecha laboral alta/crítica de su oficio, o 3+ ítems requeridos incompletos), en riesgo (predecesor incompleto, cuadrilla parcial, brecha media/baja, o 1–2 ítems faltantes), y si no, lista. El % de preparación es la proporción de ítems requeridos completados de una lista de 9 puntos: RFI respondida, submittal aprobado, plano vigente, material en sitio, área liberada, seguridad/permiso listo, predecesor completo, requisito QA y cuadrilla asignada. Solo se enriquecen las actividades no listas; al seleccionar una, el panel de detalle muestra nivel, barra de porcentaje, prerrequisitos faltantes, un resumen y una acción recomendada ("Resolver bloqueadores" o "Acelerar prerrequisitos faltantes"). Ojo: hoy esta vista es limitada — la capa no define regla de énfasis, así que elegirla no atenúa ni resalta nodos; el valor está en el panel de detalle enriquecido de los nodos de actividad de construcción. Requiere recursos laborales y actividades de construcción; sin ellos no se enriquece nada, y no hay tarjeta de claridad ni estado vacío. Acción: despeja los prerrequisitos listados antes de movilizar cuadrillas. Fuente: src/lib/labor/workface-readiness.ts, src/lib/labor/lookahead.ts, src/lib/graph/labor-graph-mapping.ts. Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Workface Readiness.
