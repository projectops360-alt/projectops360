---
slug: screen-execution-map-kpis
route: /projects/[projectId]/execution-map/kpis
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/kpis/page.tsx
  - src/lib/kpi/load-dataset.ts
  - src/lib/kpi/build-dataset.ts
  - src/lib/kpi/catalog.ts
  - src/lib/kpi/earned-value.ts
  - src/lib/kpi/custom-actions.ts
  - src/components/process-mining/custom-kpi-section.tsx
---

# EN: KPI Engine screen

The KPI Engine screen evaluates a project's metrics against canonical data and is reached from the "KPIs" tab button on the Execution Map. The server page calls `loadKpiDataset`, which validates org ownership (an unauthorized or invalid project id renders a denial panel, a read failure an error panel) and reads `projects`, `roadmap_tasks`, `milestones`, `budget_items` and `resources`. Only hourly `cost_rate` values are used, and budget lines are matched to milestones by `milestone_id` first and by normalised name second. Every card in the grid comes from the built-in `KPI_CATALOG` — 24 definitions covering progress, blocked and overdue tasks, effort ratios, delay percentiles, momentum and forecast, cost and budget consumption, and the Earned Value family `spi`, `cpi`, `schedule_variance_hours`, `cost_variance`, `eac` and `percent_complete_evm`, which depend on `roadmap_tasks.baseline_estimate_hours` and the baseline dates. Each card shows the value, unit, bilingual description and the raw expression; when a denominator is missing it says "not computable" rather than showing a zero. Below, `CustomKpiSection` lists persisted custom KPIs from `kpi_definitions` and lets non-viewers create them via `createCustomKpi` (server-revalidated against the sandbox allow-list) or soft-delete their own via `deleteCustomKpi`. Two honest caveats: `loadKpiDataset` returns a per-milestone `milestoneScopes` dimension that this page never renders — pinned milestone KPIs surface instead on the Gantt and Living Graph — and nothing in the app writes the baseline columns the EVM cards need. Related: screen-execution-map, screen-living-graph.
Source: execution-map/kpis/page.tsx, lib/kpi/load-dataset.ts, lib/kpi/catalog.ts, components/process-mining/custom-kpi-section.tsx.
Verify: Execution Map > "KPIs" (/projects/[projectId]/execution-map/kpis).

# ES: Pantalla Motor de KPIs

La pantalla del Motor de KPIs evalúa las métricas del proyecto sobre datos canónicos y se abre desde el botón "KPIs" del Mapa de Ejecución. La página de servidor llama a `loadKpiDataset`, que valida la pertenencia a la organización (un proyecto no autorizado o con id inválido muestra un panel de denegación; un fallo de lectura, uno de error) y consulta `projects`, `roadmap_tasks`, `milestones`, `budget_items` y `resources`. Solo se usan las tarifas `cost_rate` por hora, y las líneas de presupuesto se enlazan al hito primero por `milestone_id` y después por nombre normalizado. Cada tarjeta proviene del catálogo `KPI_CATALOG`: 24 definiciones que cubren avance, tareas bloqueadas y vencidas, esfuerzo, percentiles de retraso, impulso y pronóstico, coste y consumo de presupuesto, y la familia de Valor Ganado `spi`, `cpi`, `schedule_variance_hours`, `cost_variance`, `eac` y `percent_complete_evm`, que dependen de `roadmap_tasks.baseline_estimate_hours` y de las fechas de línea base. Cada tarjeta muestra el valor, la unidad, la descripción bilingüe y la expresión; cuando falta un denominador dice "no calculable" en lugar de mostrar un cero. Debajo, `CustomKpiSection` lista los KPIs personalizados guardados en `kpi_definitions` y permite a quien no sea viewer crearlos con `createCustomKpi` (revalidado en servidor contra la lista blanca del sandbox) o borrar los propios con `deleteCustomKpi`. Dos advertencias honestas: `loadKpiDataset` devuelve una dimensión por hito, `milestoneScopes`, que esta página nunca dibuja —los KPIs por hito aparecen en el Cronograma y el Grafo Vivo—, y nada en la aplicación escribe las columnas de línea base que necesitan las tarjetas de Valor Ganado. Relacionadas: screen-execution-map, screen-living-graph.
Fuente: execution-map/kpis/page.tsx, lib/kpi/load-dataset.ts, lib/kpi/catalog.ts, components/process-mining/custom-kpi-section.tsx.
Verifica: Mapa de Ejecución > "KPIs" (/projects/[projectId]/execution-map/kpis).
