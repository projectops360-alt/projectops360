---
slug: screen-living-graph-view-labor-capacity
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/labor/capacity.ts
  - src/lib/graph/labor-graph-mapping.ts
  - src/lib/graph/living-graph-analysis.ts
  - src/components/graph/living-graph-view.tsx
  - src/components/graph/living-graph-detail-panel.tsx
---

# EN: Living Graph — Labor Capacity View

The Labor Capacity View shows where construction labor shortages threaten the plan. Activate it from the Living Graph view selector (Execution Map → Living Graph → Overlay → "Labor Capacity View"). It only has data when the project has labor resources and construction activities; the server computes it non-fatally, so without that data the overlay changes nothing except dimming nodes. The rule is deterministic per trade and week: required vs available headcount ratio classifies shortage risk — over 1.0 is low, over 1.10 medium, over 1.25 high, over 1.50 critical (zero available with demand is critical). At Activities/Events level, high/critical weekly gaps become synthetic "labor risk" nodes ("<Trade> shortage <week>") connected by labor-constrained edges to affected milestones, and by delayed edges to their tasks when the gap touches the critical path. Nodes in affected milestones carry the worst gap as metadata and a badge. Emphasis maps shortage risk to a 0–1 score (critical=1, high=0.7, medium=0.4, low=0.15): 0.5+ highlights, 0.2+ stays normal, the rest dims. The detail panel explains the gap: trade, week, missing headcount, required vs available. No Sprint #3 clarity card exists for this overlay. Action: rebalance crews, adjust schedules, or resolve gaps in the labor module. Source: src/lib/labor/capacity.ts, src/lib/graph/labor-graph-mapping.ts, src/lib/graph/living-graph-analysis.ts. Verify: open a project → Execution Map → Living Graph → view selector → Labor Capacity View.

# ES: Living Graph — Vista de capacidad laboral

La Vista de capacidad laboral muestra dónde la escasez de mano de obra de construcción amenaza el plan. Se activa desde el selector de vistas del Living Graph (Execution Map → Living Graph → Capa → "Vista de capacidad laboral"). Solo tiene datos cuando el proyecto tiene recursos laborales y actividades de construcción; el servidor la calcula de forma no fatal, así que sin esos datos la capa solo atenúa los nodos. La regla es determinista por oficio y semana: la razón entre headcount requerido y disponible clasifica el riesgo de escasez — mayor a 1.0 es bajo, mayor a 1.10 medio, mayor a 1.25 alto, mayor a 1.50 crítico (disponible cero con demanda es crítico). En nivel Actividades/Eventos, las brechas semanales altas/críticas se convierten en nodos sintéticos de "riesgo laboral" ("escasez de <oficio> <semana>"), conectados con aristas labor-constrained a los hitos afectados y con aristas delayed a sus tareas cuando la brecha toca la ruta crítica. Los nodos de hitos afectados llevan la peor brecha como metadato y una insignia. El énfasis mapea el riesgo a un puntaje 0–1 (crítico=1, alto=0.7, medio=0.4, bajo=0.15): 0.5+ se resalta, 0.2+ queda normal, el resto se atenúa. El panel de detalle explica la brecha: oficio, semana, headcount faltante, requerido vs disponible. Esta capa no tiene tarjeta de claridad de Sprint #3. Acción: rebalancea cuadrillas, ajusta el cronograma o resuelve brechas en el módulo laboral. Fuente: src/lib/labor/capacity.ts, src/lib/graph/labor-graph-mapping.ts, src/lib/graph/living-graph-analysis.ts. Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Labor Capacity View.
