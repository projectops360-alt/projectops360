# Living Graph — Milestone Focus Map Layout

**Regression ID:** `LIVING-GRAPH-MILESTONE-FOCUS-LAYOUT-READABILITY` · **Status:** protected

## 1. Problem

When a user selects a milestone and clicks **"View flow"**, the drill-in (activities
level + single-milestone focus) used the generic auto-layout, which **scattered** the
milestone's tasks across the canvas: long noisy edges, no grouping, huge empty canvas
to pan, and a confusing *"Saved layout was partially applied because the graph
changed."* notice (the global saved layout was partially applied to the focused set).
This is a focus-mode **layout** defect — not a data-model defect.

## 2. Approved behavior

Drilling into exactly one milestone opens a **Milestone Focus Map**: a deterministic,
compact, status-grouped, dependency-ordered layout that reads like a focused execution
mind map, auto-fitted and centered. The global saved layout is **never** applied to
focus mode. No canonical data, RBAC, the global graph, Execution Map, or Subtask Map
are changed.

## 3. Layout mode

`MilestoneFocusLayoutMode = "flow" | "mind_map"`. The **initial/default is `mind_map`**
(NotebookLM style): tasks fan out to the right of the central root, spread vertically
around the center with a gentle horizontal arc so the curved branches read like a mind
map. `flow` (compact status columns) remains available in the engine. A UI toggle is a
documented future enhancement.

## 4. Root-centered layout rules

The selected milestone is the drill context; its tasks are laid out in compact lanes.
(A rendered milestone *root node* inside the activities view is a future enhancement —
the engine models it; the current wiring reuses the existing task nodes to avoid new
node-type rendering risk.)

## 5. Status grouping rules

Each task → exactly one group (deterministic), in lane order: **blocked** (isBlocked
or status blocked) → **in_progress** (in_progress/implemented/sent_to_ai) →
**not_started** (not_started/prompt_ready/planned/deferred) → **done**
(done/completed/tested) → **unsequenced** (unknown/unmapped status) →
**cycle_conflict** (in a dependency cycle). Uses existing status constants; no new
canonical statuses invented.

## 6. Dependency ordering rules

Within a lane, tasks are ordered by deterministic topological **level** (Kahn) over
the milestone's INTERNAL real dependency edges, then priority, then title, then id.
Predecessors before dependents. Cycles never crash — affected tasks go to
`cycle_conflict` with a warning. Synthetic `milestone_chain` edges are **not** real
dependencies (LIVING-GRAPH-MILESTONE-CHAIN-NOT-DEPENDENCY).

## 7. External dependency chip/group rules

Edges crossing the milestone boundary are summarized compactly
(`summarizeExternalDependencies`) as predecessor/successor entries — external nodes are
**not** scattered as distant nodes (they're excluded from the focused positioned set).
Rendering these as chips is a documented future enhancement.

## 8. Saved layout scoping rules (drag + rearrange)

Focus mode is **drag-to-rearrange with a per-milestone saved layout**, exactly like
the rest of the Living Graph:

- The saved arrangement in focus mode is scoped by a **per-milestone key**
  (`getMilestoneFocusLayoutKey(projectId, milestoneId)`), distinct from the global
  `buildLayoutKey`. Dragging a node persists under that key and reloads on return.
- Because the key is milestone-specific, a **global** saved layout is never applied
  to the focus map, and focus drags never overwrite the global layout.
- The deterministic `mind_map` layout is the initial state; manual drags override it
  and are saved/reset/cleared with the existing Save/Reset/Clear controls.
- `shouldApplySavedFocusLayout` documents the exact-match rule (matching key + node
  set) for reference.

## 9. i18n labels

`livingGraph.milestoneFocus.*` (EN/ES parity): Milestone Focus / Enfoque del
milestone, Focus Map, Flow, Mind Map, External dependencies, No dependency evidence,
Cycle / dependency conflict, Fit to view, Group by status/dependency, and per-group
labels. No hardcoded strings.

## 10. Regression guardrails

`src/lib/graph/__tests__/milestone-focus-layout.test.ts`: filtering (only selected
milestone; others excluded), grouping by status, topological ordering, milestone_chain
excluded, cycles don't crash + cycle_conflict group/warning, external summaries,
bounded/compact/stable coordinates, every input node positioned, and saved-layout
scoping (global never applied; focus requires exact key + node set).

## 11. Manual verification steps

1. Open the Living Graph → select a milestone with several tasks → **View flow**.
2. Verify: tasks grouped by status in compact lanes, dependency order within lanes, no
   huge empty canvas (auto-fits), readable labels, no "partially applied" notice.
3. Node detail panel + actions (Open in Execution Map, Edit, Find path, Ask Isabella,
   Insights) still work. Refresh → layout stable. Global graph unchanged.
4. Edge cases: milestone with no tasks; mixed statuses; external dependencies; a cycle.

## 12. Known limitations

- The milestone node is **centered as the hub** and every task is connected to it
  with a synthetic presentation-only **hub edge** (`buildMilestoneFocusHubEdges`,
  `milestone_focus_hub` — never real dependency evidence), so no task floats
  disconnected. The saved-layout key is `milestone-focus:v2:*` so a pre-mind-map
  saved arrangement never hijacks the new layout (use Reset/Clear to drop old ones).
- External-dependency chips + a Flow↔Mind-Map UI toggle are future (engine ready).
- **Subtasks branch off their parent**: an expanded task's subtasks are positioned
  as a tight sub-fan to the right of the parent (via `subtask_of` edges), so a
  task-with-subtasks stays attached to its milestone instead of scattering. Tasks
  that have subtasks also show a glance-level **violet "network" badge** (count) in
  the node title so they're identifiable even when collapsed.

## 13. Future enhancements

Rendered milestone root card, external-dependency chips, Flow/Mind-Map toggle,
per-milestone focus saved layouts.

Dependent guards: `LIVING-GRAPH-MILESTONE-CHAIN-NOT-DEPENDENCY` · `UX-007` (saved
layouts presentation-only) · `LGS-EXPAND-SCOPE`.
