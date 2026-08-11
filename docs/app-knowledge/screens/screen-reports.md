---
slug: screen-reports
route: /reports
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/reports/page.tsx
  - src/app/[locale]/(app)/reports/reports-client.tsx
  - src/app/[locale]/(app)/reports/actions.ts
  - src/lib/reports/registry.ts
  - src/lib/reports/query-service.ts
  - src/lib/reports/filter-engine.ts
---

# EN: Reports screen

The org-level "Reports & Intelligence" studio at `/reports`. The server page preloads saved reports and projects via `listSavedReportsAction` and `listProjectsForReportsAction`, honouring `?report=` and `?project=` deep links. Six tabs: Overview, Report Library, Report Builder, Saved Reports, Data Explorer and KPI Dictionary. The builder only queries curated datasets from the semantic layer `lib/reports/registry` — never raw SQL — currently `project_health`, `task_execution`, `budget_performance`, `financial_control`, `risk_register`, `material_requirements`, `rfi_log` and `project_memory`. `task_execution` now carries `record_type`/`parent_task` plus effort columns `estimated_hours`, `actual_hours`, `logged_hours`, `hours_variance` and `hours_variance_pct`, where actual hours come from the time log and only fall back to a hand-entered value; `financial_control` exposes baseline, funding, commitment, actuals, EAC/P50/P80, CPI/SPI and data-quality counters. You pick columns, filters (multi-value and `Paul*` wildcards, accent-insensitive — REG-038/039), grouping, sorting, visualization, calculated formula fields (with `suggestCalculatedFieldAction`), an "Include subtasks" toggle and a scope of all projects or one. Run calls `runReportAction`, logging `report_runs`, paging at 200 rows (5,000 for print) under a 5,000-row cap; result rows deep-link to the underlying record. CSV export uses `exportReportCsvAction` (logged in `report_exports`), Print renders a hidden print-only pane, and save/list/duplicate/delete use `saved_reports` with private/project/organization visibility. Related: screen-home-dashboard, screen-project-status, screen-project-budget.
Source: reports/page.tsx, reports-client.tsx, actions.ts, src/lib/reports/registry.ts, query-service.ts.
Verify: open Reports from the app navigation, pick a dataset in Report Builder, select columns, and press Run.

# ES: Pantalla Reportes

El estudio organizacional "Reportes e Inteligencia" en `/reports`. La página de servidor precarga reportes guardados y proyectos con `listSavedReportsAction` y `listProjectsForReportsAction`, respetando los enlaces directos `?report=` y `?project=`. Seis pestañas: Resumen, Biblioteca de Reportes, Constructor de Reportes, Reportes Guardados, Explorador de Datos y Diccionario de KPIs. El constructor solo consulta datasets curados de la capa semántica `lib/reports/registry` — nunca SQL crudo —: hoy `project_health`, `task_execution`, `budget_performance`, `financial_control`, `risk_register`, `material_requirements`, `rfi_log` y `project_memory`. `task_execution` ya incluye `record_type`/`parent_task` y las columnas de esfuerzo `estimated_hours`, `actual_hours`, `logged_hours`, `hours_variance` y `hours_variance_pct`, donde las horas reales vienen del registro de tiempo y solo caen al valor capturado a mano si no hay ninguno; `financial_control` expone baseline, financiamiento, compromiso, reales, EAC/P50/P80, CPI/SPI y contadores de calidad de datos. Eliges columnas, filtros (multivalor y comodines tipo `Paul*`, sin distinguir acentos — REG-038/039), agrupación, orden, visualización, campos calculados por fórmula (con `suggestCalculatedFieldAction`), un interruptor "Incluir subtareas" y un alcance de todos los proyectos o uno. Ejecutar llama `runReportAction`, registra en `report_runs` y pagina de 200 filas (5.000 al imprimir) bajo un tope de 5.000; cada fila enlaza al registro de origen. La exportación CSV usa `exportReportCsvAction` (registrada en `report_exports`), Imprimir arma un panel oculto solo para impresión, y guardar/listar/duplicar/eliminar usan `saved_reports` con visibilidad privada/proyecto/organización. Relacionadas: screen-home-dashboard, screen-project-status, screen-project-budget.
Fuente: reports/page.tsx, reports-client.tsx, actions.ts, src/lib/reports/registry.ts, query-service.ts.
Verifica: abre Reportes desde la navegación, elige un dataset en el Constructor, selecciona columnas y pulsa Ejecutar.
