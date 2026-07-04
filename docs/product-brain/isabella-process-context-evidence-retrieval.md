# Isabella — Process Context & Evidence Retrieval Layer

**Regression ID:** `ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL` · Phase 5 · Task 2 ·
**Status:** protected

## 1. Purpose

The safe boundary between ProjectOps360° data and Isabella intelligence. It
**produces** sanitized `IsabellaEvidencePacket`s + citations from approved,
RBAC-scoped selectors so future engines reason from **evidence, never raw DB
internals**. Retrieval-only — no reasoning, no UI, no canonical mutation.

## 2. Architecture

`src/lib/isabella/process-context/`:

```
resolveIsabellaProjectAccess (access.ts)         deny-by-default project scope
 → buildIsabellaProcessContext (context-builder) assembles the snapshot
     → getIsabellaTaskEvidence  (task-evidence)      tasks/subtasks + counts + packets
     → getIsabellaMilestoneEvidence (milestone-evidence)
     → buildProcessSignals (process-signals)         record-backed blockers
 executeDeterministicProjectDataRequest (query-executor)  runs a Task 1B plan
 buildIsabellaEvidencePacket / buildIsabellaCitation (evidence-builder)  pure, sanitized
```

Reuses Task 1 (`IsabellaEvidencePacket`, `IsabellaCitation`, claim/confidence,
security rules) and Task 1B (`retrieveTaskRows`, `runTaskQuery`, `validateQueryPlan`)
— no duplicated parser/retrieval.

## 3. Access resolution

`resolveIsabellaProjectAccess({projectId, locale})`: org + user from the trusted
session (`getOrgContext`); the client projectId is only a lookup key. No project →
`missing_context`; unauthenticated or project outside the caller's org →
`unauthorized` (gated by org — **no cross-org read, no existence disclosure**);
read error → `unavailable`; else `authorized` with a trusted `IsabellaProjectScope`.

## 4. Approved sources used now

Project summary, **tasks/subtasks** (title/status/milestone/priority/owner/due/
parent/blocked reason), **milestones/phases** (title/status/progress/order/task
count), **Workboard status** (counts by status), **record-backed blockers** (from
blocked task/subtask flags). Owner names resolved only within the caller's org.

## 5. Future placeholders (disclosed, never invented)

`risks`, `decisions`, `approvals`, `status_reports`, `project_memory`,
`living_graph_summary`, `milestone_flow_summary`, and advanced process findings
(delay/rework/bottleneck) are recognized but **not wired** → returned as
`limitations` with `status: "partial"`. The Project Event Graph is never exposed
as raw rows.

## 6. Context request model

`IsabellaContextRequest { projectId?, organizationId?, userId?, locale?, include?,
focus?, queryPlanFilters? }`. `include` selects sources (default: project, tasks,
milestones, blockers).

## 7. Process context model

`IsabellaProcessContext { scope, project, snapshotAt, included, evidencePackets,
citations, taskContext?, milestoneContext?, processSignals?, limitations, status,
message? }`. `status ∈ ready | partial | empty | unauthorized | missing_context |
unavailable`.

## 8. Evidence packet production

`buildIsabellaEvidencePacket` sanitizes (collapse whitespace, cap length), stamps
org+project scope, sets confidence + allowed/disallowed claims, and rejects an
invalid evidence type. **No raw payloads.** Task/subtask evidence = `verified`,
allows `factual_project_data`/`status_summary`, **disallows `root_cause_claim`**.
Milestone evidence disallows `dependency_claim`/`blocker_claim`/`root_cause_claim`
(the milestone_chain sequence is presentation-only). Blocker evidence = `high`,
allows `blocker_claim`, disallows `root_cause_claim`.

## 9. Citation production

`buildIsabellaCitation` → `sourceLabel`, `entityType`, `entityTitle`, `safeRef`
(opaque `kind:id`, never raw JSON/secrets), `confidence`.

## 10–12. Task / milestone / process-signal behavior

- **Task**: `buildTaskContext` computes byStatus/byPriority, withoutMilestone/
  withoutOwner, overdue (dueDate < asOf & non-terminal), blocked counts; item lists
  capped; deterministic.
- **Milestone**: sorted by order, taskCount from retrieved tasks, no fake
  dependencies.
- **Signals**: active blockers only; advanced findings `advancedFindingsAvailable:
  false`.

## 13. Deterministic project query execution

`executeDeterministicProjectDataRequest(org, scope, plan)`: `validateQueryPlan`
(rejects unknown/forbidden fields/ops) → `runTaskQuery` (RBAC-scoped adapter,
deterministic filter/sort/group — LLM never filters) → verified rows + task
evidence packets. Invalid/unsupported plans rejected before retrieval.

## 14. RBAC / security

Server-side authorization from the trusted session; org+project scope on every
read; no cross-org/cross-project leak; denials never disclose existence;
pre-sanitized packets; no raw `project_event_log` / Supabase payloads; **read-only**
(import-boundary test: no `insert/update/delete/upsert`, no
`project_event_log`/`process_nodes`/`process_edges`).

## 15. Empty / partial / error states

`ready` (data present) · `empty` (authorized, no data) · `partial` (a source failed
or a future include was requested) · `missing_context` · `unauthorized` ·
`unavailable` — each with a user-safe message.

## 16–18. Integration contract for future engines

- **Task 3 — Daily Diagnosis**: consume `IsabellaProcessContext.evidencePackets` +
  `taskContext`/`processSignals`; cite evidence + uncertainty. Do not recompute
  truth.
- **Task 4 — Root Cause**: consume packets + process signals; `root_cause_claim`
  needs ≥2 supporting signals (Task 1 claim policy) — task/milestone/blocker
  packets alone disallow it.
- **Task 5 — Recommendation**: consume diagnosis/root-cause evidence; prioritized,
  evidence-backed.

## 19. Known limitations

- Only project/tasks/subtasks/milestones/workboard/blockers are wired; other
  includes are disclosed placeholders.
- Process signals are blocker-only; MPF delay/rework/bottleneck packets are a
  future wire-up (the MPF engine already exists — this layer will consume its
  summaries).
- This layer is **not** yet called by the live Isabella action (the live path uses
  the Task 1B query engine directly); wiring diagnosis/root-cause into chat is
  Tasks 3–6.

Dependent guards: `ISABELLA-PROCESS-INTELLIGENCE-EVIDENCE-CONTRACT` ·
`ISABELLA-TASK-REPORT-VERIFIED-PROJECT-DATA` ·
`ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE`.
