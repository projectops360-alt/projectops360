# Isabella — Generic Project-Data Query & Report Engine

**Regression IDs:** `ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE` ·
`ISABELLA-TASK-REPORT-NO-MILESTONE-FILTER` · **Status:** protected

## 1. Purpose

Make Isabella flexibly answer deterministic project-data questions — reports,
lists, filters, sorts, grouping, counts, and follow-up refinements — **without
guessing**. "Tasks without milestone" is solved by a **generic filter engine**,
not a hardcoded phrase. Natural language → a safe query plan → an approved
RBAC-scoped adapter → deterministic filter/sort/group → a verified report. The
LLM never decides data and never sorts/filters rows.

## 2. Architecture

`src/lib/isabella/query-engine/` (pure except the adapter):

```
NL request
 → parser.ts            (parseProjectDataQuery → IsabellaProjectQueryPlan)
 → catalog.ts           (validateQueryPlan against the semantic catalog)
 → task-adapter.ts      (runTaskQuery: retrieveTaskRows [RBAC] → filter/sort/group) [server]
 → filter-engine.ts     (applyFilters/applySort/applyGrouping — deterministic)
 → formatter.ts         (buildQueryReportAnswer → verified GuideAnswer)
 refine.ts              (refineQueryPlan: follow-up report refinement)
```

Retrieval reuses `retrieveTaskRows` (one source of truth, same org+project gate
as the REG-013 briefing). This generalizes & supersedes the earlier live
task-report short-circuit (`ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA`), which
remains as unit-tested modules.

## 3. Entity catalog

`task` is fully wired. `subtask` / `milestone` / `risk` / `decision` / `approval`
are declared (recognized by the parser) but **not supported yet** — the adapter
returns `unsupported_entity` and Isabella says so honestly. Each entity declares
aliases (EN/ES), fields, default fields/sort, and per-field
filterable/sortable/groupable flags.

## 4. Field aliases (task)

`title` (titulo/título/nombre/name/tarea) · `status` (estado/state/columna) ·
`milestone` (hito/fase/phase/etapa) · `priority` (prioridad/p1/p2/p3) · `owner`
(responsable/asignado/assignee/dueño) · `dueDate` (vence/due/deadline/fecha de
entrega) · `blocked` (bloqueada/blocker/impedimento) · `subtask` (subtarea/parent)
· `updatedAt` (actualizado/updated) · `createdAt` (creado/created). Enum value
aliases map "sin iniciar"→`not_started`, "hecho"→`done`, "alta"→`p1`, etc.

## 5. Filter operators

`equals` · `not_equals` · `is_null` · `is_not_null` · `contains` · `not_contains`
· `in` · `not_in` · `before` · `after` · `on_or_before` · `on_or_after` ·
`greater_than` · `less_than`. Relative dates (`overdue` → `dueDate before today`)
resolve against a deterministic `asOf`.

## 6. Sort parsing

Reuses the shipped title-sort detector plus generic "order/orden(ado) por/sort by
`<field>` `<asc|desc>`". Aliases: asc/ascendente/a-z; desc/descendente/z-a.
Deterministic with a stable tie-breaker (createdAt DESC → id ASC); default sort is
per-entity (task = title asc).

## 7. Grouping / aggregation

`group(ed) by` / `agrupado por` / `resumen por` / `reporte por` → `groupBy`.
Aggregations: `list` (default), `count` (resumen/cuántas/summary/how many),
`grouped_list`. A null group value renders as an explicit "Sin hito / No milestone"
bucket. No fabricated metrics — only what the system can compute.

## 8. Follow-up report refinement

`refineQueryPlan(prev, followUpText)` preserves the prior report's entity +
columns (and sort/group unless overridden) and applies the follow-up's ops
(parsed without the entity gate). "ahora uno con las tareas que no tengan
milestone" narrows the same report; "ese mismo pero agrupado por estado" keeps the
prior filters and adds grouping. Falls back to standalone parsing when there is no
prior context (never fails for lack of context). Most refinements ("solo las
bloqueadas", "sin hito", "por estado") also parse standalone because a concrete
filter/grouping defaults the entity to `task`.

## 9. Query plan contract

`IsabellaProjectQueryPlan` = intent + entity + selectedFields + filters + sort +
groupBy + aggregation + limit + language + requiresClarification +
clarificationQuestion. **Validated** (`validateQueryPlan`) before execution:
unknown/unsupported entities, unknown or non-filterable/sortable/groupable fields,
and unknown operators are rejected — the LLM can't smuggle a forbidden field/op.

## 10. Retrieval adapter rules

`runTaskQuery` / `answerTaskQuery` (server-only): validate plan → `retrieveTaskRows`
(RBAC org+project scope) → deterministic filter/sort/group → sanitized rows +
verified report. Honest states: `no_project` / `not_authorized` / `unavailable` /
`invalid_plan` / `unsupported_entity`. Read-only — no mutation, no
`project_event_log`, no `process_nodes`/`process_edges`, no raw payloads to the LLM.

## 11. RBAC / security

Org + role from the trusted session; the client projectId is only a lookup key.
Profiles/tasks/milestones org+project scoped → no cross-org/cross-project leak;
denials never disclose entity existence; the plan cannot request forbidden fields.

## 12. Examples

- **tasks without milestone** — "dame las tareas sin hito" → `milestone is_null` →
  "…tareas sin hito… Total: N", Hito column shows "Sin hito".
- **tasks by status** — "dame un resumen por status" → groupBy status, count.
- **by priority** — "show P1 tasks that are not started" → priority=p1 + status=not_started.
- **overdue** — "show overdue tasks without owner" → dueDate before today + owner is_null.
- **grouped by milestone** — "group tasks by milestone" → grouped_list.
- **without owner** — "tareas sin responsable" → owner is_null.

## 13. Known limitations

- `task` is the only executable entity; others are catalog placeholders.
- Live follow-up threading uses the parser's entity-defaulting (covers the common
  refinements standalone); full conversation-memory threading of a prior plan's
  filters into the live action is a future wire-up (`refineQueryPlan` is
  implemented + tested at the engine level).
- Relative dates cover `today`/overdue; week/month ranges are future.
- Aggregations are count/list/grouped_list; averages/percentages are future.

## 14. Future supported entities

subtask, milestone, risk, decision, approval, blocker, dependency, deliverable,
event summary, milestone-flow finding, Living Graph node/edge summary — each adds a
catalog entry + an approved adapter (Phase 5 · Task 2).
