---
slug: screen-labor-capacity-workface
route: /projects/[projectId]/labor-capacity/workface
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/labor-capacity/workface/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/labor-capacity/workface/workface-client.tsx
  - src/lib/labor/lookahead.ts
  - src/lib/labor/crew-idle-risk.ts
---

# EN: Workface Readiness Board screen

The Workface Readiness Board asks "are upcoming activities ready to execute?" and shows readiness, blockers and risk at a glance, at /projects/[projectId]/labor-capacity/workface (the "Workface Board" tab of the labor navigation). The server page (force-dynamic, read-only — no server actions here) fetches `labor_resources`, `construction_activities`, `activity_dependencies`, `milestones` and `trade_taxonomy`, then precomputes `computeLookahead` and `computeCrewIdleRisk` for both 3-week and 6-week horizons. The client joins lookahead activities with idle-risk data into board rows and sorts them worst-first by readiness severity, then idle risk. Summary cards show total, ready, at-risk and blocked activities plus overall readiness percent. Filters include trade, readiness level, critical-path-only and blocked-only. Each row shows readiness percent, missing prerequisites (unchecked readiness-checklist items), blocker types, idle risk with days at risk, and a critical-path flag; expanding a row reveals the readiness checklist, assigned resources, a recommended action and the downstream impact, with `buildReadinessExplanation` generating the explanation for not-ready activities. Everything is deterministic and display-only; the screen writes nothing. Related screens: screen-labor-capacity, screen-labor-capacity-lookahead, screen-living-graph (readiness overlay).
Source: workface/page.tsx, workface-client.tsx, lib/labor/lookahead.ts, lib/labor/crew-idle-risk.ts.
Verify: project > Labor Capacity > Workface Board tab (/projects/[projectId]/labor-capacity/workface).

# ES: Pantalla Tablero de Preparación del Frente de Obra

El Tablero de Preparación del Frente de Obra pregunta "¿las actividades próximas están listas para ejecutarse?" y muestra preparación, bloqueos y riesgo de un vistazo, en /projects/[projectId]/labor-capacity/workface (pestaña "Frente de Obra" de la navegación laboral). La página de servidor (force-dynamic, solo lectura, sin acciones de servidor) consulta `labor_resources`, `construction_activities`, `activity_dependencies`, `milestones` y `trade_taxonomy`, y precalcula `computeLookahead` y `computeCrewIdleRisk` para los horizontes de 3 y 6 semanas. El cliente une las actividades del lookahead con los datos de riesgo ocioso en filas de tablero y las ordena de peor a mejor por severidad de preparación y luego por riesgo ocioso. Las tarjetas de resumen muestran actividades totales, listas, en riesgo y bloqueadas, más el porcentaje general de preparación. Los filtros incluyen oficio, nivel de preparación, solo-ruta-crítica y solo-bloqueadas. Cada fila muestra el porcentaje de preparación, los prerrequisitos faltantes (elementos sin marcar de la lista de verificación), los tipos de bloqueo, el riesgo ocioso con días en riesgo y la marca de ruta crítica; al expandirla se ven la lista de verificación, los recursos asignados, la acción recomendada y el impacto aguas abajo, con `buildReadinessExplanation` generando la explicación de las actividades no listas. Todo es determinista y solo de visualización; la pantalla no escribe nada. Pantallas relacionadas: screen-labor-capacity, screen-labor-capacity-lookahead, screen-living-graph (superposición de preparación).
Fuente: workface/page.tsx, workface-client.tsx, lib/labor/lookahead.ts, lib/labor/crew-idle-risk.ts.
Verifica: proyecto > Capacidad Laboral > pestaña Frente de Obra (/projects/[projectId]/labor-capacity/workface).
