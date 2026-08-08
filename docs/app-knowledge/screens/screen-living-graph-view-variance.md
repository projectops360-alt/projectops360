---
slug: screen-living-graph-view-variance
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/graph/overlay-metadata.ts
  - src/lib/labor/labor-variance.ts
  - src/lib/labor/productivity-variance.ts
  - src/lib/labor/variance-cause-classification.ts
  - src/lib/graph/labor-graph-mapping.ts
  - src/components/graph/variance-detail-block.tsx
  - docs/product-brain/28-sprint-03-overlay-clarity.md
---

# EN: Living Graph — Variance View

The Variance View answers "what changed versus the plan?". Activate it from the Living Graph view selector (Execution Map → Living Graph → Overlay → "Variance View"); it recommends the Activities level. Deterministic rule: for tracked construction activities, variance % = (actual − estimated hours) ÷ estimated × 100, classified as on track (≤10%), minor (≤25%), major (≤50%) or critical (>50%). A separate 0–100 schedule-risk score maps to none/low/medium/high/critical, and each deviation gets a likely cause (e.g. material delay, unresolved RFI, crew shortage, rework/quality) with a confidence, plus a trend versus trade peers. Emphasis: nodes without variance data dim; high/critical schedule risk or major/critical severity highlight; minor stays normal; on-track dims. Its Sprint #3 clarity card explains purpose and legend — red "Behind plan", orange "Over effort", green "Ahead/under", slate "No baseline" — and resolves an explicit empty state: without baseline/variance data it says the view "requires baseline/variance data" with a CTA to open the Delivery Framework; partial data shows "some items have no baseline yet". Selecting a node opens a variance block with severity + %, schedule risk + score, likely cause + confidence, and trend. Note the engine currently derives from construction/labor activity tracking. Action: review deviations and decide corrective action or re-baseline. Source: src/lib/graph/overlay-metadata.ts, src/lib/labor/labor-variance.ts, src/lib/labor/productivity-variance.ts, src/components/graph/variance-detail-block.tsx. Verify: open a project → Execution Map → Living Graph → view selector → Variance View.

# ES: Living Graph — Vista de Variación

La Vista de Variación responde "¿qué cambió respecto al plan?". Se activa desde el selector de vistas del Living Graph (Execution Map → Living Graph → Capa → "Vista de Varianza"); recomienda el nivel Actividades. Regla determinista: para actividades de construcción con seguimiento, % de variación = (horas reales − estimadas) ÷ estimadas × 100, clasificada como en plan (≤10%), menor (≤25%), mayor (≤50%) o crítica (>50%). Un puntaje de riesgo de cronograma 0–100 se mapea a ninguno/bajo/medio/alto/crítico, y cada desviación recibe una causa probable (p. ej. retraso de material, RFI sin resolver, escasez de cuadrilla, retrabajo/calidad) con confianza, más una tendencia frente a pares del mismo oficio. Énfasis: los nodos sin datos de variación se atenúan; riesgo alto/crítico o severidad mayor/crítica se resalta; menor queda normal; en plan se atenúa. Su tarjeta de claridad de Sprint #3 explica propósito y leyenda — rojo "Atrasado", naranja "Sobre-esfuerzo", verde "Adelantado/bajo plan", gris "Sin línea base" — y resuelve un estado vacío explícito: sin línea base/datos de variación indica que la vista "requiere línea base" con un CTA para abrir el Marco de Entrega; con datos parciales avisa que "algunos elementos aún no tienen línea base". Al seleccionar un nodo se abre un bloque con severidad + %, riesgo + puntaje, causa probable + confianza y tendencia. Nota: el motor hoy se deriva del seguimiento de actividades de construcción/laborales. Acción: revisa las desviaciones y decide acción correctiva o re-establecer la línea base. Fuente: src/lib/graph/overlay-metadata.ts, src/lib/labor/labor-variance.ts, src/lib/labor/productivity-variance.ts, src/components/graph/variance-detail-block.tsx. Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Variance View.
