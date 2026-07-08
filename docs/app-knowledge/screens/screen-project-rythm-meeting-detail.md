---
slug: screen-project-rythm-meeting-detail
route: /projects/[projectId]/rythm/[meetingId]
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/rythm/[meetingId]/page.tsx
  - docs/product-brain/04-module-map.md
---

# EN: Rythm meeting detail screen (redirect alias)

This route (/projects/[projectId]/rythm/[meetingId], "rythm" without the "h") was the detail view of a single meeting in the retired Rythm Meeting Intelligence module — the audio/transcription-oriented meeting surface, distinct from the Rhythm Center calendar module at /rhythm. According to the REG-011 consolidation documented in the file itself and in the product brain's regression log, this detail surface queried the `project_rythm_meetings` table, which never reached production, so the page crashed with a server error. The current `rythm/[meetingId]/page.tsx` therefore renders nothing: it is a pure backward-compatibility alias whose only code is a `redirect()` to the canonical Rhythm Center at /projects/[projectId]/rhythm (the meetingId segment is accepted but not used to deep-link into a specific event). Old bookmarks and deep links to individual Rythm meetings land safely on the Rhythm Center list, where the user can locate the meeting and open its drawer. There is no data read or write on this route beyond resolving locale and projectId for the redirect. Related screens: Rhythm Center (/rhythm), Rythm alias index (/rythm), Meetings and meeting detail under /meetings.
Source: rythm/[meetingId]/page.tsx, docs/product-brain/04-module-map.md.
Verify: opening /projects/[projectId]/rythm/<any-id> redirects to /projects/[projectId]/rhythm.

# ES: Pantalla Detalle de reunión Rythm (alias de redirección)

Esta ruta (/projects/[projectId]/rythm/[meetingId], "rythm" sin "h") era la vista de detalle de una reunión del módulo retirado Rythm Meeting Intelligence — la superficie de reuniones orientada a audio y transcripción, distinta del módulo de calendario Centro de Ritmo en /rhythm. Según la consolidación REG-011 documentada en el propio archivo y en el registro de regresiones del product brain, esta vista consultaba la tabla `project_rythm_meetings`, que nunca llegó a producción, por lo que la página fallaba con un error de servidor. El `rythm/[meetingId]/page.tsx` actual no muestra nada: es un alias de retrocompatibilidad cuyo único código es un `redirect()` al Centro de Ritmo canónico en /projects/[projectId]/rhythm (el segmento meetingId se acepta pero no se usa para abrir un evento específico). Los marcadores y enlaces antiguos a reuniones Rythm aterrizan sin errores en la lista del Centro de Ritmo, donde el usuario puede ubicar la reunión y abrir su panel. Esta ruta no lee ni escribe datos más allá de resolver locale y projectId para redirigir. Relacionadas: Centro de Ritmo (/rhythm), alias índice de Rythm (/rythm), Reuniones y detalle bajo /meetings.
Fuente: rythm/[meetingId]/page.tsx, docs/product-brain/04-module-map.md.
Verifica: abrir /projects/[projectId]/rythm/<cualquier-id> redirige a /projects/[projectId]/rhythm.
