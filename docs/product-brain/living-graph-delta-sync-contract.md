# Living Graph Delta Store & Sync Contract (Phase 4, Task 4)

> Companion to the [LGRE Constitution](living-graph-realtime-engine-constitution.md)
> (§18c). The delta/sync layer delivers graph changes safely to a **future** UI —
> it is NOT UI, NOT visualization, and NOT canonical truth. It preserves
> hierarchy semantics so the Living Graph narrows correctly:
> **Milestone → Tasks → Subtasks → Child Subtasks → Evidence only when requested.**
> Guard: **LGRE-DELTA-SYNC-HIERARCHY-SAFE**.

## 1. Purpose

Convert Task 3 `LivingGraphRecalculationResult`s into **hierarchy-safe,
replay-safe, typed** deltas that a future UI applies without guessing node/edge
meaning, and without ever receiving raw events, raw recalc internals, or raw DB
rows. The store is a **delivery mechanism**, not a source of truth.

## 2. What it consumes

- **Task 1** contracts (scope, access context, snapshot/sync semantics).
- **Task 2** notices — only indirectly, through Task 3 outputs.
- **Task 3** `LivingGraphRecalculationResult` (added/updated/removed node & edge
  changes with verbatim engine payloads + evidence refs).

## 3. Hierarchy-safe node model

Every node delta carries an explicit `nodeKind` — `project` · `milestone` ·
`phase` · `task` · `subtask` · `evidence` · `event` · `risk` · `decision` ·
`approval` · `dependency` — classified from explicit payload hints first, then
the sanctioned id conventions (`milestone:{id}`, `task:{id}`, `subtask:{id}`,
`cluster:roadmap_tasks:{id}`, `subtask-node:{id}`, `event:{id}`, `evidence:{id}`).
It also carries `parentId`/`parentKind`, `milestoneId`, `taskId`, `hierarchyPath`,
`directChildCount`, `hasDescendants`, `evidenceAvailable`, `version`, `updatedAt`,
and a `visibility` policy.

## 4. Hierarchy-safe edge model

Every edge delta carries an explicit `edgeKind`:
- **hierarchy** — milestone→task, task→subtask, subtask→child subtask (from
  `subtask_of` / `subtask-edge:` / parent→child kind pairing). **Distinct from
  dependency.**
- **dependency** — `caused`/`blocked`/`delayed`/… task/subtask relationships.
- **evidence** — task/subtask/milestone → event/evidence.
- **milestone_flow** — milestone transition corridor (MPF display link).

The UI never has to infer meaning from an edge label alone.

## 5. Visibility policy (evidence separation)

- `default_visible` — milestone root + direct tasks (milestone scope).
- `visible_when_parent_expanded` — subtasks (parent task expanded).
- `visible_when_branch_expanded` — child subtasks (parent subtask expanded).
- `visible_in_evidence_overlay` — **events/evidence, ONLY with the overlay on**.
- `visible_in_inspector_only` — risks/decisions/approvals/dependencies.
- `hidden_unauthorized` / `hidden_deleted_or_archived` / `hidden_out_of_scope`.

**Events/evidence are never `default_visible`** — the store guarantees they are
not emitted as default hierarchy children.

## 6. Root scope metadata

Each delta's `scope` answers "is this relevant to what I'm looking at?" without
inspecting payloads: `rootScopeType` (project/milestone/task/subtask/
evidence_overlay) + `rootScopeId`, `affectedMilestoneIds`, `affectedTaskIds`,
`affectedSubtaskIds`, `affectedLayerKinds`, `evidenceLayerIncluded`,
`hierarchyDepth`.

## 7. Versioning & replay

Monotonic `producedVersion` per scope; every delta declares
`basedOnVersion → producedVersion`. A delta is applied only against its exact
`basedOnVersion`; anything else resolves to **full_resync** — never an unsafe
partial merge. An **empty delta** (nothing changed) is valid and observable
(`isEmpty: true`). Deltas are deduped by delta id.

## 8. Sync contract

`requestSync({ access, scope, sinceVersion })` →
- **noop** — the consumer is already at the current version (fresh);
- **deltas** — ordered, contiguous missed deltas the consumer can safely apply;
- **full_resync** — the consumer is ahead of the store, brand-new
  (`sinceVersion: null`), past the evicted retention window, or the chain is
  non-contiguous; a `GraphSnapshotDescriptor` is returned to rebuild from;
- **unauthorized** — RBAC deny-by-default; a cross-project/cross-org scope is
  treated as unauthorized. No deltas, no snapshot, no leak.

`getSnapshotDescriptor()` exposes `snapshotVersion` + `oldestRecoverableVersion`
(the oldest client version still replayable from the retained window).

## 9. Missed update / reconnect recovery

On reconnect the client sends its last version. If it is within the retained
window and the chain is contiguous, the store returns ordered missed deltas;
otherwise it requires a full_resync. A stale client is never reported as fresh,
and partial deltas are never merged under unsafe version assumptions.

## 10. RBAC / security

Deny-by-default with absolute tenant isolation (`resolveLivingGraphRealtimeAccess`
+ scope equality). Unauthorized requests never leak node ids, counts, metadata,
or edge references. Server-side checks only; client-side filtering is never the
gate.

## 11. Observability

`observability()` counts the lifecycle: deltas created, nodes/edges
added/changed/removed, empty deltas, duplicates ignored, missed-update
recoveries, full-resync decisions, stale/fresh clients, unauthorized requests,
version mismatches, and evidence/hierarchy/dependency layer deltas — without
exposing unauthorized data.

## 12. How future UI expand/collapse uses this

The delta carries direct-child relationships (`directChildCount`,
`hasDescendants`), hierarchy refs (`parentId`/`hierarchyPath`), edge kind, and
visibility policy — so the UI can: default-show milestone + tasks; reveal
subtasks on parent expansion; reveal child subtasks on branch expansion; keep
Expand-all scoped to the current milestone/task; and keep events/evidence hidden
unless the evidence overlay is enabled. Expansion remains **presentation state**
(the store never stores expand/collapse as canonical data).

## 13. Intentionally NOT done (Task 4)

No UI, no visualization, no frontend graph calculation. No canonical mutation,
no `project_event_log` write, no `process_nodes`/`process_edges` modification.
No durable delta log (in-memory store; a Supabase-backed log is the documented
upgrade path). The engine's `buildDelta(descriptor, descriptor)` stays
`UNSUPPORTED` — deltas are built from recalc results, not descriptor diffs.

## 14. Recommended next task

**Build High-Fidelity Realtime Living Graph Visualization System** — the first
UI consumer of this contract.
