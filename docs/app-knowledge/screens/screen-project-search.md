---
slug: screen-project-search
route: /projects/[projectId]/search
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/search/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/search/search-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/search/search-action.ts
  - src/app/[locale]/(app)/projects/[projectId]/search/embedding-backfill-action.ts
---

# EN: Project Search screen

Cross-entity search inside one project, reached from the project's Search tab. The server page only verifies the project belongs to the user's organization and passes translations; all searching happens in the SearchClient through the searchProjectAction server action. A single query box with type filter chips (All, Communication, Meeting, Decision, Document, Task, Memory) runs two strategies in one action: keyword matching (case-insensitive substring with generated snippets) over communication_items, meetings, decisions, documents, roadmap_tasks and project_memory_items, and semantic search — the query is embedded with OpenAI text-embedding-3-small and matched via the match_documents Supabase RPC (pgvector). Semantic hits are listed first sorted by similarity and tagged with a "semantic match" badge; keyword duplicates are removed, then keyword results follow sorted by date. Semantic search is non-fatal: if no API key or the RPC fails, keyword results still return. Each result links to the entity's detail screen. A second server action, backfillEmbeddingsAction, generates missing embeddings in idempotent batches of 50 for roadmap_tasks, communication_items, meetings, decisions and documents — the only write this screen can trigger (embedding columns). Related screens: Communications, Meetings, Decisions, Documents, Workboard, Project Memory.
Source: search/page.tsx, search/search-client.tsx, search/search-action.ts, search/embedding-backfill-action.ts.
Verify: open a project → Search tab, type a keyword and toggle the type filters.

# ES: Pantalla Búsqueda del proyecto

Búsqueda entre entidades dentro de un proyecto; se llega desde la pestaña Search del proyecto. La página de servidor solo verifica que el proyecto pertenezca a la organización y pasa traducciones; la búsqueda ocurre en el SearchClient mediante la acción de servidor searchProjectAction. Un cuadro de consulta con filtros por tipo (Todos, Comunicación, Reunión, Decisión, Documento, Tarea, Memoria) ejecuta dos estrategias en una sola acción: coincidencia por palabra clave (subcadena sin distinguir mayúsculas, con fragmentos generados) sobre communication_items, meetings, decisions, documents, roadmap_tasks y project_memory_items, y búsqueda semántica: la consulta se convierte en embedding con OpenAI text-embedding-3-small y se compara con la RPC match_documents de Supabase (pgvector). Los resultados semánticos van primero, ordenados por similitud y con la insignia de coincidencia semántica; se eliminan duplicados y luego siguen los resultados por palabra clave ordenados por fecha. La búsqueda semántica no es bloqueante: si falta la clave de API o falla la RPC, se devuelven igual los resultados por palabra clave. Cada resultado enlaza al detalle de su entidad. Una segunda acción, backfillEmbeddingsAction, genera embeddings faltantes en lotes idempotentes de 50; es la única escritura posible desde esta pantalla (columnas de embedding). Relacionadas: Comunicaciones, Reuniones, Decisiones, Documentos, Workboard, Memoria del proyecto.
Fuente: search/page.tsx, search/search-client.tsx, search/search-action.ts, search/embedding-backfill-action.ts.
Verifica: abre un proyecto → pestaña Search, escribe una palabra y prueba los filtros por tipo.
