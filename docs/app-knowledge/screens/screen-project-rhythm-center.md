---
slug: screen-project-rhythm-center
route: /projects/[projectId]/rhythm
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/rhythm/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/rhythm/rhythm-client.tsx
  - src/app/[locale]/(app)/projects/[projectId]/rhythm/meeting-drawer.tsx
  - src/app/[locale]/(app)/projects/[projectId]/rhythm/actions.ts
  - src/lib/rhythm/templates.ts
  - src/lib/rhythm/service.ts
---

# EN: Project Rhythm Center screen

The Rhythm Center (/projects/[projectId]/rhythm) is the canonical calendar-plus-meetings module — not to be confused with /rythm (no "h"), the retired Rythm Meeting Intelligence route that now merely redirects here (REG-011). The server page loads `project_events`, `meetings` linked by event_id, `meeting_attendees`, meeting-linked `decisions` and `action_items`, `project_memory_items` (source_system "rhythm_center", used to badge memory-synced meetings) and `stakeholders`. `RhythmClient` offers List and Calendar views, filters (event type, status, date range), an "Upcoming events" panel and a "New meeting" dialog that creates a meeting from templates (kickoff, status_update, stakeholder_review, project_review, closing, other), auto-generating agenda, objective and expected outcome. Clicking an event opens the `MeetingDrawer`: AI Summary, agenda sections with per-section notes, general notes, decisions, action items and attendees, plus "Generate summary" (runAi) and "Complete & save to memory", which calls `completeMeeting` in `lib/rhythm/service` to write `project_memory_items`. Server actions cover event CRUD, `createMeetingFromTemplateAction` (inserts event + meeting + attendees), attendee CRUD, adding decisions/action items, and audit logging. Related screens: Meetings, Workboard, Decisions, Project Memory, Closeout.
Source: rhythm/page.tsx, rhythm-client.tsx, meeting-drawer.tsx, rhythm/actions.ts, lib/rhythm/service.ts.
Verify: open a project and go to Rhythm Center (/projects/[projectId]/rhythm).

# ES: Pantalla Centro de Ritmo del proyecto

El Centro de Ritmo (/projects/[projectId]/rhythm) es el módulo canónico de calendario y reuniones — no confundir con /rythm (sin "h"), la ruta retirada de Rythm Meeting Intelligence que hoy solo redirige aquí (REG-011). La página de servidor carga `project_events`, `meetings` enlazadas por event_id, `meeting_attendees`, `decisions` y `action_items` ligados a reuniones, `project_memory_items` (source_system "rhythm_center", para marcar reuniones sincronizadas con memoria) y `stakeholders`. `RhythmClient` ofrece vistas Lista y Calendario, filtros (tipo de evento, estado, rango de fechas), un panel de "Próximos eventos" y un diálogo "Nueva reunión" que crea reuniones desde plantillas (arranque, actualización de estado, revisión con stakeholders, revisión de proyecto, cierre, otra), generando automáticamente agenda, objetivo y resultado esperado. Al pulsar un evento se abre el `MeetingDrawer`: Resumen IA, secciones de agenda con notas por sección, notas generales, decisiones, acciones y asistentes, más "Generar resumen" (runAi) y "Completar y guardar en memoria", que llama a `completeMeeting` en `lib/rhythm/service` para escribir en `project_memory_items`. Las acciones de servidor cubren CRUD de eventos, `createMeetingFromTemplateAction` (inserta evento + reunión + asistentes), CRUD de asistentes, alta de decisiones/acciones y auditoría. Relacionadas: Reuniones, Workboard, Decisiones, Memoria del Proyecto, Closeout.
Fuente: rhythm/page.tsx, rhythm-client.tsx, meeting-drawer.tsx, rhythm/actions.ts, lib/rhythm/service.ts.
Verifica: abre un proyecto y entra al Centro de Ritmo (/projects/[projectId]/rhythm).
