---
slug: screen-pmo-living-graph
route: /pmo-living-graph
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/pmo-living-graph/page.tsx
  - src/components/pmo-living-graph/intelligence-center-view.tsx
  - src/components/pmo-living-graph/portfolio-graph-shell.tsx
  - src/components/pmo-living-graph/graph-toolbar.tsx
  - src/lib/pmo-living-graph/flags.ts
  - src/lib/pmo-living-graph/single-dashboard.ts
  - src/lib/pmo-living-graph/read-model.server.ts
  - src/lib/pmo-intelligence/read-model.server.ts
  - src/lib/pmo-intelligence/dashboard-model.ts
---

# EN: PMO Intelligence Center (Dashboard 3 — PMO Living Graph) screen

The portfolio-wide graph dashboard. Two gates decide whether you see it at all. `canAccessPmoLivingGraph` requires the `PMO_LIVING_GRAPH_ENABLED` flag — **default OFF** — *and* an `owner`/`admin` role; anyone else gets `notFound()`, so with the flag off the route simply does not exist. Separately, `SINGLE_DASHBOARD_MODE` (also default OFF) promotes this dashboard to `/`: when it is on, `/pmo-living-graph` **redirects to the root** rather than rendering, keeping bookmarks and Isabella deep links alive, while `/process-intelligence` retires and the dashboard switcher disappears. Both routes render one implementation, `PmoIntelligenceCenterView`, so they cannot drift.

That component reads the URL scope on the server (organization always from the session, never the query string), calls `loadPmoIntelligence` and flattens it with `toDashboardSlice`. Per ADR-012 it composes and never computes. The read model queries `organizations`, `projects`, `milestones`, `roadmap_tasks`, `task_subtasks`, `risks`, `decisions`, `resources`, `stakeholders`, `kpi_definitions`, `budget_items`, `task_dependencies`, `traceability_links` and `project_resource_allocations`. It distinguishes "unavailable" (a query failed) from "empty" and shows different screens for each. The toolbar has search, node-kind filters, a confidence-floor slider, Focus mode, Find path, blast radius at 1–3 hops, and Save/Reset layout, which persist positions per organization and user. Read-only by contract; insight feedback writes to `audit_logs`. Related: screen-process-intelligence, screen-living-graph.
Source: src/app/[locale]/(app)/pmo-living-graph/page.tsx, src/components/pmo-living-graph/intelligence-center-view.tsx, src/lib/pmo-living-graph/{flags,single-dashboard}.ts.
Verify: as an owner/admin with `PMO_LIVING_GRAPH_ENABLED=true` and single-dashboard mode off, open /pmo-living-graph and double-click a project node.

# ES: Pantalla PMO Intelligence Center (Dashboard 3 — PMO Living Graph)

El tablero de grafo a nivel de portafolio. Dos controles deciden si llegas a verlo. `canAccessPmoLivingGraph` exige la bandera `PMO_LIVING_GRAPH_ENABLED` —**apagada por omisión**— *y* un rol `owner`/`admin`; cualquier otro recibe `notFound()`, así que con la bandera apagada la ruta sencillamente no existe. Aparte, `SINGLE_DASHBOARD_MODE` (también apagada por omisión) promueve este tablero a `/`: cuando está encendida, `/pmo-living-graph` **redirige a la raíz** en lugar de renderizar, con lo que sobreviven los marcadores y los enlaces profundos de Isabella, mientras `/process-intelligence` se retira y desaparece el conmutador de tableros. Ambas rutas renderizan una sola implementación, `PmoIntelligenceCenterView`, para que no puedan divergir.

Ese componente lee el alcance desde la URL en el servidor (la organización siempre viene de la sesión, nunca de la cadena de consulta), llama a `loadPmoIntelligence` y lo aplana con `toDashboardSlice`. Según ADR-012 compone y nunca calcula. El modelo de lectura consulta `organizations`, `projects`, `milestones`, `roadmap_tasks`, `task_subtasks`, `risks`, `decisions`, `resources`, `stakeholders`, `kpi_definitions`, `budget_items`, `task_dependencies`, `traceability_links` y `project_resource_allocations`. Distingue "no disponible" (una consulta falló) de "vacío" y muestra pantallas distintas para cada caso. La barra de herramientas tiene búsqueda, filtros por tipo de nodo, un deslizador de confianza mínima, modo Enfoque, Buscar ruta, radio de impacto de 1 a 3 saltos y Guardar/Restablecer diseño, que persisten las posiciones por organización y usuario. Es de solo lectura por contrato; la retroalimentación sobre hallazgos se escribe en `audit_logs`. Relacionadas: screen-process-intelligence, screen-living-graph.
Fuente: src/app/[locale]/(app)/pmo-living-graph/page.tsx, src/components/pmo-living-graph/intelligence-center-view.tsx, src/lib/pmo-living-graph/{flags,single-dashboard}.ts.
Verifica: como owner/admin con `PMO_LIVING_GRAPH_ENABLED=true` y el modo de tablero único apagado, abre /pmo-living-graph y haz doble clic en un nodo de proyecto.
