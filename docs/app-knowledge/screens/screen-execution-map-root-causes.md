---
slug: screen-execution-map-root-causes
route: /projects/[projectId]/execution-map/root-causes
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/root-causes/page.tsx
  - src/components/process-mining/root-cause-view.tsx
  - src/lib/process-mining/root-cause/load-analysis.ts
  - src/lib/process-mining/root-cause/engine.ts
  - src/lib/execution/task-activity.ts
---

# EN: Statistical Root Cause Miner screen

The CAP-046 F2 consumer, reached from the Execution Map's "Root Causes" tab button. It asks which attributes of this project's work correlate with trouble. The server page calls `loadRootCauseAnalysis`, which validates the UUID, resolves the org context and confirms the project belongs to it (deny-by-default, returning a safe denial state with no data), then reads `roadmap_tasks`, `milestones` and `TaskReopened` rows from `project_event_log` (capped at 5,000) through the RLS-scoped client. Problem flags follow the REG-010 canonical helpers: `hasActiveBlocker` for blockage, and a delay rule where a terminal-but-not-completed task is never late and a completed task is late only if `completed_at` exceeds `end_date`. The pure `mineRootCauses` engine then crosses three problem types — delay, blockage, rework — against the dimensions ownership, priority, criticality, milestone, discipline, trade and location, keeping at most five findings per problem.

The view is a findings table with an influence score, a written evidence line, sample size, confidence and example tasks, plus a method note. It is evidence-only by contract: no recommendations, and no per-person dimension, since ownership is analysed solely as assigned versus unassigned. Nothing is written and no LLM is called. The only other control is "Back to Execution Map". Related: screen-execution-map, screen-execution-map-variants, screen-execution-map-kpis.
Source: root-causes/page.tsx, src/lib/process-mining/root-cause/load-analysis.ts, src/components/process-mining/root-cause-view.tsx.
Verify: open a project, go to Execution Map, click "Root Causes".

# ES: Pantalla Minero Estadístico de Causas Raíz

El consumidor de CAP-046 F2, al que se llega desde el botón "Causas Raíz" del Mapa de Ejecución. Pregunta qué atributos del trabajo de este proyecto se correlacionan con los problemas. La página de servidor llama a `loadRootCauseAnalysis`, que valida el UUID, resuelve el contexto de la organización y confirma que el proyecto le pertenece (denegación por omisión, devolviendo un estado seguro sin datos), y después lee `roadmap_tasks`, `milestones` y las filas `TaskReopened` de `project_event_log` (con tope de 5.000) mediante el cliente sujeto a RLS. Las marcas de problema siguen los ayudantes canónicos de REG-010: `hasActiveBlocker` para el bloqueo, y una regla de retraso según la cual una tarea terminal pero no completada nunca va tarde, y una completada solo va tarde si `completed_at` supera a `end_date`. Luego el motor puro `mineRootCauses` cruza tres tipos de problema —retraso, bloqueo y retrabajo— contra las dimensiones responsabilidad, prioridad, criticidad, hito, disciplina, oficio y ubicación, conservando como máximo cinco hallazgos por problema.

La vista es una tabla de hallazgos con puntaje de influencia, una línea de evidencia redactada, tamaño de muestra, confianza y tareas de ejemplo, además de una nota metodológica. Por contrato solo aporta evidencia: no da recomendaciones ni tiene dimensión por persona, ya que la responsabilidad se analiza únicamente como asignada frente a no asignada. No escribe nada ni invoca ningún modelo de lenguaje. El otro único control es "Volver al Mapa de Ejecución". Relacionadas: screen-execution-map, screen-execution-map-variants, screen-execution-map-kpis.
Fuente: root-causes/page.tsx, src/lib/process-mining/root-cause/load-analysis.ts, src/components/process-mining/root-cause-view.tsx.
Verifica: abre un proyecto, entra al Mapa de Ejecución y pulsa "Causas Raíz".
