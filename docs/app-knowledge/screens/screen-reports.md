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
---

# EN: Reports screen

The org-level "Reports & Intelligence" studio at `/reports` (subtitle: create executive dashboards, analyze performance, build custom reports from trusted datasets). The server page preloads saved reports and the project list via `listSavedReportsAction` and `listProjectsForReportsAction`, honoring `?report=` and `?project=` URL params for deep links. The client is a tabbed studio: Overview, Report Library (prebuilt reports from `lib/reports/report-library`), Report Builder, Saved Reports, Data Explorer, and KPI Dictionary (`lib/reports/kpi-dictionary`). The builder works only against curated datasets from the semantic layer (`lib/reports/registry`) — never raw SQL — with columns, filters, grouping, sorting, visualization type, calculated fields (formula expressions, plus an AI helper via `suggestCalculatedFieldAction`), and a scope selector for all projects or a single project. Running a report calls `runReportAction` (logs to `report_runs`, results capped at 5,000 rows); CSV export goes through `exportReportCsvAction` (logged in `report_exports`); saving, listing, duplicating, and deleting use the `saved_reports` table with private/project/organization visibility. Related screens: Home dashboard (links here from Budget & Forecast Signals) and project-level Status Report.

Source: src/app/[locale]/(app)/reports/page.tsx, reports-client.tsx, actions.ts, src/lib/reports/*.
Verify: open Reports from the app navigation, pick a dataset in Report Builder, select columns, and press Run.

# ES: Pantalla Reportes

El estudio organizacional "Reportes e Inteligencia" en `/reports` (subtítulo: crear dashboards ejecutivos, analizar desempeño y construir reportes a la medida desde datasets confiables). La página de servidor precarga reportes guardados y la lista de proyectos con `listSavedReportsAction` y `listProjectsForReportsAction`, respetando los parámetros `?report=` y `?project=` para enlaces directos. El cliente es un estudio con pestañas: Resumen, Biblioteca de Reportes (prediseñados en `lib/reports/report-library`), Constructor de Reportes, Reportes Guardados, Explorador de Datos y Diccionario de KPIs (`lib/reports/kpi-dictionary`). El constructor trabaja solo contra datasets curados de la capa semántica (`lib/reports/registry`) — nunca SQL crudo — con columnas, filtros, agrupación, orden, tipo de visualización, campos calculados (fórmulas, con ayudante de IA vía `suggestCalculatedFieldAction`) y un selector de alcance: todos los proyectos o uno solo. Ejecutar llama `runReportAction` (registra en `report_runs`, máximo 5.000 filas mostradas); la exportación CSV usa `exportReportCsvAction` (registrada en `report_exports`); guardar, listar, duplicar y eliminar usan la tabla `saved_reports` con visibilidad privada/proyecto/organización. Pantallas relacionadas: dashboard de inicio y el Reporte de Estado por proyecto.

Fuente: src/app/[locale]/(app)/reports/page.tsx, reports-client.tsx, actions.ts, src/lib/reports/*.
Verifica: abre Reportes desde la navegación, elige un dataset en el Constructor, selecciona columnas y pulsa Ejecutar.
