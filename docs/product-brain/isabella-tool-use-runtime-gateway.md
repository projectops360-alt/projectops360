# Isabella — Tool Use Runtime Gateway

**Regression ID:** `ISABELLA-TOOL-USE-RUNTIME-GATEWAY` · Phase 5 · Task 2B ·
**Status:** protected (feature-flagged, default OFF)

## 1. Purpose

Upgrade Isabella from a single-call RAG-first assistant into a controlled,
read-only, **feature-flagged**, evidence-backed assistant that can call approved
server-side tools for live project data. The gateway is a **controlled gateway
over existing intelligence layers, not a second source of truth**.

## 2. Architecture

`src/lib/isabella/tools/`:

```
flag.ts          ISABELLA_TOOL_USE_ENABLED (server env, default OFF)
schemas.ts       Zod arg schemas (query_tasks / query_project_data / get_project_summary)
serializers.ts   sanitized/truncated ToolResult (safe rows: names + opaque refs, no raw ids)
executors.ts     wrap approved layers (query engine + process context) — no duplicated logic
registry.ts      STATIC allowlist name→def; listToolSpecs() (JSON-schema params for the model)
runtime.ts       executeIsabellaTool: validate name → validate args → execute → safe result + audit
agent-loop.ts    runIsabellaToolLoop: provider-agnostic loop (≤5 iters), injected ToolCallingModel
openai-model.ts  default OpenAI function-calling adapter (swap for Anthropic without touching loop)
audit.ts         compact ai_runs tool metadata (no large/sensitive payloads)
gateway.ts       maybeAnswerWithTools: flag-gated GuideAnswer, RBAC scope, audit, defensive
```

Wired in `askLivingGuideAction`: when the flag is ON and a data question is
detected, the tool loop runs **before** the deterministic report; any miss falls
through to the deterministic report, then RAG. When OFF, the pipeline is unchanged.

## 3. Feature flag behavior

`ISABELLA_TOOL_USE_ENABLED` (server env). **Default OFF** → current behavior
(deterministic query engine + RAG) byte-for-byte unchanged. **ON** → tool loop
active for data questions; RAG still serves help. **Rollback = unset the flag (no
migration).**

## 4. RAG vs live-data routing

Help/documentation questions ("how do I create a project?", "where do I see
risks?") → RAG corpus (`guide_coaching`), no live-data tools. Live project-data
questions ("tasks without milestone", "how many overdue", "tasks assigned to X",
"project summary", "group tasks by milestone") → approved tools, real scoped data,
applied filters + truncation disclosed, honest "no matching records" when empty.

## 5. Approved tool registry (static allowlist)

- **`query_tasks`** — task report with convenience filters (status, priority,
  has_milestone, overdue, without_owner, blocked, owner/assigned, search, due
  dates), sort, limit (default 50, max 200).
- **`query_project_data`** — generic: entity (`task` wired; others →
  `unsupported_entity`), catalog fields/filters/operators, sort, group_by +
  aggregation. limit default 100, max 200.
- **`get_project_summary`** — compact counts via `buildIsabellaProcessContext`.

`query_risks`/`query_budget`/`list_projects` are **intentionally omitted** — their
approved evidence adapters are not built (would only return `unavailable`); adding
them is a future task.

## 6. Tool argument validation

Every tool arg is validated with **Zod** (`.strict()` — unknown keys rejected;
enum-bounded `order_by`/operators/priority; limit ≤ 200). The LLM may only choose a
registered tool + typed args — **never raw SQL, never arbitrary tables/fields**.

## 7. Tool execution loop

`runIsabellaToolLoop` (≤5 iterations): model picks tool(s) → runtime validates +
executes server-side → sanitized result fed back → repeat until final answer. Max
iterations → best partial with the limit disclosed. Unknown tool / invalid args /
execution error → safe tool error (no stack trace, no crash). Provider-agnostic via
an injected `ToolCallingModel` (unit-tested with a mock; no live API needed).

## 8–9. Result serialization + evidence

Rows are mapped to a display-safe whitelist (`ref`=opaque `task:<id>`, title,
status, priority, milestone, owner, dueDate, isSubtask) — **raw ids/payloads
dropped**. Results carry `appliedFilters`, `appliedSort`, `grouping` (counts),
`evidenceRefs` + `citations` from the evidence layer, `truncated`, `limitations`.

## 10. ai_runs audit metadata

Compact only: `{ toolUseEnabled, toolsCalled: [{ name, argsSummary (redacted),
rowCount, truncated, executionMs, status }], maxIterationsReached }` written to
`ai_runs.output_snapshot` (existing table/enum, no migration). **No large/sensitive
payloads**; project_id redacted to `current_project`/`provided`.

## 11. RBAC / RLS / security

Tools resolve RBAC-safe scope via `resolveIsabellaProjectAccess` (session org+user,
project gated by org) and execute through the approved layers (org+project scoped).
No cross-org/cross-project leak; denials don't disclose existence.

### Architecture decision (approved by Efrain) — "no service role" scope
**"No service role in Isabella runtime tools"** means: no service-role usage at the
**tool/LLM boundary** — the LLM never receives service-role access, raw SQL, raw DB
rows, raw `project_event_log` rows, or raw Supabase payloads, and the tool layer
adds **no new direct DB queries**. Tool executors **wrap** the already-approved
ProjectOps360° server layers (Generic Query Engine, Process Context/Evidence
Retrieval, existing `runAi`/audit). Those approved internal layers may continue
using the app's established admin-client pattern **only** because they enforce
explicit session-derived org/project/user scope, RBAC, sanitization, and
regression-protected read-only behavior. We do **not** duplicate data access with
new RLS user-client tools and do **not** create a second source of truth.

## 12. Production safety

Read-only tools; feature-flagged (default OFF); Zod-validated args; LLM never emits
SQL/table names; results truncated + sanitized; compact audit only. **No production
deploy, no Vercel production deploy, no merge to main — feature branch + PR only.**
Turning the flag ON in an environment requires validating the OpenAI tool path in
staging first.

## 13. Rollback instructions

Unset / set `ISABELLA_TOOL_USE_ENABLED` to anything other than `true`. No migration,
no code change. The deterministic query engine + RAG resume as the only paths.

## 14. Existing patches inventory (left in place)

- Deterministic query-engine branch (Task 1B) — **primary** data answer, unchanged
  (the tool loop runs before it only when the flag is ON; otherwise untouched).
- `emptyAnswer()` "no verified answer" RAG fallback — unchanged.
- Provenance (PD-012) + executionFacts enrichment — unchanged.
- Project briefing (REG-013) — unchanged.

No patch removed — the tool path is additive and rollback-safe; equivalence for the
deterministic cases stays proven by their own regression suites.

## 15. Known limitations

- Flag default OFF; the live OpenAI tool path is not validated in staging/prod yet.
- Only `task` entity + `get_project_summary` execute; `query_project_data` for
  other entities returns `unsupported_entity`; `query_risks/budget/list_projects`
  omitted until their evidence adapters exist.
- `query_tasks.milestone_id` filter is not supported yet (use `has_milestone`).
- Follow-up conversation memory across turns is not threaded into the loop yet.

## 16. Future tools / entities

`query_risks`, `query_budget`, `list_projects`, milestone/subtask entities in
`query_project_data`, and cross-turn follow-up memory — each behind the same flag,
wrapping approved adapters.

Dependent guards: `ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT` ·
`ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE` ·
`ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL` ·
`ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA` ·
`ISABELLA-TASK-REPORT-NO-MILESTONE-FILTER`.
