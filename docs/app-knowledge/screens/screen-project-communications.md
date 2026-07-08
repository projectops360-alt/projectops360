---
slug: screen-project-communications
route: /projects/[projectId]/communications
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/communications/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/communications/communications-list-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/communications/actions.ts
  - src/components/communications/index.ts
  - src/components/communications/communication-card.tsx
  - src/components/communications/communication-filters.tsx
  - src/components/communications/create-communication-dialog.tsx
  - src/components/communications/edit-communication-dialog.tsx
  - src/components/communications/source-type-badge.tsx
  - src/components/communications/status-badge.tsx
---

# EN: Project Communications screen

The Communications screen (/projects/[projectId]/communications) is the project's communication log. The server page fans out three parallel queries: the project (organization-scoped), all non-deleted `communication_items` ordered by `item_date` descending, and the project's `stakeholders` for linking. `CommunicationsListClient` shows a header with a "Create" button, a filter bar (source type, status draft/logged, a "requires follow-up" toggle, and date range) and cards for each entry. Source types confirmed in code: email, meeting, phone, teams, slack, in_person, document, manual_note and other; each card shows a source-type badge, status badge and a follow-up indicator when `requires_follow_up` is set. `CreateCommunicationDialog` and `EditCommunicationDialog` feed the server actions in `actions.ts` — createCommunicationAction, updateCommunicationAction and archiveCommunicationAction (soft delete with confirmation). Writes go to `communication_items` with per-locale i18n fields, then fire-and-forget generate a semantic-search embedding (`generateAndStoreEmbedding`) and emit a Living Graph `communication_flow` event via `emitAndAutoLink`. Communications can also be linked from the meeting detail screen through `traceability_links`. Related screens: Meetings, Meeting detail, Stakeholders, Documents.
Source: communications/page.tsx, communications-list-client.tsx, communications/actions.ts.
Verify: open a project and go to Communications (/projects/[projectId]/communications).

# ES: Pantalla Comunicaciones del proyecto

La pantalla de Comunicaciones (/projects/[projectId]/communications) es la bitácora de comunicaciones del proyecto. La página de servidor lanza tres consultas en paralelo: el proyecto (limitado a la organización), los `communication_items` no eliminados ordenados por `item_date` descendente y los `stakeholders` del proyecto para vincular. `CommunicationsListClient` muestra un encabezado con botón "Crear", una barra de filtros (tipo de fuente, estado borrador/registrado, un interruptor de "requiere seguimiento" y rango de fechas) y tarjetas por cada entrada. Tipos de fuente confirmados en el código: correo, reunión, teléfono, Teams, Slack, presencial, documento, nota manual y otro; cada tarjeta muestra insignias de tipo y estado y un indicador cuando `requires_follow_up` está activo. Los diálogos de creación y edición usan las acciones de servidor createCommunicationAction, updateCommunicationAction y archiveCommunicationAction (borrado lógico con confirmación). Las escrituras van a `communication_items` con campos i18n por idioma y, de forma asíncrona, generan un embedding para búsqueda semántica y emiten un evento `communication_flow` del Living Graph. Las comunicaciones también se vinculan desde el detalle de reunión mediante `traceability_links`. Relacionadas: Reuniones, Detalle de reunión, Stakeholders, Documentos.
Fuente: communications/page.tsx, communications-list-client.tsx, communications/actions.ts.
Verifica: abre un proyecto y entra a Comunicaciones (/projects/[projectId]/communications).
