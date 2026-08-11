---
slug: screen-process-intelligence
route: /process-intelligence
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/process-intelligence/page.tsx
  - src/app/[locale]/(app)/process-intelligence/actions.ts
  - src/components/pmo-process-intelligence/command-center-shell.tsx
  - src/lib/pmo-process-intelligence/flags.ts
  - src/lib/pmo-process-intelligence/read-model.server.ts
  - src/lib/pmo-process-intelligence/overlays-read.server.ts
  - src/lib/pmo-process-intelligence/hierarchy-read.server.ts
  - src/lib/pmo-process-intelligence/insights.ts
  - src/lib/pmo-living-graph/single-dashboard.ts
---

# EN: Process Intelligence Command Center screen

Do not confuse this with `/product-intelligence` (screen-product-intelligence), which is a repo-documentation cockpit. **Process** Intelligence is Dashboard 2: portfolio process analytics mined from the Project Event Graph.

It is doubly gated and often dark. `canAccessProcessIntelligence` requires the `PMO_PROCESS_INTELLIGENCE_DASHBOARD_ENABLED` flag — **default OFF** — plus an `owner`/`admin` role. On top of that, `isProcessIntelligenceRouteRetired()` makes the route `notFound()` for everyone whenever `SINGLE_DASHBOARD_MODE` is on; that check runs first, before the org read. The module behind it stays alive either way, because Dashboard 3 composes the same read models.

When it does render, the server calls `loadPmoPiFlowModel` (organization scope, and a second focused call when `?project=` is set), `loadPmoPiFinanceOverlay`, `loadPmoPiOverlays`, `loadPmoPiHierarchy` and `buildInsights`, then hands them to `CommandCenterShell`. Reads cover `project_event_log`, `projects`, `project_charters`, `stakeholders`, `risks`, `task_dependencies`, `milestones` and `roadmap_tasks`. Seven overlays switch the same canvas: Process, Risk, Finance, Resources, Dependencies, Benefits and What-if, selectable via `?overlay=`. A technical event explorer, a realtime refresh and an Isabella insights panel are included; insight feedback goes through `recordInsightFeedbackAction`. An unauthorized or foreign `?project=` is treated as no access. Related: screen-pmo-living-graph, screen-product-intelligence.
Source: src/app/[locale]/(app)/process-intelligence/page.tsx, src/components/pmo-process-intelligence/command-center-shell.tsx, src/lib/pmo-process-intelligence/flags.ts.
Verify: as an owner/admin with the flag on and single-dashboard mode off, open /process-intelligence and switch the overlay to Finance.

# ES: Pantalla Centro de Mando de Inteligencia de Procesos

No la confundas con `/product-intelligence` (screen-product-intelligence), que es una cabina sobre la documentación del repositorio. Inteligencia **de Procesos** es el Dashboard 2: analítica de procesos del portafolio, minada del Project Event Graph.

Tiene doble control y a menudo está apagada. `canAccessProcessIntelligence` exige la bandera `PMO_PROCESS_INTELLIGENCE_DASHBOARD_ENABLED` —**apagada por omisión**— más un rol `owner`/`admin`. Además, `isProcessIntelligenceRouteRetired()` hace que la ruta devuelva `notFound()` para todos cuando `SINGLE_DASHBOARD_MODE` está encendido; esa comprobación ocurre primero, antes de leer el contexto de la organización. El módulo subyacente sigue vivo en cualquier caso, porque el Dashboard 3 compone los mismos modelos de lectura.

Cuando sí se renderiza, el servidor llama a `loadPmoPiFlowModel` (alcance de organización, y una segunda llamada enfocada si viene `?project=`), `loadPmoPiFinanceOverlay`, `loadPmoPiOverlays`, `loadPmoPiHierarchy` y `buildInsights`, y se los pasa a `CommandCenterShell`. Las lecturas abarcan `project_event_log`, `projects`, `project_charters`, `stakeholders`, `risks`, `task_dependencies`, `milestones` y `roadmap_tasks`. Siete capas reproyectan el mismo lienzo: Proceso, Riesgo, Finanzas, Recursos, Dependencias, Beneficios y What-if, seleccionables con `?overlay=`. Incluye un explorador técnico de eventos, refresco en tiempo real y un panel de hallazgos de Isabella; la retroalimentación pasa por `recordInsightFeedbackAction`. Un `?project=` ajeno o no autorizado se trata como falta de acceso. Relacionadas: screen-pmo-living-graph, screen-product-intelligence.
Fuente: src/app/[locale]/(app)/process-intelligence/page.tsx, src/components/pmo-process-intelligence/command-center-shell.tsx, src/lib/pmo-process-intelligence/flags.ts.
Verifica: como owner/admin con la bandera encendida y el modo de tablero único apagado, abre /process-intelligence y cambia la capa a Finanzas.
