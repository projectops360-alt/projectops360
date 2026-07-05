# Isabella — Process Intelligence UI, Realtime Context & Final Integration

**Regression ID:** `ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION` ·
Phase 5 · Task 6 · **Status:** protected · **Flags default OFF**

## 1. Purpose

Wire the accepted Isabella Process Intelligence engines (Task 3 Daily Diagnosis,
Task 4 Root Cause, Task 5 Recommendation) into the live Isabella experience —
safely, feature-flagged, bilingual, RBAC-safe, evidence-backed, and
regression-protected — **without** breaking the existing assistant, RAG help,
deterministic task reports, Living Graph, Workboard, Execution Map, or Subtask
Map. Closes Phase 5.

## 2. Architecture

`src/lib/isabella/process-intelligence-runtime/`:

```
router.ts    routeIsabellaQuestion — deterministic route (reuses classifyIsabellaIntent) + mixed + node scope
runtime.ts   runIsabellaProcessIntelligence — builds Task 2 context ONCE, calls Task 3/4/5 pure assemblers
wiring.ts    maybeAnswerWithProcessIntelligence — flag-gated GuideAnswer adapter + compact ai_runs audit
flag.ts      isIsabellaProcessIntelligenceEnabled / …UiEnabled (server env, default OFF)
quick-actions.ts  getIsabellaQuickActions — bilingual chips (UI flag)
types.ts     request/result/audit + route types
```

Tool registry extension (`src/lib/isabella/tools/`): `intelligence-executors.ts`
+ `get_daily_diagnosis` / `get_root_cause_analysis` / `get_recommendation_plan`
registered in `registry.ts` **only when the PI flag is on** (`activeTools()`).

Wired into `src/components/living-guide/actions.ts` (`askLivingGuideAction`)
AFTER the deterministic query-engine short-circuit and BEFORE provenance/RAG.

## 3. Feature flags

- `ISABELLA_PROCESS_INTELLIGENCE_ENABLED` — runtime routing/integration + tool
  registration. Default OFF.
- `ISABELLA_PROCESS_INTELLIGENCE_UI_ENABLED` — visible UI chips only. Default OFF.
- `ISABELLA_TOOL_USE_ENABLED` — the LLM tool loop (Task 2B), unchanged.

Flag OFF ⇒ Isabella's current pipeline is byte-for-byte unchanged. Rollback =
unset the flag(s); **no migration**. Not enabled in production by this task.

## 4. Routing policy

Deterministic (`routeIsabellaQuestion`), built on `classifyIsabellaIntent`:

| Intent | Route | Handler |
|---|---|---|
| help / how-to / where | `product_help` | RAG (fallback → existing pipeline) |
| list / count / filter / report | `factual_project_data` | Generic Query Engine / Tool Gateway (fallback) |
| what's happening / needs attention / status | `daily_diagnosis` | Task 3 |
| why / cause / blocked because | `root_cause` | Task 4 (chains Task 3) |
| what should I do next / recommend | `recommendation` | Task 5 (chains Task 3+4) |
| status **and** recommendation in one ask | `mixed` | Task 3 → 4 → 5, concise |
| ambiguous, no inferable scope | — | `needs_clarification` (never guesses) |

The LLM never decides data truth; the router routes and the engines produce
evidence. `product_help`/`factual_project_data` return `fallback` so the existing
path is preserved.

## 5. UI entry points

Bilingual quick-action chips (`getIsabellaQuickActions`, i18n keys
`isabellaProcessIntelligence.quickActions.*`): Daily diagnosis · What needs
attention? · Analyze root cause · Recommend next actions · Explain this node
(only with a selection). Rendered only behind `…UI_ENABLED`. Each chip is just a
natural-language prompt — it carries no privileged access.

## 6. Tool / engine integration

Three read-only tools wrap the Task 3/4/5 engines through the approved Task 2
context builder (never the DB directly). Args validated by Zod
(`processIntelligenceArgsSchema`: optional `milestone_id`/`task_id`). Results are
compact text + evidenceRefs + citations + limitations. `get_recommendation_plan`
appends "Requires human approval. Not executed automatically." Registered only
when the PI flag is on.

## 7. Realtime context behavior

