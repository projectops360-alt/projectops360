# Living Graph — Milestone / Task Creation Sync

**Bug fixed:** a milestone (or task) created in Roadmap/Tasks did not appear in
the Living Graph / Project Execution Map.
**Guard:** `LIVING-GRAPH-NEW-MILESTONE-AUTO-INCLUSION`.

---

## 1. How milestone creation reaches the Living Graph

The classic Living Graph / Project Execution Map is an **SSR projection**. Its
milestone and task nodes are derived **exclusively from `process_nodes`**:

| Entity | `source_entity_type` | `node_type` |
|---|---|---|
| Milestone | `milestones` | `milestone_gate` |
| Task | `roadmap_tasks` | `task_transition` |

The `milestones` / `roadmap_tasks` tables are used only to **enrich** those nodes
(labels, status, progress). A canonical entity without a `process_nodes` row is
therefore **invisible** in the graph.

## 2. Root cause

`createMilestoneAction` and `createTaskAction` persisted the entity (and, for
tasks, emitted a `task_transition` node only later on the FIRST status change via
`updateTaskStatusAction`) but **never emitted the node on creation**. A milestone
created and left untouched — or a task created and not yet moved — had no node
and was hidden, even though it was present in Roadmap/Tasks.

Verified in prod at diagnosis time: the reported milestone had `process_node_count = 0`;
10/12 milestones and 52/73 tasks had nodes (the gap was systemic for the create paths).

## 3. The fix (approved path, no redesign)

Both create actions now emit the projection node via the sanctioned
`emitProcessNode` (`src/lib/graph/emit-event.ts`) — the same mechanism used by
task-status / decisions / meetings / communications:

- **awaited before `revalidatePath`** → the node exists on the next render;
- **idempotent** (`emitProcessNode` maps a unique violation to the existing id);
- milestone → `milestone_gate` / `milestones`; task → `task_transition` /
  `roadmap_tasks`.

No auto-link is performed on milestone creation, so a brand-new milestone appears
as a **planned / unconnected node** (no milestone-flow edge yet) with **0 tasks** —
exactly the expected behavior.

### Backfill

Migration `20260835000000_backfill_milestone_task_process_nodes.sql` creates the
missing `milestone_gate` / `task_transition` nodes for entities that predate the
fix. It is **idempotent** (`NOT EXISTS` guard), skips soft-deleted entities, and
only ever `INSERT`s into `process_nodes` — it never updates/deletes
`process_nodes`, never mutates `milestones`/`roadmap_tasks`, never touches
`project_event_log`. Applied to prod (0 milestones / 0 tasks left orphaned).

## 4. Milestones without flow edges / empty / planned

The Living Graph never hides a milestone for being new, planned, empty, P2, or not
yet connected by a milestone-flow edge: `milestone_gate` nodes resolve to
`default_visible` (`resolveNodeVisibility('milestone')`), and milestone-flow edges
are a **separate** layer from hierarchy. A milestone with 0 tasks renders as a
valid empty milestone node.

## 5. Hierarchy

`Milestone → direct tasks → direct subtasks → child subtasks → evidence/events
(only when enabled/inspected)` is preserved. A new milestone's **direct tasks**
appear under it when the milestone is opened/expanded (each task now has its own
`task_transition` node); unrelated milestones' tasks never leak; evidence/events
stay hidden by default.

## 6. Saved layout

Saved layouts are presentation-only (UX-007 / PD-008) and never gate node
existence: a milestone with no saved position still renders (deterministic layout
places it); user-saved positions for existing nodes are preserved; Reset / full
resync include the new milestone.

## 7. Realtime / cross-browser recovery

The classic Living Graph auto-refresh watches a **canonical content signature**
(`computeGraphSignature` over milestones/tasks/subtasks). Creating a milestone
flips the signature the instant the `milestones` row exists, so another browser
picks it up on the next signature poll (≤ 8s) — `router.refresh()` re-reads
`process_nodes` (which already contains the node, created synchronously in the
action). If realtime/polling is degraded, the sync pill shows the degraded state
(never a fake "live"). No manual refresh is required when healthy.

## 7b. Reordering the milestone flow (manual, no DB editing)

The flow line follows `order_index`. Users reshape it from the milestone actions
menu (**Move up / Move down**, `MilestoneSelector`), wired to
`reorderMilestoneAction` → pure `computeMilestoneReorder` (swaps the target's
`order_index` with its neighbor; boundary/unknown-id safe). No database editing
is required. Guard: `LIVING-GRAPH-MILESTONE-MANUAL-REORDER`.

## 8. Known limitations

- Milestone creation materializes the **projection node** (`process_nodes`) but
  does not emit a canonical `MilestoneCreated` row into `project_event_log`, so
  the instant live-push channel does not fire for milestone creation; cross-browser
  inclusion is via the ≤ 8s signature poll. Adding a `MilestoneCreated` event to
  the ledger (for instant push + LGRE delta) is a future, larger taxonomy step.
- The backfill covers current projects; any future create path that inserts
  milestones/tasks outside `createMilestoneAction` / `createTaskAction` must also
  call `emitProcessNode` (or re-run the idempotent backfill).
