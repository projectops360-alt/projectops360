---
slug: screen-labor-capacity
route: /projects/[projectId]/labor-capacity
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/labor-capacity/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/labor-capacity/labor-capacity-client.tsx
  - src/components/labor/labor-capacity-nav.tsx
  - src/lib/labor/capacity.ts
  - src/lib/labor/explanation.ts
---

# EN: Labor Capacity & Skills Matrix screen

The Labor Capacity & Skills Matrix monitors construction labor gaps, utilization and crew readiness across trades and weeks, at /projects/[projectId]/labor-capacity (the "Capacity Matrix" tab of the labor navigation, alongside Lookahead, Workface Board and a Variance tab — note: the Variance tab links to /labor-capacity/variance, a route with no page in the codebase). The server page (force-dynamic, read-only) fetches `labor_resources`, `construction_activities`, `activity_dependencies`, `milestones` and `trade_taxonomy`, then runs the deterministic `computeLaborCapacity` engine; this screen writes nothing. The client shows four summary cards (total trades, shortage weeks, critical trades, max utilization), a deterministic narrative panel built with `buildCapacitySummary` (overall severity, key numbers, cascade risks), and filters by trade, week, milestone, location and critical-path-only. The main table lists weekly capacity gaps per trade: required vs available headcount and hours, gap, utilization, risk level and critical-path flag; expanding a row shows a gap explanation (`buildGapExplanation`) plus the related activities and resources. A skills panel describes resources from the trade taxonomy (type, skill level, constraints, availability windows). An empty state appears when no labor data exists. Related screens: screen-labor-capacity-lookahead, screen-labor-capacity-workface, screen-living-graph (laborCapacity overlay), screen-resource-capacity.
Source: labor-capacity/page.tsx, labor-capacity-client.tsx, components/labor/labor-capacity-nav.tsx.
Verify: open a project > Labor Capacity (/projects/[projectId]/labor-capacity).

# ES: Pantalla Capacidad Laboral y Matriz de Habilidades

La Matriz de Capacidad Laboral y Habilidades monitorea brechas de mano de obra, utilización y preparación de cuadrillas por oficio y semana, en /projects/[projectId]/labor-capacity (pestaña "Matriz de Capacidad" de la navegación laboral, junto a Lookahead, Frente de Obra y una pestaña Varianza — nota: la pestaña Varianza enlaza a /labor-capacity/variance, una ruta sin página en el código). La página de servidor (force-dynamic, solo lectura) consulta `labor_resources`, `construction_activities`, `activity_dependencies`, `milestones` y `trade_taxonomy`, y ejecuta el motor determinista `computeLaborCapacity`; esta pantalla no escribe nada. El cliente muestra cuatro tarjetas de resumen (oficios totales, semanas con déficit, oficios críticos, utilización máxima), un panel narrativo determinista construido con `buildCapacitySummary` (severidad general, cifras clave, riesgos en cascada) y filtros por oficio, semana, hito, ubicación y solo-ruta-crítica. La tabla principal lista las brechas semanales por oficio: personal y horas requeridas vs disponibles, brecha, utilización, nivel de riesgo y marca de ruta crítica; al expandir una fila se ve la explicación de la brecha (`buildGapExplanation`) y las actividades y recursos relacionados. Un panel de habilidades describe los recursos según la taxonomía de oficios (tipo, nivel, restricciones, ventanas de disponibilidad). Si no hay datos laborales aparece un estado vacío. Pantallas relacionadas: screen-labor-capacity-lookahead, screen-labor-capacity-workface, screen-living-graph (superposición de capacidad laboral), screen-resource-capacity.
Fuente: labor-capacity/page.tsx, labor-capacity-client.tsx, components/labor/labor-capacity-nav.tsx.
Verifica: abre un proyecto > Capacidad Laboral (/projects/[projectId]/labor-capacity).
