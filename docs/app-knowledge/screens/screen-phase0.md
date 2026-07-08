---
slug: screen-phase0
route: /phase0
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/phase0/page.tsx
  - src/components/phase0/phase0-control-client.tsx
  - src/data/phase0-tasks.ts
  - src/hooks/use-phase0-progress.ts
---

# EN: Phase 0 control screen

An internal builder checklist at `/phase0`, not an end-user project feature. It tracks the "Phase 0" plan for building ProjectOps360° itself: the task list is a static array in `src/data/phase0-tasks.ts` (tasks like "Confirm solo-builder scope", "Create single source of truth folder", "Define Definition of Done"), each with category, goal, priority, hour estimate, sprint, dependencies, acceptance criteria, an AI prompt, and a deliverable. The `Phase0ControlClient` renders a page header, a `ProgressHeader` showing completed/total counts, the last-saved timestamp and a reset button, then tasks grouped by category as `TaskCard`s where the user can change each task's status and write notes. Crucially, all state is local: `usePhase0Progress` persists status overrides and notes in browser localStorage — nothing is read from or written to Supabase, and there are no server actions, so progress is per-browser and per-device. The screen is bilingual through the next-intl `phase0Control` namespace. Because the data ships in the bundle, every user sees the same task definitions; only their own local status/notes differ. Related screens: none functionally — this is a standalone internal tracking surface, distinct from project workboards and the Product Intelligence cockpit.

Source: src/app/[locale]/(app)/phase0/page.tsx, src/components/phase0/phase0-control-client.tsx, src/data/phase0-tasks.ts.
Verify: navigate to /phase0 in the app; change a task status and reload — the change persists via localStorage.

# ES: Pantalla Control de Fase 0

Una lista de control interna del constructor en `/phase0`; no es una funcionalidad de proyectos para usuarios finales. Da seguimiento al plan "Fase 0" de la construcción del propio ProjectOps360°: la lista de tareas es un arreglo estático en `src/data/phase0-tasks.ts` (tareas como "Confirmar alcance de constructor en solitario" o "Definir Definition of Done"), cada una con categoría, objetivo, prioridad, estimación en horas, sprint, dependencias, criterios de aceptación, un prompt de IA y un entregable. El `Phase0ControlClient` muestra un encabezado, un `ProgressHeader` con el conteo de completadas/total, la marca de último guardado y un botón de reinicio, y luego las tareas agrupadas por categoría como `TaskCard`, donde se puede cambiar el estado de cada tarea y escribir notas. Lo importante: todo el estado es local — `usePhase0Progress` persiste estados y notas en localStorage del navegador; no se lee ni escribe nada en Supabase y no hay server actions, así que el progreso es por navegador y dispositivo. Es bilingüe mediante el namespace `phase0Control` de next-intl. Como los datos van en el bundle, todos ven las mismas tareas; solo difieren estados y notas locales. Pantallas relacionadas: ninguna funcionalmente — es una superficie interna independiente.

Fuente: src/app/[locale]/(app)/phase0/page.tsx, src/components/phase0/phase0-control-client.tsx, src/data/phase0-tasks.ts.
Verifica: navega a /phase0, cambia el estado de una tarea y recarga — el cambio persiste vía localStorage.
