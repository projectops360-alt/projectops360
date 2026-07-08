---
slug: screen-import
route: /import
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/import/page.tsx
  - src/app/[locale]/(app)/import/import-client.tsx
  - src/app/[locale]/(app)/import/actions.ts
  - src/lib/import-intelligence/ai-extract.ts
  - src/lib/import-intelligence/execute.ts
  - src/lib/import-intelligence/extract.ts
  - src/lib/import-intelligence/parse.ts
  - src/lib/import-intelligence/validate.ts
---

# EN: Import (Project Import Intelligence) screen

The Project Import Intelligence wizard at `/import`, reached from the navigation, the AI Operator hub, or the Command Center empty state; `?projectId=` preselects a merge target. The client wizard flows Upload → Analyze → Review → Import → Done, and by design "nothing is imported without preview and explicit approval". Upload accepts Excel (.xlsx), CSV, JSON, Word (.docx), PDF, TXT, and Markdown up to 25 MB (stored in the `project-imports` Supabase Storage bucket), with a mode choice: create a new project or merge into an existing one, plus project type. `analyzeImportJobAction` runs the `lib/import-intelligence` engines — `parseImportFile`, `extractCanonicalImport`/`aiExtractCanonicalImport`, `buildFieldMappings`, `validateCanonicalImport` — persisting to `project_import_jobs`, `project_import_raw_data`, `project_import_mappings`, `project_import_entities`, and `project_import_validation_results`, with audit rows in `project_import_audit_events`. The Review step shows tabs (summary, tasks, milestones, dependencies, resources, materials, budget, risks, warnings, raw data) where each extracted row has confidence, validation status, and an include/exclude toggle (`toggleImportEntityAction`). Approving calls `executeImportAction` → `executeImport`, which creates the real project entities, skips duplicates, and reports whether the critical path could be calculated; `rollbackImport` exists in the library. Related screens: Projects list, AI Operator, project Command Center.

Source: src/app/[locale]/(app)/import/{page,import-client,actions}.tsx|ts, src/lib/import-intelligence/*.
Verify: open Import, upload an .xlsx or CSV, review the extracted tabs, and press "Approve & import".

# ES: Pantalla Importación (Project Import Intelligence)

El asistente de Importación Inteligente de Proyectos en `/import`, accesible desde la navegación, el hub del Operador IA o el estado vacío del Command Center; `?projectId=` preselecciona el proyecto destino. El asistente fluye Subir → Analizar → Revisar → Importar → Listo, y por diseño "nada se importa sin vista previa y aprobación explícita". La subida acepta Excel (.xlsx), CSV, JSON, Word (.docx), PDF, TXT y Markdown hasta 25 MB (guardados en el bucket de Storage `project-imports`), con modo de creación de proyecto nuevo o fusión en uno existente, y tipo de proyecto. `analyzeImportJobAction` ejecuta los motores de `lib/import-intelligence` — `parseImportFile`, `extractCanonicalImport`/`aiExtractCanonicalImport`, `buildFieldMappings`, `validateCanonicalImport` — persistiendo en `project_import_jobs`, `project_import_raw_data`, `project_import_mappings`, `project_import_entities` y `project_import_validation_results`, con auditoría en `project_import_audit_events`. La revisión muestra pestañas (resumen, tareas, hitos, dependencias, recursos, materiales, presupuesto, riesgos, advertencias, datos crudos) donde cada fila tiene confianza, estado de validación e interruptor de incluir/excluir (`toggleImportEntityAction`). Aprobar llama `executeImportAction` → `executeImport`, que crea las entidades reales, omite duplicados e informa si se pudo calcular la ruta crítica; `rollbackImport` existe en la librería. Pantallas relacionadas: Lista de proyectos, Operador IA, Command Center del proyecto.

Fuente: src/app/[locale]/(app)/import/{page,import-client,actions}.tsx|ts, src/lib/import-intelligence/*.
Verifica: abre Importar, sube un .xlsx o CSV, revisa las pestañas extraídas y pulsa "Aprobar e importar".
