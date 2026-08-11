---
slug: screen-home-dashboard
route: /
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/page.tsx
  - src/lib/command-center/service.ts
  - src/lib/pmo-living-graph/single-dashboard.ts
  - src/lib/pmo-living-graph/flags.ts
  - src/lib/pmo-process-intelligence/flags.ts
---

# EN: Home dashboard (PMO Command Center) screen

The authenticated home page at `/`, the first screen after login — anonymous visitors are redirected by the middleware to `/landing` instead. What renders depends on a server flag: when `SINGLE_DASHBOARD_MODE` is on and the user is an org `owner` or `admin`, `shouldServeIntelligenceCenterAtRoot` swaps the whole page for `PmoIntelligenceCenterView` (Dashboard 3). Members and viewers always keep the PMO Command Center described here, deliberately, so promoting Dashboard 3 never hands them a 404 at the app's home. The Command Center calls `getCommandCenterSummary(organizationId, locale)`, a server-only service that aggregates org-scoped rows from `projects`, `roadmap_tasks`, `milestones`, `risks`, `material_requirements`, `rfis`, `budget_items`, `resources`, `decisions`, `process_nodes`, `process_edges`, `task_dependencies` and `audit_logs` — no fabricated data, and child rows whose parent project is soft-deleted are filtered out. Blocked counts run through `hasActiveBlocker` (REG-010). With no projects an empty state offers Import and Projects. Otherwise: six KPI cards that deep-link into prebuilt Reports (`?report=blocked_tasks_report`, `critical_path_report`, `cost_overrun_risk`, …), the Portfolio Health Engine ring with six dimension bars, Today's PMO Focus, AI Operator Briefing, Critical Path Monitor, Decision Queue, Resource & Labor Capacity, Material & Procurement Risk, Living Graph Signals, Upcoming 14 Days, Budget & Forecast Signals, Recent Activity and Quick Actions. `?auth=confirmed` shows an email-confirmed banner. Everything is read-only. Related: screen-projects-list, screen-reports, screen-team, screen-import, screen-pmo-living-graph.
Source: src/app/[locale]/(app)/page.tsx, src/lib/command-center/service.ts, src/lib/pmo-living-graph/single-dashboard.ts.
Verify: log in and land on / — the Command Center renders, or Dashboard 3 if single-dashboard mode is on and you are owner/admin.

# ES: Pantalla Dashboard de inicio (PMO Command Center)

La página de inicio autenticada en `/`, la primera pantalla tras iniciar sesión; a los visitantes anónimos el middleware los redirige a `/landing`. Lo que se muestra depende de una bandera de servidor: si `SINGLE_DASHBOARD_MODE` está activa y el usuario es `owner` o `admin` de la organización, `shouldServeIntelligenceCenterAtRoot` sustituye toda la página por `PmoIntelligenceCenterView` (Dashboard 3). Los miembros y lectores conservan siempre el PMO Command Center, a propósito, para que promover el Dashboard 3 nunca les devuelva un 404 en la portada. El Command Center llama a `getCommandCenterSummary(organizationId, locale)`, un servicio solo de servidor que agrega filas del tenant desde `projects`, `roadmap_tasks`, `milestones`, `risks`, `material_requirements`, `rfis`, `budget_items`, `resources`, `decisions`, `process_nodes`, `process_edges`, `task_dependencies` y `audit_logs` — sin datos inventados y descartando registros cuyo proyecto padre esté borrado lógicamente. Los bloqueos se calculan con `hasActiveBlocker` (REG-010). Sin proyectos aparece un estado vacío con Importar y Proyectos. Con proyectos: seis tarjetas KPI que enlazan a reportes preconstruidos (`?report=blocked_tasks_report`, `critical_path_report`, `cost_overrun_risk`, …), el anillo del Motor de Salud del Portafolio con seis dimensiones, Foco del PMO Hoy, Resumen del Operador IA, Monitor de Ruta Crítica, Cola de Decisiones, Capacidad de Recursos y Mano de Obra, Riesgo de Materiales y Compras, Señales del Living Graph, Próximos 14 Días, Señales de Presupuesto y Pronóstico, Actividad Reciente y Acciones Rápidas. Con `?auth=confirmed` se muestra un aviso de correo confirmado. Todo es de solo lectura. Relacionadas: screen-projects-list, screen-reports, screen-team, screen-import, screen-pmo-living-graph.
Fuente: src/app/[locale]/(app)/page.tsx, src/lib/command-center/service.ts, src/lib/pmo-living-graph/single-dashboard.ts.
Verifica: inicia sesión y llega a / — se muestra el Command Center, o el Dashboard 3 si el modo de dashboard único está activo y eres owner/admin.
