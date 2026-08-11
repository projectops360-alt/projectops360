---
slug: screen-import
route: /import
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/import/page.tsx
  - src/app/[locale]/(app)/import/import-client.tsx
  - src/app/[locale]/(app)/import/actions.ts
  - src/app/api/import/progress/route.ts
  - src/lib/import-intelligence/parse.ts
  - src/lib/import-intelligence/extract.ts
  - src/lib/import-intelligence/ai-extract.ts
  - src/lib/import-intelligence/validate.ts
  - src/lib/import-intelligence/execute.ts
  - src/lib/import-intelligence/progress.ts
  - src/lib/import-intelligence/mpp-convert.server.ts
  - src/lib/import-intelligence/mpp-model.ts
  - src/components/import/import-progress-panel.tsx
---

# EN: Import (Project Import Intelligence) screen

The Project Import Intelligence wizard at `/import`, reached from the navigation, the Command Center header or its empty state; `?projectId=` preselects a merge target. The steps are Upload → Analyze → Review → Import → Done, and nothing is written without preview and explicit approval. Upload accepts `.xlsx/.xlsm`, CSV, JSON, `.docx`, PDF, TXT, Markdown and **Microsoft Project `.mpp`** up to 25 MB, into the `project-imports` Storage bucket; two official templates are downloadable from `/templates/`. `.mpp` has no JVM here, so `convertMppToMpxjJson` converts it inside a per-conversion Vercel Sandbox with egress denied, then rejoins the normal pipeline via `mpxjToParsedFile`. `analyzeImportJobAction` runs `parseImportFile`, `extractCanonicalImport` (with `aiExtractCanonicalImport` as fallback for unstructured text) and `validateCanonicalImport`, persisting to `project_import_jobs`, `project_import_raw_data`, `project_import_mappings`, `project_import_entities` and `project_import_validation_results`, audited in `project_import_audit_events`. Review tabs: Summary, Tasks, Milestones, Dependencies, Resources, Materials, Budget, Risks, a **Charter** tab (fills only empty Charter Center fields, never overwrites), Warnings and Raw data — each row toggles with `toggleImportEntityAction`, and a blocker like a circular dependency must be disabled first. Creating a new project now also requires choosing an **owning PMO** (governance unit). `executeImportAction` calls `create_project_v2` and writes `milestones`, `roadmap_tasks`, `task_dependencies`, `resources`, `material_requirements`, `budget_items`, `risks`, `project_charters` and `project_import_created_records`, emitting Living Graph nodes/edges and recalculating the critical path. `maxDuration` is capped at 300 s (Vercel Hobby ceiling), so derived projections may stop early and say so; progress is polled from the `/api/import/progress` route handler — not a server action, which used to queue behind the import itself. Failures roll back automatically. Related: screen-projects-list, screen-project-charter, screen-ai-operator.
Source: import/{page,import-client,actions}, src/app/api/import/progress/route.ts, src/lib/import-intelligence/*.
Verify: open Import, upload the Excel template, review the tabs, pick the owning PMO, press "Approve & import".

# ES: Pantalla Importación (Project Import Intelligence)

El asistente de Importación Inteligente de Proyectos en `/import`, accesible desde la navegación, el encabezado del Command Center o su estado vacío; `?projectId=` preselecciona el proyecto destino. Los pasos son Subir → Analizar → Revisar → Importar → Listo, y nada se escribe sin vista previa y aprobación explícita. Se aceptan `.xlsx/.xlsm`, CSV, JSON, `.docx`, PDF, TXT, Markdown y **Microsoft Project `.mpp`** hasta 25 MB, en el bucket `project-imports`; hay dos plantillas oficiales descargables desde `/templates/`. Como aquí no hay JVM, `convertMppToMpxjJson` convierte el `.mpp` en un Sandbox de Vercel creado por conversión y sin salida a red, y luego vuelve al pipeline normal con `mpxjToParsedFile`. `analyzeImportJobAction` ejecuta `parseImportFile`, `extractCanonicalImport` (con `aiExtractCanonicalImport` como respaldo para texto no estructurado) y `validateCanonicalImport`, persistiendo en `project_import_jobs`, `project_import_raw_data`, `project_import_mappings`, `project_import_entities` y `project_import_validation_results`, con auditoría en `project_import_audit_events`. Pestañas de revisión: Resumen, Tareas, Hitos, Dependencias, Recursos, Materiales, Presupuesto, Riesgos, una pestaña **Charter** (solo rellena campos vacíos del Charter Center, nunca sobrescribe), Advertencias y Datos crudos; cada fila se activa o desactiva con `toggleImportEntityAction` y un bloqueo como una dependencia circular debe desactivarse antes. Crear un proyecto nuevo exige además elegir la **PMO propietaria** (unidad de gobernanza). `executeImportAction` llama a `create_project_v2` y escribe `milestones`, `roadmap_tasks`, `task_dependencies`, `resources`, `material_requirements`, `budget_items`, `risks`, `project_charters` y `project_import_created_records`, emitiendo nodos y aristas del Living Graph y recalculando la ruta crítica. `maxDuration` está topado en 300 s (techo del plan Hobby de Vercel), así que las proyecciones derivadas pueden quedarse cortas y se informa; el progreso se consulta desde el route handler `/api/import/progress`, no desde una server action, que antes quedaba en cola detrás de la propia importación. Los fallos se revierten automáticamente. Relacionadas: screen-projects-list, screen-project-charter, screen-ai-operator.
Fuente: import/{page,import-client,actions}, src/app/api/import/progress/route.ts, src/lib/import-intelligence/*.
Verifica: abre Importar, sube la plantilla Excel, revisa las pestañas, elige la PMO propietaria y pulsa "Aprobar e importar".
