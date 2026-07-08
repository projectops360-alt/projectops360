---
slug: screen-project-drawing-intelligence
route: /projects/[projectId]/drawing-intelligence
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/drawing-intelligence/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/drawing-intelligence/drawing-intelligence-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/drawing-intelligence/actions.ts
  - src/components/drawing-intelligence/drawing-upload-zone.tsx
---

# EN: Drawing Intelligence (BIM) screen

The project Drawing Intelligence screen ("BIM — Building Information Module") turns construction drawings into structured project knowledge with evidence traceability, at /projects/[projectId]/drawing-intelligence. The server page (force-dynamic) loads `drawing_files`, `drawing_processing_jobs`, `drawing_extractions`, `drawing_insights`, `drawing_versions`, `drawing_evidence` and `roadmap_tasks` (for linking), degrading gracefully if tables are missing, and checks whether the Autodesk APS connector is configured (server-side env check only). The client has thirteen tabs: Upload (functional manual upload zone via `registerDrawingFileAction`; Autodesk connector card; Procore and Google Drive cards are explicitly "coming soon"), Library (files table with status/processing badges and buttons to process (`processDrawingFileAction`), retry (`retryDrawingProcessingJobAction`), archive (`archiveDrawingFileAction`) and open a detail panel (`getDrawingDetailAction`)), Extractions, then insight tabs filtered by type — Risks, RFIs, Submittals (incl. inspections), Schedule and Cost impacts, and Actions — where insights can change status (`updateDrawingInsightStatusAction`) and be linked to tasks (`linkDrawingInsightToTaskAction`). Takeoff generates quantity estimates (`generateTakeoffEstimateAction`); Versions shows `drawing_versions` changes; Evidence and Logs render placeholder "coming soon" panels when data is absent. Processing progress is polled via `getDrawingProcessingProgressAction`. Related screens: screen-execution-map (linked tasks), global drawing-intelligence page.
Source: drawing-intelligence/page.tsx, drawing-intelligence-client.tsx, actions.ts.
Verify: open a project > Drawing Intelligence / BIM (/projects/[projectId]/drawing-intelligence).

# ES: Pantalla Inteligencia de Planos (BIM)

La pantalla de Inteligencia de Planos del proyecto ("BIM — Módulo de Información de Construcción") convierte planos de construcción en conocimiento estructurado con trazabilidad de evidencia, en /projects/[projectId]/drawing-intelligence. La página de servidor (force-dynamic) carga `drawing_files`, `drawing_processing_jobs`, `drawing_extractions`, `drawing_insights`, `drawing_versions`, `drawing_evidence` y `roadmap_tasks` (para vincular), degradando con gracia si faltan tablas, y verifica si el conector Autodesk APS está configurado (solo variables de entorno del servidor). El cliente tiene trece pestañas: Carga (zona de carga manual funcional mediante `registerDrawingFileAction`; tarjeta del conector Autodesk; Procore y Google Drive aparecen explícitamente como "próximamente"), Biblioteca (tabla de archivos con insignias de estado y procesamiento, y botones para procesar (`processDrawingFileAction`), reintentar (`retryDrawingProcessingJobAction`), archivar (`archiveDrawingFileAction`) y abrir un panel de detalle (`getDrawingDetailAction`)), Extracciones, y luego pestañas de insights filtradas por tipo — Riesgos, RFIs, Submittals (incluye inspecciones), impactos de Cronograma y Costo, y Acciones — donde los insights pueden cambiar de estado (`updateDrawingInsightStatusAction`) y vincularse a tareas (`linkDrawingInsightToTaskAction`). Takeoff genera estimaciones de cantidades (`generateTakeoffEstimateAction`); Versiones muestra los cambios de `drawing_versions`; Evidencia y Registros muestran paneles de "próximamente" cuando no hay datos. El progreso de procesamiento se sondea con `getDrawingProcessingProgressAction`. Pantallas relacionadas: screen-execution-map (tareas vinculadas) y la página global de drawing-intelligence.
Fuente: drawing-intelligence/page.tsx, drawing-intelligence-client.tsx, actions.ts.
Verifica: abre un proyecto > Inteligencia de Planos / BIM (/projects/[projectId]/drawing-intelligence).
