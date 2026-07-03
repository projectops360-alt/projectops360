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

## 2. Fix — the LGRE polling delivery fallback

The realtime consumer now uses the sanctioned **polling** delivery mode (Task 1
ladder: realtime → polling → manual_refresh) until the live Supabase channel is
wired:

- The client polls a **cheap content signature** (`getRealtimeGraphSignatureAction`
  → `computeGraphSignature` over milestone/task/subtask status+progress tokens)
  every 10s. Moving a task to Done flips its status token → the signature
  changes.
- On a signature change it refetches the **approved snapshot delta**
  (`getRealtimeGraphSnapshotAction` → the Task 4 hierarchy-safe delta built from
  the CANONICAL owners, never `process_nodes`/raw events), rebuilds the view
  model (full-resync), and `markChangesAgainstPrevious` pulses ONLY the changed
  node.
- The sync bar shows honest freshness: a landed poll → **live**; a failed poll →
  **stale** (`markStaleIfExpired`, never silently outdated). Unauthorized →
  never claims live.

Migration `20260833000000_project_event_log_realtime` (idempotent) was applied
to prod so `project_event_log` is in the realtime publication — enabling the
future live `postgres_changes` channel.

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

- The live `postgres_changes` subscription (Task 2 channel runtime) is not yet
  wired into the UI; today delivery is **polling** (10s). The publication
  migration is applied, so wiring the live channel is a follow-up that swaps the
  poll for a push without changing the consumer (same delta shape / sync state).
- The classic SSR Living Graph (`/execution-map/living-graph`) still updates on
  navigation/`router.refresh`; the **auto-updating** experience is the realtime
  view (`/execution-map/realtime`). Polling the SSR page is a possible future
  parity step.

## 8. Recommended next task

Wire the live `postgres_changes` subscription (replace polling with push), then
**Task 6 — Living Graph Realtime Performance, Throttling & Observability
Safeguards**.
