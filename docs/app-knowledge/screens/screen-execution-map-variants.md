---
slug: screen-execution-map-variants
route: /projects/[projectId]/execution-map/variants
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/variants/page.tsx
  - src/components/process-mining/variant-analysis-view.tsx
  - src/lib/process-mining/variants/load-analysis.ts
  - src/lib/process-mining/variants/engine.ts
  - src/lib/events/process-mining-capture-flag.ts
---

# EN: Execution Variant Analysis screen

The CAP-046 F1 consumer, reached from the Execution Map's "Execution Variants" tab button. It answers which real execution paths the organization's projects actually follow. The page is a server component that calls `loadVariantAnalysis`, which validates the UUID, resolves the org context, confirms the focus project belongs to that organization (deny-by-default), then reads `projects` and up to 20,000 rows of `project_event_log` through the RLS-scoped client and feeds the pure `analyzeVariants` engine for the `project_lifecycle` process type. It writes nothing: no events, no canonical changes, no LLM call. The only navigation control is a "Back to Execution Map" link; there are no filters or mutations.

The view shows four summary tiles (cases, variants, events used, decided cases), a truncation notice when the event window was capped, a focus card naming this project's variant share, fitness versus the reference variant and its skipped and inserted activities, and a variant catalog table with sequence, projects, frequency, median duration, rework and success, flagging the reference variant. An honest empty state appears when no reference variant exists. Note the practical gate: it can only be as rich as the event log, and business-event capture is limited to projects listed in `PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS`. Related: screen-execution-map, screen-execution-map-root-causes, screen-execution-map-kpis, screen-milestone-flow.
Source: variants/page.tsx, src/lib/process-mining/variants/load-analysis.ts, src/components/process-mining/variant-analysis-view.tsx.
Verify: open a project, go to Execution Map, click "Execution Variants".

# ES: Pantalla Análisis de Variantes de Ejecución

El consumidor de CAP-046 F1, al que se llega desde el botón "Variantes de Ejecución" del Mapa de Ejecución. Responde qué caminos de ejecución siguen realmente los proyectos de la organización. La página es un componente de servidor que llama a `loadVariantAnalysis`, el cual valida el UUID, resuelve el contexto de la organización, confirma que el proyecto en foco le pertenece (denegación por omisión) y luego lee `projects` y hasta 20.000 filas de `project_event_log` con el cliente sujeto a RLS, para alimentar el motor puro `analyzeVariants` con el tipo de proceso `project_lifecycle`. No escribe nada: ni eventos, ni cambios canónicos, ni llamadas a un modelo de lenguaje. El único control de navegación es un enlace "Volver al Mapa de Ejecución"; no hay filtros ni mutaciones.

La vista muestra cuatro tarjetas de resumen (casos, variantes, eventos usados y casos decididos), un aviso cuando la ventana de eventos quedó truncada, una tarjeta de foco con la cuota de la variante de este proyecto, su ajuste frente a la variante de referencia y las actividades omitidas e insertadas, y un catálogo de variantes con secuencia, proyectos, frecuencia, duración mediana, retrabajo y éxito, marcando la variante de referencia. Cuando no existe variante de referencia aparece un estado vacío honesto. Ojo con el límite práctico: la pantalla solo puede ser tan rica como el registro de eventos, y la captura de eventos de negocio se limita a los proyectos listados en `PROCESS_MINING_EVENT_CAPTURE_PROJECT_IDS`. Relacionadas: screen-execution-map, screen-execution-map-root-causes, screen-execution-map-kpis, screen-milestone-flow.
Fuente: variants/page.tsx, src/lib/process-mining/variants/load-analysis.ts, src/components/process-mining/variant-analysis-view.tsx.
Verifica: abre un proyecto, entra al Mapa de Ejecución y pulsa "Variantes de Ejecución".
