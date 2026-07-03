# Realtime Task Status Sync — Workboard → Living Graph (end-to-end)

> How a task status change (e.g. In Progress → Done) flows through the approved
> architecture and reaches the Living Graph / Project Execution Map **without a
> manual browser refresh**, honestly disclosing stale state when delivery is
> degraded. Guard: **REALTIME-TASK-STATUS-WORKBOARD-LIVING-GRAPH-SYNC**.

## 1. Root cause (diagnosed, not guessed)

The persistence + canonical event path was **already intact**:

1. Workboard drag → `updateTaskStatusAction` persists `status` (status-only
   payload — other fields preserved) and optimistically moves the card
   (`setTasks`) + `router.refresh()`, so the **same browser's Workboard updates
   immediately**.
2. The action emits the approved event via `emitAndAutoLink` (task_transition)
   → `dualWriteProcessNodeEvent` → **`TaskStatusChanged`** appended to
   `project_event_log` through the Event Ingestion Service (never a direct UI
   mutation, never an ad-hoc event).

The **break was the realtime CONSUMER**: the Living Graph is SSR and the new
realtime view (Task 5) loaded a one-time snapshot and **never re-read** it. No
live subscription was wired and `project_event_log` was not in the
`supabase_realtime` publication in prod. So a status change persisted and
emitted its event, but no consumer picked it up → the graph stayed stale, and
other browsers never learned of the change.

## 2. Fix — live push (primary) + polling fallback (LGRE ladder)

The realtime consumer now delivers updates two ways, per the LGRE delivery
ladder (realtime → polling → manual_refresh):

**Live push (primary).** `useLiveGraphSync` wires the **Task 2 subscription
layer** into the browser: the Supabase transport
(`createSupabaseLivingGraphTransport`) subscribes to `postgres_changes` **INSERT
on `project_event_log`**, project-filtered, under RLS; the subscription manager
maps each row to a **typed `LivingGraphChangeNotice`**. The UI consumes TYPED
NOTICES (never raw payloads). On a notice for this project it fires a coalesced
(~350ms) refetch of the **approved snapshot delta** and full-resyncs — so a task
move appears **instantly**, and other browsers get the same INSERT and converge.
`markChangesAgainstPrevious` pulses ONLY the changed node. When the channel is
live the sync bar shows **live (realtime)**.

**Polling fallback.** A cheap content signature (`computeGraphSignature` over
milestone/task/subtask status+progress tokens) is polled — every ~30s while the
live channel is connected (safety net), every ~10s when it isn't (primary). On a
signature change it refetches the approved snapshot delta and rebuilds. A failed
poll flips freshness to **stale** (`markStaleIfExpired`) — never silently
outdated; unauthorized never claims live.

The snapshot delta is the Task 4 hierarchy-safe delta built from the CANONICAL
owners (`load-snapshot`), never `process_nodes`/raw events. Migration
`20260833000000_project_event_log_realtime` (idempotent) is applied to prod so
`project_event_log` is in the realtime publication — enabling the live channel.

## 3. Cross-browser behavior

Both browsers poll the same server-side signature/snapshot. Browser A moves a
task → its persistence flips the signature → within one poll interval Browser B
refetches the snapshot and shows the new status. No manual refresh; B never
touches the DB directly, it consumes the approved delta shape.

## 4. What is / isn't the UI's job

- The UI **consumes** the approved snapshot delta and displays it; it does NOT
  recalculate graph truth, classify health, query `project_event_log`, or
  subscribe to raw Supabase payloads.
- Graph truth stays canonical: task persistence + `TaskStatusChanged` event are
  the source; the delta/signature are derived, read-only projections.

## 5. RBAC / security

Both polling actions resolve through the loader's org+project ownership check
(fail closed → no data when the project isn't the caller's). Cross-project /
cross-org signatures/snapshots are never returned. Server-side authorization;
client filtering is never the gate.

## 6. Stale / degraded / reconnect

- Realtime unavailable / poll failing past the freshness budget → the sync bar
  flips to **stale** (amber), never "live".
- A recovered poll re-applies the current snapshot (full-resync) — missed
  changes are picked up on the next successful poll.

## 7. Known limitations

- Delivery is **live push** (Task 2 Supabase channel) with a **polling safety
  net**. Live push requires the browser Realtime connection + the publication
  (applied) + RLS read on `project_event_log` (in place). If the socket can't
  connect, the polling fallback keeps the graph fresh and the sync bar stays
  honest.
- The live notice triggers a **snapshot refetch** (coalesced), not a per-notice
  incremental delta — correct and simple, at the cost of a small refetch per
  change burst. A future optimization can feed the notice through the
  recalculation service for a truly incremental delta.
- The classic SSR Living Graph (`/execution-map/living-graph`) still updates on
  navigation/`router.refresh`; the **auto-updating** experience is the realtime
  view (`/execution-map/realtime`).

## 8. Recommended next task

**Task 6 — Living Graph Realtime Performance, Throttling & Observability
Safeguards** (coalescing budgets, backpressure, and per-notice incremental
deltas over full refetches).
