---
slug: screen-execution-map-variants
route: /projects/[projectId]/execution-map/variants
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/variants/page.tsx
  - src/lib/process-mining/variants/load-analysis.ts
  - src/components/process-mining/variant-analysis-view.tsx
---

# EN: Execution Variant Analysis screen

The Execution Variant Analysis screen (CAP-046 F1) shows how the current project's execution path compares with every other project the caller can see. It is reached from the Execution Map tab bar via the "Execution Variants" button, which navigates to /projects/[projectId]/execution-map/variants; a "Back to Execution Map" link returns. The server page is strictly read-only: the adapter validates the focus project against `projects` in the caller's organization (deny-by-default; unauthorized users get a safe denial state with no data), then reads all visible projects plus up to 20,000 business events from `project_event_log` — the Process Event Graph, the only event source — ordered by occurred_at and sequence_number, and feeds them as cases to the pure analyzeVariants engine for the `project_lifecycle` process type. Outcomes come only from canonical project status (completed = success, cancelled = failure, otherwise open). The view renders a summary strip (analyzed cases, variants, events used, decided cases), a truncation notice when the event window was capped, a focus-project card with its variant share, fitness versus the reference variant and skipped/inserted activities, an honest empty state when no reference exists, and a variant catalog table with activity-signature chips, project count, frequency, median duration, rework rate and success rate. No filters, no mutations, no event emission. Related screens: screen-execution-map, screen-execution-map-root-causes, screen-execution-map-kpis.
Source: variants/page.tsx, lib/process-mining/variants/load-analysis.ts, components/process-mining/variant-analysis-view.tsx.
Verify: open a project, go to Execution Map and click "Execution Variants" (/projects/[projectId]/execution-map/variants).

# ES: Pantalla Análisis de Variantes de Ejecución

La pantalla de Análisis de Variantes de Ejecución (CAP-046 F1) muestra cómo se compara la ruta de ejecución del proyecto actual con la de los demás proyectos visibles para el usuario. Se llega desde la barra de pestañas del Mapa de Ejecución con el botón "Variantes de Ejecución", que navega a /projects/[projectId]/execution-map/variants; un enlace "Volver al Mapa de Ejecución" regresa. La página de servidor es estrictamente de solo lectura: el adaptador valida el proyecto en `projects` dentro de la organización del usuario (denegación por defecto; sin permiso se muestra un estado seguro sin datos), luego lee todos los proyectos visibles y hasta 20 000 eventos de negocio de `project_event_log` — el Grafo de Eventos del Proyecto, única fuente de eventos — ordenados por fecha y número de secuencia, y los entrega como casos al motor puro analyzeVariants para el tipo de proceso `project_lifecycle`. Los desenlaces provienen solo del estado canónico del proyecto (completado = éxito, cancelado = fracaso, el resto abierto). La vista muestra un resumen (casos, variantes, eventos usados, casos decididos), un aviso de truncamiento cuando se alcanzó el límite, una tarjeta del proyecto con su variante, ajuste frente a la referencia y actividades omitidas o insertadas, un estado vacío honesto cuando no hay referencia, y un catálogo de variantes con secuencia de actividades, cantidad de proyectos, frecuencia, duración mediana, tasa de retrabajo y tasa de éxito. Sin filtros ni mutaciones. Pantallas relacionadas: screen-execution-map, screen-execution-map-root-causes, screen-execution-map-kpis.
Fuente: variants/page.tsx, lib/process-mining/variants/load-analysis.ts, components/process-mining/variant-analysis-view.tsx.
Verifica: abre un proyecto, entra al Mapa de Ejecución y pulsa "Variantes de Ejecución" (/projects/[projectId]/execution-map/variants).
