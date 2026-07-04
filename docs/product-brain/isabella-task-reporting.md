# Isabella — Deterministic Task Reporting

**Regression ID:** `ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA`
**Status:** protected · **Phase:** 5 / Task 0 (pre–Process Intelligence blocker fix)

## Why this exists

A user asked Isabella, in imperfect Spanish:

> "isabell anecesito un reporte con todas la tareas por title ordenado por desc"

Isabella replied *"No tengo una respuesta verificada sobre cómo generar un reporte…"*.
That is wrong. **A report of the current project's tasks is a deterministic
project-data request, not an unknown general-knowledge question.** Isabella must
never fall back to "no verified answer" when the app can produce the data through
approved, RBAC-scoped selectors.

## Root cause

Isabella's answer engine (`askKnowledgeOs`) is a RAG pipeline grounded **only** in
the curated Knowledge Package corpus (product how-to knowledge). It had **no intent
branch** for project-DATA reports. A task-report ask retrieves nothing relevant from
the corpus (or the model returns `grounded:false`), so `emptyAnswer()` fires the
honest-but-wrong *"no verified answer"* fallback. The deterministic project-data
path already existed for the Project Health Briefing (REG-013) but was never reached
for a "list all tasks" request.

## Behavior (approved)

`askLivingGuideAction` now **short-circuits BEFORE the RAG corpus** when the message
is a task-report ask:

1. **Intent detection** — `detectTaskReportIntent(query)` (pure) recognizes the ask in
   English and Spanish, tolerant of typos and mixed language. It fires only for a
   clear "report / list / table of tasks" or "all tasks …" request — it does **not**
   hijack *"how do I create a task?"*, *"show me how tasks work"*, or
   *"¿de dónde viene esta tarea?"*. It resolves the requested sort:
   - **field aliases:** `title/título/titulo/name/nombre` → title · `status/estado` →
     status · `priority/prioridad` → priority · `milestone/hito/fase/phase` →
     milestone · `due/vencimiento/entrega/deadline` → due · `updated/actualizado` →
     updated · `created/creado/creación` → created (default **title**).
   - **direction aliases:** `desc/descending/descendente/z-a/inverso/…` → descending ·
     `asc/ascending/ascendente/a-z/…` → ascending (default **ascending**).
2. **Project context** — the report uses the current project (`context.projectId`).
   With no project context Isabella asks the user to open/select a project instead of
   querying across projects.
3. **Approved retrieval** — `buildTaskReport` (server-only) MIRRORS the Project
   Briefing access path (REG-013): an org-scope gate on `projects`, then
   `roadmap_tasks` and `milestones` scoped by `organization_id` + `project_id` +
   `deleted_at is null`. Owner display names are resolved **only** within the caller's
   org (`profiles` filtered by `organization_id`). No raw DB payloads leave the server;
   the client never queries the database.
4. **Deterministic sort — the LLM never sorts.** `sortTaskReportRows` (pure) sorts by
   the requested field + direction, case-insensitive, with **missing values last** and
   a stable tie-breaker (`createdAt` DESC → `id` ASC). Same input → same output; the
   input array is never mutated.
5. **Verified report** — the answer is confidence tier **`verified`** (never the
   low-confidence `ai_suggestion` fallback), grounded, cites *live project-task data*,
   states scope + sort + total count, lists every authorized task in a markdown table
   (`# | Title | Status | Milestone | Priority | Owner | Due`), renders missing optional
   fields honestly as `—`, notes truncation only when the list was actually truncated
   (default display window: 50 rows; DB hard cap: 2000), and ends with a safe inline
   **source statement** — *"Fuente: tareas visibles del proyecto actual."* /
   *"Source: tasks visible in the current project."* (never a raw payload). The
   `sources` disclosure also carries a `verified` "Project tasks (N)" citation.

### Example (the exact reported request, `title` `desc`)

> Claro. Aquí tienes el reporte de tareas de **Tower A**, ordenado por título en
> orden descendente (Z → A). Total: 6 tareas.
>
> | # | Título | Estado | Hito | Prioridad | Responsable | Vence |
> | --- | --- | --- | --- | --- | --- | --- |
> | 1 | Zoning review | En progreso | Design | P1 | — | 2026-08-01 |
> | … | | | | | | |
>
> Fuente: tareas visibles del proyecto actual.

## RBAC / security

- Org + role come from the **trusted session** (`getOrgContext`). The client-supplied
  `projectId` is only a lookup key; the project must belong to the caller's org or the
  report refuses (`no_project`). Cross-org and cross-project tasks never leak.
- Owner names resolve only for same-org profiles — no cross-org identity leak.
- Access scope is **identical to the REG-013 Project Briefing** (any org member who can
  read the project's briefing can read its task report). This is deliberate consistency,
  not a new surface.
- No raw `project_event_log` rows or raw Supabase payloads are exposed. No canonical
  truth is mutated; `project_event_log`, `process_nodes` and `process_edges` are never
  written.

## Failure / empty / unauthorized states (honest, never fabricated)

| State | Isabella responds |
|---|---|
| No tasks in scope | "El proyecto **X** no tiene tareas visibles para ti." (verified, empty) |
| No project context | "Necesito que abras o selecciones un proyecto…" |
| Unauthorized project | "No tienes permiso para ver las tareas de este proyecto." |
| Retrieval failure | "Encontré el proyecto, pero no pude cargar las tareas… abre el Workboard." |

## Known limitations

- **Sorting only** — filtering (e.g. "only blocked", "not started") is not yet wired;
  follow-up chips offer alternate **sorts** that re-trigger the intent.
- Roadmap tasks only (subtasks are covered by the Task Execution Map, not this report).
- The report renders a markdown table; the current answer renderer shows it as
  line-per-row (copy-paste yields a real markdown table).

## Future enhancements

- Task **filtering** intents ("dame las bloqueadas", "solo not started").
- Export / open-in-Workboard deep link.
- Fold into Phase 5 Isabella Process Intelligence with an explicit evidence contract.

## Tests

`src/lib/isabella/__tests__/task-report.test.ts` — intent detection (EN/ES/typos/mixed
+ negatives), deterministic sort (title desc/asc, tie-breaker, nulls-last, no mutation,
replay-stable), verified report (scope/sort/count, honest `—`, verified tier + source,
truncation), and honest empty/no-project/unauthorized/unavailable states. Registered in
[`regression-test-map.md`](regression-test-map.md).
