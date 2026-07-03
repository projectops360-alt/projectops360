# High-Fidelity Realtime Living Graph Visualization (Phase 4, Task 5)

> The **visual consumer** of the Phase 4 realtime foundation. It renders the
> Living Graph as a realtime, NotebookLM-style execution command center by
> consuming ONLY the Task 4 hierarchy-safe delta/sync contract — never raw
> events, never raw DB rows, never raw recalculation internals. The engine owns
> intelligence; the UI consumes it. Guard:
> **LIVING-GRAPH-HIGH-FIDELITY-REALTIME-VISUALIZATION**.

## 1. What it is / isn't

- **Is:** a pure consumer of Task 4 deltas + a React Flow visualization at
  `/projects/[id]/execution-map/realtime` ("Project Execution Map — Realtime").
- **Is not:** a backend engine, a graph-truth calculator, a health classifier,
  or a replacement for the existing Living Graph / Workboard (both untouched).

## 2. Architecture (consume, never recompute)

```
Task 3 recalc result → Task 4 delta store/builder (hierarchy-safe delta)
  → src/lib/living-graph-realtime-ui/ (PURE consumer: adapter/reducer/selector)
    → src/components/living-graph-realtime/ (React Flow visualization)
```

The initial snapshot is loaded server-side (`load-snapshot.ts`) from the
**canonical owners** (milestones / roadmap_tasks / task_subtasks — the same
truth the Workboard shows), expressed as an approved Task 4
`HierarchicalGraphDelta` (all "added"), then handed to the client. The client
never queries `project_event_log`, never subscribes to Supabase directly, never
touches `process_nodes`/`process_edges`.

## 3. Pure consumer library (`src/lib/living-graph-realtime-ui/`)

- `view-model.ts` — the accumulated client graph (nodes/edges keyed by id +
  change markers). Display helpers read verbatim payload (title/status/owner),
  never recompute.
- `snapshot-adapter.ts` — `applyDelta` (replay-safe: base-version-mismatch or
  wrong-scope → rejected so the caller full_resyncs, never an unsafe merge),
  `rebuildFromDeltas`, `decayChangeStates` (pulse decay).
- `expansion-reducer.ts` — scoped expansion (`scopeKey` per project+root scope);
  toggle / expandAllScoped / collapseAllScoped / resetScope. No cross-scope leak.
- `visibility-selector.ts` — the mandatory hierarchy narrowing + Task 4
  visibility policies: milestone → direct tasks (default); subtasks
  `visible_when_parent_expanded`; child subtasks `visible_when_branch_expanded`;
  **evidence/events only in the evidence overlay**; hierarchy edges default,
  dependency/evidence edges gated by their overlay. `scopedExpandableNodeIds`
  scopes Expand-all to the current milestone/task.
- `sync-state.ts` — honest freshness (live/recovering/resync_required/stale/
  unknown) from a `GraphSyncResponse`.
- `layout.ts` — deterministic positions for 3 modes (mind_map / hierarchical /
  left_to_right). Presentation only.

## 4. Project Execution Map vs Subtask Map

- **Project Execution Map — Realtime** (this task): project/milestone-level
  realtime graph. Milestone focus, layout switch, evidence/dependency overlays,
  status filter, scoped Expand-all / Collapse-all / Reset, node inspector, sync
  bar, minimap.
- **Subtask Map** (task-level, prior task): opens root-only from a task card.
  They are distinct experiences and distinctly labeled.

## 5. NotebookLM-style narrowing

Opening the graph shows the milestone roots + their direct tasks (with subtask
count indicators). Subtasks, child subtasks, evidence/events, and other
milestones' tasks are hidden by default. Clicking a task reveals its direct
subtasks; clicking a subtask reveals its child subtasks. **Expand all is scoped**
to the focused milestone/task (`scopedExpandableNodeIds`) and never reveals
other milestones' tasks; **Collapse all** returns to the clean default;
**Reset** returns to the whole-project root view.

## 6. Realtime delta visualization

The current-version added/updated nodes pulse (ring + `animate-pulse`) from
delta `changeState`/`changedAtVersion`; removed nodes drop out. The sync bar
shows live / recovering (missed-update replay) / resync-required / stale, plus
the version and last-synced time — honest, never fabricated. Empty deltas only
advance the version (no visual churn).

## 7. Node & edge model

Node kinds (milestone/task/subtask/evidence/event/dependency/…) render as
distinct cards (text + icon, never color alone). Edge kinds are visually
distinct: **hierarchy** (solid violet), **dependency** (gray dashed, overlay),
**evidence** (green dotted, overlay), **milestone_flow** (amber). Dependency
edges are never drawn as parent-child. Counts (subtask totals) come from the
delta payload — the UI never guesses.

## 8. Team, filters, RBAC, states

- Owner/assignee shown on nodes + inspector (read-only, RBAC-scoped server-side);
  "View project team" reuses the existing Team page (no second system).
- Filters (status; evidence/dependency overlays; milestone focus) are
  presentation-only and never reveal unauthorized or out-of-scope nodes.
- RBAC: the server loader fails closed (`notFound()`) when the project isn't in
  the caller's org; unauthorized data never reaches the client.
- Empty/loading/unauthorized are handled: no project → `notFound`; no
  milestone/tasks → honest empty canvas; a collapsed-children notice discloses
  hidden subtasks.

## 9. Performance

Progressive expansion (nothing dumped by default), deterministic memoized
layout, and change-state decay avoid re-render storms. Heavy throttling/
observability safeguards are the next task (Task 6), intentionally not built here.

## 10. What the UI intentionally does NOT do

No graph-truth recalculation, no health classification, no hierarchy inference
from ambiguous edges, no evidence inference from raw events, no canonical
mutation, no `project_event_log` / `process_nodes` / `process_edges` writes.

## 11. Known limitations

- The live Supabase realtime channel is not yet wired end-to-end (Task 2 channel
  runtime + migration `20260833` pending); today the graph consumes the approved
  initial snapshot delta and is fully ready to apply live deltas (the adapter,
  reducer, selector, and sync-state machinery are complete and tested). Wiring
  the live subscription is a follow-up once the publication migration is applied.
- Node-kind/hierarchy come from the snapshot loader's canonical build; a future
  engine that stamps kinds first-class would remove the loader's mapping step.

## 12. Recommended next task

**Add Living Graph Realtime Performance, Throttling & Observability Safeguards.**
