---
slug: screen-living-graph-view-workforce-intelligence
route: /projects/[projectId]/execution-map/living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/lib/capacity/formulas.ts
  - src/lib/capacity/service.ts
  - src/lib/graph/workforce-graph-mapping.ts
  - src/lib/graph/living-graph-analysis.ts
  - src/components/graph/living-graph-view.tsx
---

# EN: Living Graph — Workforce Intelligence

Workforce Intelligence (overlay id `workforceCapacity`) shows people's workload for any project type, using real team/allocation data over a 4-week window. Activate it from the Living Graph view selector (Execution Map → Living Graph → Overlay → "Workforce Intelligence"). The math is deterministic: effective hours = weekly capacity × availability% × (1 − overhead%); utilization = assigned task estimates (prorated by date overlap per week) ÷ effective hours. Status bands: available ≤69%, healthy 70–89%, near capacity 90–100%, overallocated 101–120%, critical >120%; resources without capacity data are "needs review" — nothing is invented. A floating "Workforce" roster panel lists each person with a colored utilization bar (red critical, orange overallocated, amber near capacity, gray needs review, green ok), sorted worst first. On the Milestones level, milestone cards and tasks are enriched with their assignee's status (overloaded work highlights; a banner suggests switching to Activities). On Activities/Events, the canvas becomes a curated view: only people cards (idle people read "100% available") connected to their assigned tasks by status-colored edges. Nodes with no workforce data dim; critical/overallocated highlight. If the project has no resources, the overlay simply stays empty — there is no clarity card. Action: rebalance assignments, add estimates and owners, and relieve overloaded people. Source: src/lib/capacity/formulas.ts, src/lib/capacity/service.ts, src/lib/graph/workforce-graph-mapping.ts. Verify: open a project → Execution Map → Living Graph → view selector → Workforce Intelligence.

# ES: Living Graph — Vista Inteligencia de Fuerza Laboral

Inteligencia de Fuerza Laboral (id de capa `workforceCapacity`) muestra la carga de trabajo de las personas en cualquier tipo de proyecto, con datos reales de equipo/asignaciones en una ventana de 4 semanas. Se activa desde el selector de vistas del Living Graph (Execution Map → Living Graph → Capa → "Inteligencia de Fuerza Laboral"). El cálculo es determinista: horas efectivas = capacidad semanal × %disponibilidad × (1 − %overhead); utilización = estimaciones de tareas asignadas (prorrateadas por solapamiento de fechas por semana) ÷ horas efectivas. Bandas de estado: disponible ≤69%, saludable 70–89%, cerca del límite 90–100%, sobreasignado 101–120%, crítico >120%; los recursos sin datos de capacidad quedan en "requiere revisión" — nada se inventa. Un panel flotante "Fuerza laboral" lista a cada persona con una barra de utilización coloreada (rojo crítico, naranja sobreasignado, ámbar cerca del límite, gris requiere revisión, verde ok), ordenada de peor a mejor. En el nivel Milestones, las tarjetas de hito y tareas se enriquecen con el estado de su asignado (el trabajo sobrecargado se resalta; un aviso sugiere cambiar a Actividades). En Actividades/Eventos, el lienzo se vuelve una vista curada: solo tarjetas de personas (las ociosas dicen "100% disponible") conectadas a sus tareas asignadas con aristas coloreadas por estado. Los nodos sin datos de fuerza laboral se atenúan; crítico/sobreasignado se resalta. Si el proyecto no tiene recursos, la capa queda vacía — no hay tarjeta de claridad. Acción: rebalancea asignaciones, agrega estimaciones y responsables, y alivia a las personas sobrecargadas. Fuente: src/lib/capacity/formulas.ts, src/lib/capacity/service.ts, src/lib/graph/workforce-graph-mapping.ts. Verifica: abre un proyecto → Execution Map → Living Graph → selector de vistas → Workforce Intelligence.
