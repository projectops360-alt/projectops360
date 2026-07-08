---
slug: screen-project-meetings
route: /projects/[projectId]/meetings
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/meetings/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/meetings/meeting-list-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/meetings/actions.ts
  - src/components/meetings/index.ts
  - src/components/meetings/create-meeting-dialog.tsx
  - src/components/meetings/edit-meeting-dialog.tsx
  - src/components/meetings/meeting-card.tsx
  - src/components/meetings/meeting-filters.tsx
  - src/components/meetings/meeting-status-badge.tsx
---

# EN: Project Meetings screen

The Meetings screen is the classic meeting log of a project, reached from the project workspace at /projects/[projectId]/meetings. The server page verifies the project belongs to the user's organization, then loads all non-deleted rows from the `meetings` table (newest `meeting_date` first) plus the project's `stakeholders` for a multi-select. The `MeetingListClient` renders a header with a "Create" button, a filter bar (status: scheduled / in_progress / completed / cancelled, plus date-from and date-to), and meeting cards that link to the meeting detail screen. `CreateMeetingDialog` and `EditMeetingDialog` capture title, agenda, notes, summary, date, duration, location, attendees (free text), status and linked stakeholders. Server actions in `actions.ts` (createMeetingAction, updateMeetingAction, archiveMeetingAction) validate with Zod, write to `meetings` using per-locale i18n JSON fields and `linked_stakeholder_ids`, then fire-and-forget generate a semantic-search embedding and emit a Living Graph `communication_flow` event via `emitAndAutoLink`. Archiving is a soft delete with confirmation. Note the Product Brain designates Rhythm Center (/rhythm) as the canonical meeting module; this screen is the simpler standalone log. Related screens: meeting detail, Rhythm Center, Communications.
Source: meetings/page.tsx, meeting-list-client.tsx, meetings/actions.ts.
Verify: open a project and go to Meetings (/projects/[projectId]/meetings).

# ES: Pantalla Reuniones del proyecto

La pantalla de Reuniones es la bitácora clásica de reuniones de un proyecto, accesible desde el espacio del proyecto en /projects/[projectId]/meetings. La página de servidor verifica que el proyecto pertenezca a la organización del usuario y carga las filas no eliminadas de la tabla `meetings` (ordenadas por `meeting_date` descendente) junto con los `stakeholders` del proyecto para un selector múltiple. El componente `MeetingListClient` muestra un encabezado con botón "Crear", una barra de filtros (estado: programada / en curso / completada / cancelada, más fecha desde y hasta) y tarjetas de reunión que enlazan al detalle. Los diálogos de creación y edición capturan título, agenda, notas, resumen, fecha, duración, lugar, asistentes (texto libre), estado y stakeholders vinculados. Las acciones de servidor (createMeetingAction, updateMeetingAction, archiveMeetingAction) validan con Zod, escriben en `meetings` con campos i18n por idioma y `linked_stakeholder_ids`, y de forma asíncrona generan un embedding para búsqueda semántica y emiten un evento `communication_flow` del Living Graph. Archivar es un borrado lógico con confirmación. El Product Brain designa al Rhythm Center (/rhythm) como módulo canónico de reuniones; esta pantalla es la bitácora simple. Relacionadas: detalle de reunión, Rhythm Center, Comunicaciones.
Fuente: meetings/page.tsx, meeting-list-client.tsx, meetings/actions.ts.
Verifica: abre un proyecto y entra a Reuniones (/projects/[projectId]/meetings).
