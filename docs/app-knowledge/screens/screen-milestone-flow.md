---
slug: screen-milestone-flow
route: /projects/[projectId]/execution-map/milestone-flow
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/milestone-flow/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/milestone-flow/loading.tsx
  - src/lib/milestone-flow-ui/load-projection.ts
  - src/lib/milestone-flow-ui/selectors.ts
  - src/components/milestone-flow/milestone-flow-view.tsx
  - src/components/milestone-flow/transition-detail-panel.tsx
---

# EN: Milestone Process Flow screen

The Milestone Process Flow screen shows the engine-derived execution flow between milestones — health, friction and evidence — and is reached from the "Milestone Flow" tab button on the Execution Map. It is a strictly read-only consumer of the Milestone Process Flow (MPF) Engine: the server page calls `loadMilestoneFlowProjection`, which checks the project belongs to the caller's organization (deny-by-default: an unauthorized request renders a safe denial state with no data), reads `projects`, canonical `milestones`, `project_event_log` events capped at `MAX_EVENTS` = 5,000 and their `project_event_objects` rows, then invokes the deterministic engine. The route derives nothing itself, writes nothing and emits no events; `buildMilestoneFlowViewModel` only formats the projection, and `filterMilestoneFlowTransitions` filters the view-model without mutating it. The view lists milestone-to-milestone transitions with health badges, confidence level, primary reason codes, duration segment bars and finding indicators. Filters are health-status chips with counts, segment type, finding type, severity, and the checkboxes only-uncertainty, only-warnings and only-open-findings. Selecting a transition opens a `TransitionDetailPanel` with its segments and findings. Dedicated panels cover the error and unauthorized states, and a `loading.tsx` skeleton covers the fetch. A header link returns to the Execution Map. Unlike the neighbouring Execution Map tabs, this screen gained no cost, KPI-pin or baseline features. Related: screen-execution-map, screen-living-graph, screen-execution-map-kpis.
Source: milestone-flow/page.tsx, lib/milestone-flow-ui/load-projection.ts, components/milestone-flow/milestone-flow-view.tsx.
Verify: Execution Map > "Milestone Flow" (/projects/[projectId]/execution-map/milestone-flow).

# ES: Pantalla Flujo entre Hitos

La pantalla Flujo entre Hitos muestra el flujo de ejecución entre hitos derivado por motor —salud, fricción y evidencia— y se abre desde el botón "Flujo entre Hitos" del Mapa de Ejecución. Es un consumidor estrictamente de solo lectura del Motor de Flujo de Procesos entre Hitos (MPF): la página de servidor llama a `loadMilestoneFlowProjection`, que comprueba que el proyecto pertenece a la organización del usuario (denegación por defecto: una petición no autorizada muestra un estado seguro sin datos), lee `projects`, los `milestones` canónicos, los eventos de `project_event_log` con un tope de `MAX_EVENTS` = 5.000 y sus filas de `project_event_objects`, y luego invoca el motor determinista. La ruta no deriva nada por sí misma, no escribe ni emite eventos; `buildMilestoneFlowViewModel` solo da formato a la proyección y `filterMilestoneFlowTransitions` filtra el modelo de vista sin mutarlo. La vista lista las transiciones entre hitos con insignias de salud, nivel de confianza, códigos de razón, barras de segmentos de duración e indicadores de hallazgos. Los filtros son chips por estado de salud con conteos, tipo de segmento, tipo de hallazgo, severidad y las casillas solo-incertidumbre, solo-advertencias y solo-hallazgos-abiertos. Al seleccionar una transición se abre un `TransitionDetailPanel` con sus segmentos y hallazgos. Hay paneles propios para error y para acceso no autorizado, y un esqueleto `loading.tsx` durante la carga. Un enlace del encabezado regresa al Mapa de Ejecución. A diferencia de las pestañas vecinas, esta pantalla no incorporó coste, fijado de KPIs ni línea base. Relacionadas: screen-execution-map, screen-living-graph, screen-execution-map-kpis.
Fuente: milestone-flow/page.tsx, lib/milestone-flow-ui/load-projection.ts, components/milestone-flow/milestone-flow-view.tsx.
Verifica: Mapa de Ejecución > "Flujo entre Hitos" (/projects/[projectId]/execution-map/milestone-flow).
