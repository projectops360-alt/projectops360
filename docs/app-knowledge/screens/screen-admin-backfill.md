---
slug: screen-admin-backfill
route: /admin/backfill
domain: app_screens
tier: learned_pattern
sources:
  - src/app/[locale]/(app)/admin/backfill/page.tsx
  - src/app/[locale]/(app)/admin/backfill/backfill-console.tsx
  - src/app/[locale]/(app)/admin/backfill/actions.ts
  - src/lib/events/backfill-access.ts
  - src/lib/events/backfill.ts
  - src/lib/events/backfill-reports.ts
---

# EN: Admin Backfill Console screen

The Backfill Administration Console at `/admin/backfill`, described in its own header as the single approved surface for executing Historical Backfill into the Project Event Graph. There is no navigation link — you type the URL. Access is gated server-side by `canRunBackfill`: org `owner`/`admin`, or an email in the `BACKFILL_ADMIN_EMAILS` allowlist; everyone else gets `notFound()` before any query runs. The server then reads up to 500 rows from `projects` with the admin client. `BackfillConsole` offers a Scope select (single project or entire organization), a required Reason field (max 500 chars, recorded in the audit event), a "Dry run (preview)" button and an "Execute" button that stays disabled until a dry run has completed for that exact scope and a reason is typed; Execute also raises a `confirm()` dialog. Both call `runBackfillAction`, which re-checks authorization, validates with zod and loops `backfillProject` over the targets. That engine reads `projects`, `milestones`, `roadmap_tasks`, `task_dependencies`, `risks`, `decisions`, `documents` and `drawing_files` and writes derived events, each carrying provenance (source table, record, field, inference method). Results show per-project events created/duplicate/failed, a replay-readiness score, confidence distribution, and a "Download report" JSON button. Related: screen-admin-living-graph-observability, screen-living-graph.
Source: src/app/[locale]/(app)/admin/backfill/{page,backfill-console,actions}, src/lib/events/{backfill,backfill-access,backfill-reports}.ts.
Verify: as an org owner/admin, open /admin/backfill, run a dry run on one project, type a reason, then Execute.

# ES: Pantalla Consola de Backfill (admin)

La Consola de Administración de Backfill en `/admin/backfill`, descrita en su propio encabezado como la única superficie aprobada para ejecutar el Backfill Histórico hacia el Project Event Graph. No hay enlace en la navegación: se escribe la URL. El acceso se controla en el servidor con `canRunBackfill`: `owner`/`admin` de la organización, o un correo de la lista `BACKFILL_ADMIN_EMAILS`; el resto recibe `notFound()` antes de cualquier consulta. Luego el servidor lee hasta 500 filas de `projects` con el cliente admin. `BackfillConsole` ofrece un selector de alcance (un proyecto o toda la organización), un campo Razón obligatorio (máximo 500 caracteres, queda en el evento de auditoría), un botón "Dry run (preview)" y un botón "Execute" que permanece deshabilitado hasta que se haya hecho un dry run de ese mismo alcance y se escriba una razón; Execute además abre un diálogo `confirm()`. Ambos llaman a `runBackfillAction`, que revalida la autorización, valida con zod y recorre `backfillProject`. Ese motor lee `projects`, `milestones`, `roadmap_tasks`, `task_dependencies`, `risks`, `decisions`, `documents` y `drawing_files` y escribe eventos derivados, cada uno con su procedencia (tabla, registro, campo, método de inferencia). Los resultados muestran por proyecto los eventos creados/duplicados/fallidos, un puntaje de preparación para replay, la distribución de confianza y un botón "Download report" en JSON. Relacionadas: screen-admin-living-graph-observability, screen-living-graph.
Fuente: src/app/[locale]/(app)/admin/backfill/{page,backfill-console,actions}, src/lib/events/{backfill,backfill-access,backfill-reports}.ts.
Verifica: como owner/admin, abre /admin/backfill, ejecuta un dry run sobre un proyecto, escribe una razón y pulsa Execute.
