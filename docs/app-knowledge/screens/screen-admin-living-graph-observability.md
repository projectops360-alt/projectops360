---
slug: screen-admin-living-graph-observability
route: /admin/living-graph-observability
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/admin/living-graph-observability/page.tsx
  - src/components/admin/living-graph-observability-panel.tsx
  - src/lib/living-graph/observability/environment-health.server.ts
---

# EN: Living Graph Observability screen

An internal admin diagnostics panel at `/admin/living-graph-observability` for the Living Graph Realtime Engine (LGRE). Access uses the same strict server-side email allowlist as the Product Brain cockpit (`isProductBrainAllowedEmail`); unauthorized users get a 404 and no diagnostics data is loaded. The code is explicit about safety: only safe aggregates reach the client — infra health booleans plus an org-scoped project list (id and display title, up to 50) — never payloads, ledger rows, or secrets. The server computes environment health via `getLivingGraphEnvironmentHealth` (which reads `project_event_log`); failures degrade to null. The client panel owns exactly one scoped realtime subscription (via `useLiveGraphSync`) and reports session counters it genuinely instruments: subscription count, active channels, reconnects, stale and fresh-recovery counts, permission losses, notices, errors, and warnings. Metrics it does not track (delta sync, recalculation, rendering — which live in-memory per graph consumer) are honestly rendered as "not instrumented", never fake zeros. Controls include a project selector, a refresh button (`router.refresh()`), and connection-state indicators. Copy comes from the `livingGraphObservability` translation namespace. Related screens: the project Living Graph (`/projects/{id}/execution-map/living-graph`) and the Backfill Console that feeds the event graph.

Source: src/app/[locale]/(app)/admin/living-graph-observability/page.tsx, src/components/admin/living-graph-observability-panel.tsx.
Verify: with an allowlisted email, open /admin/living-graph-observability and select a project to watch realtime counters.

# ES: Pantalla Observabilidad del Living Graph

Un panel interno de diagnóstico para administradores en `/admin/living-graph-observability`, dedicado al motor de tiempo real del Living Graph (LGRE). El acceso usa la misma lista blanca estricta de correos del cockpit de Product Brain (`isProductBrainAllowedEmail`), aplicada en el servidor; los no autorizados reciben un 404 y no se carga ningún dato de diagnóstico. El código es explícito en seguridad: al cliente solo llegan agregados seguros — booleanos de salud de infraestructura y una lista de proyectos de la organización (id y título, hasta 50) — nunca payloads, filas del ledger ni secretos. El servidor calcula la salud del entorno con `getLivingGraphEnvironmentHealth` (que lee `project_event_log`); los fallos degradan a null. El panel cliente posee exactamente una suscripción realtime acotada (vía `useLiveGraphSync`) y reporta los contadores de sesión que realmente instrumenta: suscripciones, canales activos, reconexiones, conteos de datos obsoletos y recuperación, pérdidas de permiso, avisos, errores y advertencias. Las métricas que no rastrea (delta sync, recálculo, render) se muestran honestamente como "no instrumentadas", nunca ceros falsos. Los controles incluyen selector de proyecto, botón de refrescar e indicadores de conexión. Pantallas relacionadas: el Living Graph del proyecto y la Consola de Backfill que alimenta el grafo de eventos.

Fuente: src/app/[locale]/(app)/admin/living-graph-observability/page.tsx, src/components/admin/living-graph-observability-panel.tsx.
Verifica: con un correo en la lista blanca, abre /admin/living-graph-observability y elige un proyecto para ver los contadores en tiempo real.
