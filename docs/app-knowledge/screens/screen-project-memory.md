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
---

# EN: Project Memory screen

Per-project institutional memory (CAP-006/CAP-008): every captured note, email, meeting note or evidence lives here, classified, vectorized and linkable to project entities. The server page loads up to 500 project_memory_items with their traceability_links (source_type "memory"), plus linkable entities (roadmap_tasks, milestones, risks, stakeholders, decisions, documents, communication_items, meetings) and counts for the secondary tabs. Tabs: Memory (timeline of items), Overview (unified activity feed), Communications, Meetings, Decisions, Documents (each with counts and "Manage" links to their module) and Search. The "ProjectOps Scribe" button opens the capture modal: write, paste or Dictate (browser Web Speech API); analyzeScribeAction extracts structured actions, decisions, follow-ups and risks with verbatim source excerpts; the user reviews and only approved items are saved by saveScribeEntryAction into project_memory_items (+ project_scribe_items), creating the approved entities linked back via traceability_links. Item actions: create, update, archive (also de-indexes), reclassify with AI, reindex, link/unlink entities — creation triggers fire-and-forget AI classification and pgvector indexing (ai_status / index_status), all audit-logged. searchMemoryAction runs semantic plus keyword search scoped to the org and project. The ?item= param deep-links to an item.
Source: src/app/[locale]/(app)/projects/[projectId]/memory/page.tsx, memory-client.tsx, actions.ts, scribe-actions.ts, search-action.ts.
Verify: open a project and go to /projects/[projectId]/memory; click "ProjectOps Scribe".

# ES: Pantalla Memoria del Proyecto

Memoria institucional por proyecto (CAP-006/CAP-008): cada nota, correo, minuta o evidencia capturada vive aquí, clasificada, vectorizada y vinculable a entidades del proyecto. La página de servidor carga hasta 500 project_memory_items con sus traceability_links (source_type "memory"), más entidades vinculables (roadmap_tasks, milestones, risks, stakeholders, decisions, documents, communication_items, meetings) y conteos para las pestañas secundarias. Pestañas: Memoria (línea de tiempo), Resumen (actividad unificada), Comunicaciones, Reuniones, Decisiones, Documentos (con conteos y enlaces "Gestionar" a cada módulo) y Buscar. El botón "ProjectOps Scribe" abre el modal de captura: escribir, pegar o Dictar (Web Speech API del navegador); analyzeScribeAction extrae acciones, decisiones, seguimientos y riesgos estructurados con extractos textuales de origen; el usuario revisa y solo los elementos aprobados se guardan con saveScribeEntryAction en project_memory_items (+ project_scribe_items), creando las entidades aprobadas enlazadas vía traceability_links. Acciones sobre elementos: crear, actualizar, archivar (también desindexar), reclasificar con IA, reindexar, vincular/desvincular — la creación dispara clasificación de IA e indexado pgvector en segundo plano (ai_status / index_status), todo con registro en audit_logs. searchMemoryAction ejecuta búsqueda semántica y por palabras clave acotada a la organización y al proyecto. El parámetro ?item= abre un elemento directo.
Fuente: src/app/[locale]/(app)/projects/[projectId]/memory/page.tsx, memory-client.tsx, actions.ts, scribe-actions.ts, search-action.ts.
Verifica: abre un proyecto, ve a /projects/[projectId]/memory y pulsa "ProjectOps Scribe".
