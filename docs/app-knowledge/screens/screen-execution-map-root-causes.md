---
slug: screen-execution-map-root-causes
route: /projects/[projectId]/execution-map/root-causes
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/execution-map/root-causes/page.tsx
  - src/lib/process-mining/root-cause/load-analysis.ts
  - src/components/process-mining/root-cause-view.tsx
---

# EN: Statistical Root Cause Miner screen

The Root Cause Miner screen (CAP-046 F2) surfaces statistical evidence about which task attributes correlate with three execution problems: delay, blockage and rework. It is reached from the Execution Map tab bar via the "Root Causes" button, which navigates to /projects/[projectId]/execution-map/root-causes; a "Back to Execution Map" link returns. The page is read-only and evidence-only by contract (PD-019): it renders no recommendations anywhere. The server adapter validates the project against `projects` in the caller's organization (deny-by-default, safe denial state when unauthorized), then reads the project's tasks from `roadmap_tasks` (priority, owner, criticality, discipline, trade, location, milestone, dates), milestone names from `milestones`, and rework signals from `project_event_log` — up to 5,000 non-compensating `TaskReopened` business events counted per task. Blocked and delayed flags use the canonical REG-010 helpers (terminal tasks are never blocked; delay requires a real planned finish). The pure mineRootCauses engine produces the output the view renders: a prevalence strip with problem counts and baseline rates per problem type, a method/honesty disclosure note, and a findings table with an influence score bar, a bilingual evidence explanation with example task titles, sample size and phi correlation (n and φ), and a high/medium/low confidence badge, plus any stated limitations. There are no buttons, filters or write actions. Related screens: screen-execution-map, screen-execution-map-variants, screen-execution-map-kpis.
Source: root-causes/page.tsx, lib/process-mining/root-cause/load-analysis.ts, components/process-mining/root-cause-view.tsx.
Verify: open a project, go to Execution Map and click "Root Causes" (/projects/[projectId]/execution-map/root-causes).

# ES: Pantalla Minero Estadístico de Causas Raíz

La pantalla del Minero de Causas Raíz (CAP-046 F2) presenta evidencia estadística sobre qué atributos de las tareas se correlacionan con tres problemas de ejecución: demora, bloqueo y retrabajo. Se llega desde la barra de pestañas del Mapa de Ejecución con el botón "Causas Raíz", que navega a /projects/[projectId]/execution-map/root-causes; un enlace "Volver al Mapa de Ejecución" regresa. La página es de solo lectura y solo evidencia por contrato (PD-019): no muestra recomendaciones en ninguna parte. El adaptador de servidor valida el proyecto en `projects` dentro de la organización del usuario (denegación por defecto, estado seguro sin datos si no hay permiso), luego lee las tareas desde `roadmap_tasks` (prioridad, responsable, criticidad, disciplina, oficio, ubicación, hito, fechas), los nombres de hitos desde `milestones` y las señales de retrabajo desde `project_event_log`: hasta 5000 eventos de negocio `TaskReopened` no compensatorios contados por tarea. Los indicadores de bloqueo y demora usan las reglas canónicas REG-010 (una tarea terminal nunca está bloqueada; la demora exige una fecha de fin planificada real). El motor puro mineRootCauses genera lo que la vista muestra: un resumen de prevalencia por tipo de problema con conteos y tasas base, una nota de método y honestidad, y una tabla de hallazgos con barra de puntaje de influencia, explicación bilingüe con ejemplos de tareas, tamaño de muestra y correlación phi (n y φ), insignia de confianza y limitaciones declaradas. No hay botones, filtros ni acciones de escritura. Pantallas relacionadas: screen-execution-map, screen-execution-map-variants, screen-execution-map-kpis.
Fuente: root-causes/page.tsx, lib/process-mining/root-cause/load-analysis.ts, components/process-mining/root-cause-view.tsx.
Verifica: abre un proyecto, entra al Mapa de Ejecución y pulsa "Causas Raíz" (/projects/[projectId]/execution-map/root-causes).
