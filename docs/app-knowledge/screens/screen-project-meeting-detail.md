---
slug: screen-project-meeting-detail
route: /projects/[projectId]/meetings/[meetingId]
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/meetings/[meetingId]/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/meetings/[meetingId]/meeting-detail-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/meetings/[meetingId]/ai-extract-actions.ts
  - src/app/[locale]/(app)/projects/[projectId]/meetings/[meetingId]/ai-action-extract-actions.ts
---

# EN: Project Meeting Detail screen

Reached by clicking a meeting card on the Meetings list (/projects/[projectId]/meetings/[meetingId]), this screen shows one record from the `meetings` table: date, duration, location, attendees, agenda, summary, notes, linked stakeholders, and status badge, with Edit and Archive actions. The server page also builds a bidirectional traceability panel: it reads `traceability_links` where the meeting is source or target, resolves titles from `decisions`, `meetings`, `communication_items` and `documents`, and passes entity catalogs so the "Add link" dialog can connect the meeting to decisions, other meetings, communications or documents with a link type (related_to, caused_by, depends_on, supersedes, derived_from, contradicts) and context notes. Two AI features stand out: "Extract decisions" (ai-extract-actions.ts) and "Extract action items" (ai-action-extract-actions.ts) run the meeting's notes/agenda through `runAi`, return suggestions with confidence and source excerpts, and let the user edit, approve or reject each one; approving inserts into `decisions` or `action_items` and creates a `traceability_link` back to the meeting, with audit logging via `logAudit`. Related screens: Meetings list, Decisions, Communications, Documents.
Source: meetings/[meetingId]/page.tsx, meeting-detail-client.tsx, ai-extract-actions.ts, ai-action-extract-actions.ts.
Verify: open a project, go to Meetings and click any meeting.

# ES: Pantalla Detalle de reunión

Se llega al pulsar una tarjeta en la lista de Reuniones (/projects/[projectId]/meetings/[meetingId]). Muestra un registro de la tabla `meetings`: fecha, duración, lugar, asistentes, agenda, resumen, notas, stakeholders vinculados y estado, con acciones de Editar y Archivar. La página de servidor construye además un panel de trazabilidad bidireccional: lee `traceability_links` donde la reunión es origen o destino, resuelve títulos desde `decisions`, `meetings`, `communication_items` y `documents`, y entrega catálogos para que el diálogo "Agregar vínculo" conecte la reunión con decisiones, otras reuniones, comunicaciones o documentos, con tipo de vínculo (relacionado, causado por, depende de, reemplaza, derivado de, contradice) y notas de contexto. Destacan dos funciones de IA: "Extraer decisiones" y "Extraer acciones" procesan las notas y la agenda con `runAi`, devuelven sugerencias con nivel de confianza y extracto fuente, y permiten editarlas, aprobarlas o rechazarlas; al aprobar se insertan en `decisions` o `action_items` y se crea un `traceability_link` hacia la reunión, con registro de auditoría (`logAudit`). Relacionadas: lista de Reuniones, Decisiones, Comunicaciones, Documentos.
Fuente: meetings/[meetingId]/page.tsx, meeting-detail-client.tsx, ai-extract-actions.ts, ai-action-extract-actions.ts.
Verifica: abre un proyecto, entra a Reuniones y pulsa cualquier reunión.