Isabella uses the **current** project id + selected node id/type from the request
each time; each response calls `buildIsabellaProcessContext` on demand and carries
`snapshotAt`. Changing the project changes the context for the next request. **No**
raw realtime/Supabase payloads are streamed to the LLM; **no** layout coordinates;
**no** synthetic `milestone_chain` as dependency. A dedicated stale-indicator/
refresh UI is a documented future enhancement (no broad new realtime system built
here).

## 8. Node-scoped analysis

`resolveNodeScope`: milestone node → `{milestoneId}`; task/subtask → `{taskId}`;
project/other → project scope. Scope is threaded into the context `focus` and the
Task 4/5 assemblers. Coordinates/visual position are never used.

## 9. Evidence / citation / limitations display

Each engine result exposes `evidenceRefs`, `citations`, `limitations`, and a
`structuredResult`. The GuideAnswer is tier `verified` when answered. Recommendations
state human approval + "not executed automatically". No raw JSON/payloads are shown.

## 10. ai_runs audit

`wiring.ts` persists a COMPACT `output_snapshot.processIntelligence` audit:
`processIntelligenceEnabled`, `route`, `enginesUsed`, `resultStatus`, `confidence`,
`evidenceRefCount`, `citationCount`, `limitationsCount`, `selectedScope
{type,id:safe-ref}`, `executionMs`. No large engine payloads, no raw rows, no
event log, no Supabase payloads. Existing ai_runs behavior is unchanged when flags
are OFF (the block never runs).

## 11. Recommendation safety / no auto-execution

The recommendation route/tool are advisory: every recommendation is
`humanApprovalRequired: true` + `executableNow: false`; the formatter states "not
executed automatically" and never claims it acted or guarantees an outcome. This
task executes nothing and mutates nothing.

## 12. RBAC / security

Access is enforced by the Task 2 builder (deny-by-default, org+project scope). The
client-supplied `currentEntity`/`projectId` are lookup keys only — re-validated
server-side. No raw DB rows to the LLM, no SQL from the LLM, no arbitrary/dynamic
tools (static allowlist only).

## 13. Empty / partial / error states

`answered` (ready/partial/empty) · `needs_clarification` (no inferable scope) ·
`unauthorized` / `missing_context` / `unavailable` (safe message, no leak) ·
`fallback` (RAG/factual → existing pipeline).

## 14. i18n labels

`isabellaProcessIntelligence.quickActions.*` + `.labels.*` (EN+ES, key-parity
enforced by UX-012): Verified project data, Confidence, Evidence, Limitations,
Recommendation, Requires human approval, Not executed automatically, Refresh
analysis, Snapshot, Partial context, Missing context.

## 15. Manual QA script

With flags ON in local/staging only: (1) "How do I create a project?" → RAG. (2)
"Dame todas las tareas sin milestone" → deterministic report. (3) "¿Qué necesita
atención hoy?" → Daily Diagnosis. (4) "¿Por qué este milestone está en riesgo?" →
Root Cause + confidence/evidence. (5) "¿Qué debo hacer ahora?" → Recommendations,
human approval, not executed. (6) select a milestone/task, ask to analyze → scoped
answer. (7) unauthorized/missing → safe. (8) change project, re-run → new context.
(9) EN + ES. (10) verify RAG/help, task reports, Living Graph, Milestone Focus Map,
Workboard, Execution Map, Subtask Map all still work.

## 16. Rollback

Unset `ISABELLA_PROCESS_INTELLIGENCE_ENABLED` (and `…UI_ENABLED`). No migration,
no data change. The runtime block returns `null`/never runs and Isabella reverts to
the deterministic query engine + provenance + RAG pipeline.

## 17. Known limitations

- Context is project-level with scope annotation; full per-node context filtering
  is a future enhancement.
- Realtime stale-indicator/refresh UI not built (documented enhancement).
- Recommendation categories limited to Task 5's evidence-backed set.

## 18. Future enhancements

Per-node context filtering, realtime stale/refresh affordance, recommendation-to-
action workflow (human-approval gated), PMO portfolio intelligence, advanced
audit/observability dashboard (Phase 6).

Dependent guards: `ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT` ·
`ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE` ·
`ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL` · `ISABELLA-TOOL-USE-RUNTIME-GATEWAY`
· `ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE` ·
`ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE` ·
`ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE` ·
`ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA`.
