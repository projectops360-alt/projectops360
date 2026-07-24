---
slug: screen-execution-map-kpis
route: /projects/[projectId]/execution-map/kpis
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/kpis/page.tsx
  - src/lib/kpi/load-dataset.ts
  - src/lib/kpi/catalog.ts
  - src/lib/kpi/custom-actions.ts
  - src/components/process-mining/custom-kpi-section.tsx
---

# EN: KPI Engine screen

The KPI Engine screen (CAP-046 F3) shows project metrics computed by the single KPI engine that Isabella and reports also use, so no metric drift exists. It is reached from the Execution Map tab bar: the "KPIs" button navigates to /projects/[projectId]/execution-map/kpis; a "Back to Execution Map" link returns. The server page loads a read-only, RLS-scoped dataset from tables `roadmap_tasks` and `milestones` (after validating the project in `projects`), with blocker/overdue/delayed flags derived by the canonical REG-010 helpers in task-activity.ts. It renders the 12 built-in catalog KPIs as cards (overall_progress, blocked_tasks, overdue_tasks, unassigned_tasks, avg_task_progress, median_task_duration, effort_ratio, estimate_correlation, milestone_delay_p90, completion_trend, completion_momentum, forecast_completions_next_week), each with value, unit, description and its expression; values that cannot be computed show an honest "not computable" state instead of fake zeros. Below, the Custom KPI section lists persisted custom definitions from table `kpi_definitions` (project-scoped plus org-wide), evaluated against the same dataset and sandbox. Non-viewer roles can create a custom KPI (name ES/EN, expression, unit, target, direction — server actions createCustomKpi/deleteCustomKpi validate the expression against an allow-list before persisting) and soft-delete their own (or any, as org owner/admin). A hint notes Isabella can translate natural language into expressions. Related screens: screen-execution-map, screen-execution-map-variants, screen-execution-map-root-causes.
Source: kpis/page.tsx, lib/kpi/load-dataset.ts, lib/kpi/catalog.ts, lib/kpi/custom-actions.ts, components/process-mining/custom-kpi-section.tsx.
Verify: open a project, go to Execution Map and click the "KPIs" tab (/projects/[projectId]/execution-map/kpis).

# ES: Pantalla Motor de KPIs

La pantalla Motor de KPIs (CAP-046 F3) muestra las métricas del proyecto calculadas por el mismo motor de KPIs que usan Isabella y los reportes, de modo que no hay divergencia de métricas. Se llega desde la barra de pestañas del Mapa de Ejecución: el botón "KPIs" navega a /projects/[projectId]/execution-map/kpis, y un enlace "Volver al Mapa de Ejecución" regresa. La página de servidor carga un conjunto de datos de solo lectura, limitado por RLS, desde las tablas `roadmap_tasks` y `milestones` (tras validar el proyecto en `projects`), con los indicadores de bloqueo, atraso y demora derivados por las reglas canónicas REG-010 de task-activity.ts. Renderiza como tarjetas los 12 KPIs integrados del catálogo (progreso general, tareas bloqueadas, vencidas, sin asignar, progreso promedio, duración mediana, razón de esfuerzo, correlación de estimados, percentil 90 de demora de hitos, tendencia, impulso y pronóstico de completadas), cada una con valor, unidad, descripción y expresión; lo que no puede calcularse muestra un estado honesto de "no calculable" en lugar de ceros falsos. Debajo, la sección de KPIs personalizados lista las definiciones guardadas en la tabla `kpi_definitions`, evaluadas con el mismo motor. Los roles distintos de espectador pueden crear un KPI personalizado (las acciones de servidor validan la expresión contra una lista permitida antes de guardar) y borrarlo de forma suave (creador o administrador). Pantallas relacionadas: screen-execution-map, screen-execution-map-variants, screen-execution-map-root-causes.
Fuente: kpis/page.tsx, lib/kpi/load-dataset.ts, lib/kpi/catalog.ts, lib/kpi/custom-actions.ts, components/process-mining/custom-kpi-section.tsx.
Verifica: abre un proyecto, entra al Mapa de Ejecución y pulsa la pestaña "KPIs" (/projects/[projectId]/execution-map/kpis).
