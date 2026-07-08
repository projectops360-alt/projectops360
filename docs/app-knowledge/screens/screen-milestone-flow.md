---
slug: screen-milestone-flow
route: /projects/[projectId]/execution-map/milestone-flow
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/milestone-flow/page.tsx
  - src/lib/milestone-flow-ui/load-projection.ts
  - src/lib/milestone-flow-ui/selectors.ts
  - src/components/milestone-flow/milestone-flow-view.tsx
  - src/components/milestone-flow/transition-detail-panel.tsx
---

# EN: Milestone Process Flow screen

The Milestone Process Flow screen shows the engine-derived execution flow between milestones — health, friction and evidence — and is reached from the "Milestone Flow" tab button on the Execution Map. It is a strictly read-only consumer of the Milestone Process Flow (MPF) Engine: the server page calls `loadMilestoneFlowProjection`, which validates the project belongs to the caller's organization (deny-by-default: unauthorized access renders a safe denial state with no data), reads canonical `milestones` plus `project_event_log` events (capped at 5,000), and invokes the deterministic engine. The route derives nothing itself, mutates nothing, and emits no events; `buildMilestoneFlowViewModel` only formats the projection for display. The view lists milestone-to-milestone transitions with health status badges, confidence level and primary reason codes, duration segment bars, and finding indicators. Filter controls include health-status chips with counts, segment type, finding type, severity, and toggles such as only-uncertainty, only-warnings and only-open-findings. Selecting a transition opens a TransitionDetailPanel with its segments and findings. Error and unauthorized states render dedicated panels. A header link returns to the Execution Map. Related screens: screen-execution-map, screen-living-graph.
Source: milestone-flow/page.tsx, lib/milestone-flow-ui/load-projection.ts, components/milestone-flow/milestone-flow-view.tsx.
Verify: Execution Map > "Milestone Flow" (/projects/[projectId]/execution-map/milestone-flow).

# ES: Pantalla Flujo entre Hitos

La pantalla Flujo entre Hitos muestra el flujo de ejecución entre hitos derivado por motor — salud, fricción y evidencia — y se llega desde el botón "Flujo entre Hitos" del Mapa de Ejecución. Es un consumidor estrictamente de solo lectura del Motor de Flujo de Procesos entre Hitos (MPF): la página de servidor llama a `loadMilestoneFlowProjection`, que valida que el proyecto pertenezca a la organización del usuario (denegación por defecto: un acceso no autorizado muestra un estado seguro sin datos), lee los `milestones` canónicos y los eventos de `project_event_log` (máximo 5,000) e invoca el motor determinista. La ruta no deriva nada por sí misma, no muta datos ni emite eventos; `buildMilestoneFlowViewModel` solo da formato a la proyección. La vista lista las transiciones entre hitos con insignias de estado de salud, nivel de confianza y códigos de razón, barras de segmentos de duración e indicadores de hallazgos. Los filtros incluyen chips por estado de salud con conteos, tipo de segmento, tipo de hallazgo, severidad y alternadores como solo-incertidumbre, solo-advertencias y solo-hallazgos-abiertos. Al seleccionar una transición se abre un panel de detalle con sus segmentos y hallazgos. Los estados de error y de no autorizado tienen paneles propios. Un enlace del encabezado regresa al Mapa de Ejecución. Pantallas relacionadas: screen-execution-map, screen-living-graph.
Fuente: milestone-flow/page.tsx, lib/milestone-flow-ui/load-projection.ts, components/milestone-flow/milestone-flow-view.tsx.
Verifica: Mapa de Ejecución > "Flujo entre Hitos" (/projects/[projectId]/execution-map/milestone-flow).
