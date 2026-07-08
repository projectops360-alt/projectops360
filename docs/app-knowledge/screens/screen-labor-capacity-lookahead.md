---
slug: screen-labor-capacity-lookahead
route: /projects/[projectId]/labor-capacity/lookahead
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/labor-capacity/lookahead/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/labor-capacity/lookahead/lookahead-client.tsx
  - src/lib/labor/lookahead.ts
  - src/lib/labor/crew-idle-risk.ts
  - src/lib/labor/readiness-explanation.ts
---

# EN: Labor Lookahead screen

The Labor Lookahead screen answers "are the next weeks of work executable with available labor?" and lives at /projects/[projectId]/labor-capacity/lookahead (the "Lookahead" tab of the labor navigation). The server page (force-dynamic, read-only — no writes) fetches `labor_resources`, `construction_activities`, `activity_dependencies`, `milestones` and `trade_taxonomy`, then precomputes deterministic results for both horizons: `computeLookahead` (3-week and 6-week), lookahead narratives (`buildLookaheadNarrative`), crew idle risk (`computeCrewIdleRisk`) and idle-risk summaries (`buildIdleRiskSummary`). The client offers a 3-Week / 6-Week horizon toggle, summary counts by readiness level, a weekly grid of upcoming activities with readiness badges and checklist status, and a narrative panel. For each not-ready activity it builds a readiness explanation (`buildReadinessExplanation`) covering the constraint, missing prerequisites and a recommended action. The crew idle risk section lists top recommended actions (with action-type labels) and per-crew entries showing days at risk, severity and the suggested mitigation; recommendations are display-only text — nothing is executed automatically. Related screens: screen-labor-capacity, screen-labor-capacity-workface, screen-living-graph (readiness overlay uses the same lookahead engine).
Source: lookahead/page.tsx, lookahead-client.tsx, lib/labor/lookahead.ts, lib/labor/crew-idle-risk.ts.
Verify: project > Labor Capacity > Lookahead tab (/projects/[projectId]/labor-capacity/lookahead).

# ES: Pantalla Lookahead Laboral

La pantalla Lookahead Laboral responde "¿las próximas semanas de trabajo son ejecutables con la mano de obra disponible?" y vive en /projects/[projectId]/labor-capacity/lookahead (pestaña "Lookahead" de la navegación laboral). La página de servidor (force-dynamic, solo lectura, sin escrituras) consulta `labor_resources`, `construction_activities`, `activity_dependencies`, `milestones` y `trade_taxonomy`, y precalcula resultados deterministas para ambos horizontes: `computeLookahead` (3 y 6 semanas), narrativas (`buildLookaheadNarrative`), riesgo de cuadrilla ociosa (`computeCrewIdleRisk`) y sus resúmenes (`buildIdleRiskSummary`). El cliente ofrece un alternador de horizonte de 3 o 6 semanas, conteos por nivel de preparación, una cuadrícula semanal de actividades próximas con insignias de preparación y estado de la lista de verificación, y un panel narrativo. Para cada actividad no lista construye una explicación de preparación (`buildReadinessExplanation`) con la restricción, los prerrequisitos faltantes y la acción recomendada. La sección de riesgo de cuadrilla ociosa lista las principales acciones recomendadas y entradas por cuadrilla con días en riesgo, severidad y mitigación sugerida; las recomendaciones son solo texto informativo, nada se ejecuta automáticamente. Pantallas relacionadas: screen-labor-capacity, screen-labor-capacity-workface, screen-living-graph (la superposición de preparación usa el mismo motor).
Fuente: lookahead/page.tsx, lookahead-client.tsx, lib/labor/lookahead.ts, lib/labor/crew-idle-risk.ts.
Verifica: proyecto > Capacidad Laboral > pestaña Lookahead (/projects/[projectId]/labor-capacity/lookahead).
