---
slug: screen-project-rythm-intelligence
route: /projects/[projectId]/rythm
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/projects/[projectId]/rythm/page.tsx
  - src/app/[locale]/(app)/projects/[projectId]/rythm/actions.ts
  - src/lib/rythm/index.ts
  - src/lib/rythm/meeting-service.ts
  - src/lib/rythm/recording-service.ts
  - src/lib/rythm/storage-service.ts
  - src/lib/rythm/types.ts
  - docs/product-brain/04-module-map.md
---

# EN: Rythm Meeting Intelligence screen (redirect alias)

Important naming note: /rythm (no "h") is NOT the Rhythm Center. It was the standalone "Rythm Meeting Intelligence" module — audio-focused meetings (in-person recording, video call, uploaded audio) with a transcription pipeline (draft, recording, audio_uploaded, ready_for_transcription, transcribing, transcribed, summary_ready, failed), backed by `lib/rythm/meeting-service` and tables like `project_rythm_audio_files`, transcripts and processing jobs. Per REG-011 in the regression log, the standalone dashboard queried a `project_rythm_meetings` table that never reached production and crashed, so today `rythm/page.tsx` contains no UI at all: it is a backward-compatible alias that immediately calls `redirect()` to the canonical Rhythm Center at /projects/[projectId]/rhythm, preserving old bookmarks and deep links. The dormant `rythm/actions.ts` (createMeetingAction, registerAudioAction, status updates, processing jobs) and `lib/rythm` remain in the repo but are not reachable from this route. Anyone asking about "Rythm" screens should be pointed to the Rhythm Center, where the meeting capability now lives. Related screens: Rhythm Center (/rhythm), Meetings.
Source: rythm/page.tsx, rythm/actions.ts, docs/product-brain/04-module-map.md.
Verify: navigating to /projects/[projectId]/rythm redirects to /projects/[projectId]/rhythm.

# ES: Pantalla Rythm Meeting Intelligence (alias de redirección)

Nota importante de nombres: /rythm (sin "h") NO es el Centro de Ritmo. Era el módulo independiente "Rythm Meeting Intelligence" — reuniones centradas en audio (grabación presencial, videollamada, audio subido) con un pipeline de transcripción (draft, recording, audio_uploaded, ready_for_transcription, transcribing, transcribed, summary_ready, failed), apoyado en `lib/rythm/meeting-service` y tablas como `project_rythm_audio_files`, transcripciones y trabajos de procesamiento. Según REG-011 del registro de regresiones, el tablero independiente consultaba una tabla `project_rythm_meetings` que nunca llegó a producción y fallaba; por eso hoy `rythm/page.tsx` no contiene interfaz alguna: es un alias retrocompatible que llama de inmediato a `redirect()` hacia el Centro de Ritmo canónico en /projects/[projectId]/rhythm, preservando marcadores y enlaces antiguos. El archivo `rythm/actions.ts` (crear reunión, registrar audio, estados, trabajos de procesamiento) y `lib/rythm` siguen en el repositorio pero inactivos desde esta ruta. Ante preguntas sobre "Rythm", dirige al usuario al Centro de Ritmo, donde vive hoy la capacidad de reuniones. Relacionadas: Centro de Ritmo (/rhythm), Reuniones.
Fuente: rythm/page.tsx, rythm/actions.ts, docs/product-brain/04-module-map.md.
Verifica: al navegar a /projects/[projectId]/rythm se redirige a /projects/[projectId]/rhythm.
