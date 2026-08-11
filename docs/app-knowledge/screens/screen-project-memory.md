---
slug: screen-project-memory
route: /projects/[projectId]/memory
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/memory/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/memory/memory-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/memory/actions.ts
  - src/app/[locale]/(app)/projects/[projectId]/memory/scribe-actions.ts
  - src/app/[locale]/(app)/projects/[projectId]/memory/search-action.ts
  - src/components/memory/scribe-modal.tsx
  - src/components/memory/memory-detail-panel.tsx
---

# EN: Project Memory screen

Per-project institutional memory (CAP-006/CAP-008), opened from the project's Memory tab. The server page verifies the project belongs to the org (404 otherwise) and loads up to 500 `project_memory_items` with their `traceability_links` (`source_type` "memory"), the linkable entities (`roadmap_tasks`, `milestones`, `risks`, `stakeholders`, `decisions`, `documents`, `communication_items`, `meetings`) and the counts for the secondary tabs. Seven tabs: Memory (the capture timeline), Overview (a merged read-only activity feed), Communications, Meetings, Decisions, Documents and Search. The "ProjectOps Scribe" button opens the capture modal: type, paste or Dictate via the browser Web Speech API; `analyzeScribeAction` extracts action items, decisions, follow-ups and risks with verbatim source excerpts, and only items the user approves are written by `saveScribeEntryAction`. Note what Scribe actually creates — approved action items become **`project_backlog_items`**, tagged with the project's `project_delivery_frameworks` row so they surface under Delivery → Refinement, not `roadmap_tasks`; decisions go to `decisions` and risks to `risks`. Every capture carries a client-generated `captureOperationId` used as the idempotency anchor (`…:item:N`) so a retried save cannot duplicate risks; the action refuses to create entities without it. Provenance is recorded in `project_scribe_items` and, where the link type allows, in `traceability_links`. Item actions: create, update, archive, reclassify with AI, reindex, link/unlink, and an artifacts view (`getMemoryArtifactsAction`) showing what a note produced. Indexing runs fire-and-forget via pgvector (`ai_status`/`index_status`); `searchMemoryAction` combines the `match_documents` RPC with keyword search scoped to org and project. `?item=` deep-links an item.
Source: memory/{page,memory-client,actions,scribe-actions,search-action}, src/components/memory/scribe-modal.tsx.
Verify: open a project, go to /projects/[projectId]/memory and click "ProjectOps Scribe".

# ES: Pantalla Memoria del Proyecto

Memoria institucional por proyecto (CAP-006/CAP-008), accesible desde la pestaña Memoria del proyecto. La página de servidor comprueba que el proyecto pertenezca a la organización (si no, devuelve 404) y carga hasta 500 `project_memory_items` con sus `traceability_links` (`source_type` "memory"), las entidades vinculables (`roadmap_tasks`, `milestones`, `risks`, `stakeholders`, `decisions`, `documents`, `communication_items`, `meetings`) y los conteos de las pestañas secundarias. Siete pestañas: Memoria (la línea de tiempo de capturas), Resumen (un feed de actividad combinado y de solo lectura), Comunicaciones, Reuniones, Decisiones, Documentos y Buscar. El botón "ProjectOps Scribe" abre el modal de captura: escribir, pegar o Dictar con la Web Speech API del navegador; `analyzeScribeAction` extrae acciones, decisiones, seguimientos y riesgos con extractos textuales del origen, y solo los elementos aprobados los escribe `saveScribeEntryAction`. Conviene saber qué crea realmente Scribe: las acciones aprobadas se convierten en **`project_backlog_items`**, etiquetados con el `project_delivery_frameworks` del proyecto para que aparezcan en Delivery → Refinamiento, no en `roadmap_tasks`; las decisiones van a `decisions` y los riesgos a `risks`. Cada captura lleva un `captureOperationId` generado en el cliente que sirve de ancla de idempotencia (`…:item:N`) para que un reintento no duplique riesgos; la acción se niega a crear entidades sin él. La procedencia queda en `project_scribe_items` y, cuando el tipo de enlace lo permite, en `traceability_links`. Acciones sobre elementos: crear, actualizar, archivar, reclasificar con IA, reindexar, vincular o desvincular, y una vista de artefactos (`getMemoryArtifactsAction`) que muestra qué produjo cada nota. El indexado corre en segundo plano sobre pgvector (`ai_status`/`index_status`); `searchMemoryAction` combina el RPC `match_documents` con búsqueda por palabras clave acotada a organización y proyecto. `?item=` abre un elemento concreto.
Fuente: memory/{page,memory-client,actions,scribe-actions,search-action}, src/components/memory/scribe-modal.tsx.
Verifica: abre un proyecto, ve a /projects/[projectId]/memory y pulsa "ProjectOps Scribe".
