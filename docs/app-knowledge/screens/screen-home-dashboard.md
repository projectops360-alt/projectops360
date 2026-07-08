---
slug: screen-home-dashboard
route: /
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/page.tsx
  - src/lib/command-center/service.ts
---

# EN: Home dashboard (PMO Command Center) screen

The authenticated home page at `/`, the first screen after login. It is the org-level PMO Command Center: the server page resolves the org via `getOrgContext()` and calls `getCommandCenterSummary(organizationId, locale)` from `src/lib/command-center/service.ts`, a server-only service that aggregates real, org-scoped data (projects, tasks, milestones, risks, materials, RFIs, budget) with the Supabase admin client — explicitly no fabricated data, with honest empty states. If the org has no projects, an empty state invites the user to create or import one. Otherwise the layout shows: six KPI cards (Portfolio Health, Active Projects, Blocked Tasks, Critical Path Risks, Budget Variance, PM Decisions), each drilling into its related view; the Portfolio Health Engine (overall ring plus per-dimension bars: schedule, budget, resources, materials, risk, critical path, banded green/amber/red); Today's PMO Focus; the AI Operator Briefing (recommendations with confidence); the Critical Path Monitor; the Decision Queue; Resource & Labor Capacity utilization bars; Material & Procurement Risk; Living Graph Signals; Upcoming 14 Days; Budget & Forecast Signals; and Recent Activity. Everything is read-only here; rows link out to Projects, Reports, Team, and project-level views. Bilingual copy is inlined (EN/ES).

Source: src/app/[locale]/(app)/page.tsx, src/lib/command-center/service.ts.
Verify: log in and land on / — the Command Center renders with KPI cards, or an empty state if the org has no projects.

# ES: Pantalla Dashboard de inicio (PMO Command Center)

La página de inicio autenticada en `/`, la primera pantalla tras iniciar sesión. Es el Command Center de PMO a nivel organización: la página de servidor resuelve la organización con `getOrgContext()` y llama `getCommandCenterSummary(organizationId, locale)` de `src/lib/command-center/service.ts`, un servicio solo de servidor que agrega datos reales del tenant (proyectos, tareas, hitos, riesgos, materiales, RFIs, presupuesto) con el cliente admin de Supabase — explícitamente sin datos fabricados y con estados vacíos honestos. Si la organización no tiene proyectos, un estado vacío invita a crear o importar uno. Si los hay, se muestran: seis tarjetas KPI (Salud del Portafolio, Proyectos Activos, Tareas Bloqueadas, Riesgos de Ruta Crítica, Variación de Presupuesto, Decisiones del PM), cada una con enlace a su vista; el Motor de Salud del Portafolio (anillo general y barras por dimensión: cronograma, presupuesto, recursos, materiales, riesgo, ruta crítica); Foco del PMO Hoy; el Resumen del Operador IA; el Monitor de Ruta Crítica; la Cola de Decisiones; Capacidad de Recursos y Mano de Obra; Riesgo de Materiales y Compras; Señales del Living Graph; Próximos 14 Días; Señales de Presupuesto y Pronóstico; y Actividad Reciente. Todo es de solo lectura; las filas enlazan a Proyectos, Reportes, Equipo y vistas de proyecto.

Fuente: src/app/[locale]/(app)/page.tsx, src/lib/command-center/service.ts.
Verifica: inicia sesión y llega a / — el Command Center se muestra con tarjetas KPI, o un estado vacío si no hay proyectos.
