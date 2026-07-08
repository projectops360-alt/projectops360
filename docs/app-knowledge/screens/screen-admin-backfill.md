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
---

# EN: Admin Backfill Console screen

The secure, admin-only Backfill Administration Console at `/admin/backfill` — described in code as "the single approved surface for executing Historical Backfill" into the Project Event Graph. Access is gated server-side by `canRunBackfill`: only org owners/admins or emails on the `BACKFILL_ADMIN_EMAILS` platform allowlist may enter; everyone else gets a 404 (no data, no nav leak). The server loads up to 500 org projects (id, localized title, type, status) with the admin client. The `BackfillConsole` lets the admin pick a scope — a single project or the entire organization — then enforces a safety sequence: a dry run must be executed for the chosen scope first, a written reason is required, and a confirm dialog precedes execution. Both modes call `runBackfillAction`, which re-checks authorization and invokes `backfillProject` from `lib/events/backfill`; that engine maps existing projects, milestones, tasks, dependencies, decisions, documents, and drawings into events for the event ledger. The operation is idempotent and additive, and per the UI it never modifies canonical data or `process_nodes`/`process_edges`. Results render as progress bars and can be downloaded as a JSON report named after the execution id. Related screens: Living Graph (consumer of the event graph) and the Living Graph Observability panel.

Source: src/app/[locale]/(app)/admin/backfill/{page,backfill-console,actions}, src/lib/events/{backfill,backfill-access}.ts.
Verify: as an org owner/admin, open /admin/backfill, run a dry run on one project, then execute with a reason.

# ES: Pantalla Consola de Backfill (admin)

La Consola de Administración de Backfill, segura y solo para administradores, en `/admin/backfill` — descrita en el código como "la única superficie aprobada para ejecutar el Backfill Histórico" hacia el Project Event Graph. El acceso se controla en el servidor con `canRunBackfill`: solo owners/admins de la organización o correos de la lista blanca de plataforma `BACKFILL_ADMIN_EMAILS`; el resto recibe un 404 (sin datos ni fuga de navegación). El servidor carga hasta 500 proyectos de la organización (id, título localizado, tipo, estado) con el cliente admin. La `BackfillConsole` permite elegir alcance — un proyecto o toda la organización — y aplica una secuencia de seguridad: primero un dry run obligatorio para ese alcance, una razón escrita requerida y un diálogo de confirmación antes de ejecutar. Ambos modos llaman `runBackfillAction`, que revalida la autorización e invoca `backfillProject` de `lib/events/backfill`; ese motor convierte proyectos, hitos, tareas, dependencias, decisiones, documentos y planos existentes en eventos del libro de eventos. La operación es idempotente y aditiva y, según la UI, nunca modifica datos canónicos ni `process_nodes`/`process_edges`. Los resultados se muestran con barras de progreso y pueden descargarse como reporte JSON con el id de ejecución. Pantallas relacionadas: Living Graph y el panel de Observabilidad del Living Graph.

Fuente: src/app/[locale]/(app)/admin/backfill/{page,backfill-console,actions}, src/lib/events/{backfill,backfill-access}.ts.
Verifica: como owner/admin, abre /admin/backfill, ejecuta un dry run sobre un proyecto y luego ejecuta con una razón.
