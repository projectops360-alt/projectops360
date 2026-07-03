# Project Execution Map vs Subtask Map — UX naming & behavior

> Companion to [living-graph-subtask-visibility.md](living-graph-subtask-visibility.md).
> This note pins the naming and the difference between the two map surfaces so
> they are never confused or ambiguously both called "Execution Map".

## Naming (canonical)

- **Project Execution Map** — the project-level Living Graph
  (`/projects/[id]/execution-map/living-graph`). The broad execution graph:
  milestones, tasks, dependencies, risks, decisions, approvals, execution
  status, health overlays, and subtask hierarchy visibility.
- **Subtask Map** — the task-level focused map (`/projects/[id]/tasks/[taskId]`),
  opened from a task card. Root = one selected parent task; expands into its
  subtasks progressively. Header title: **"Subtask Map"**. The Workboard card
  action is labeled **"Subtask Map"** (i18n `workboard.subtasks.executionMap`).

Do not label both "Execution Map".

## NotebookLM-style behavior (both)

1. Simple initial view — root-first, nothing dumped.
2. Progressive expansion — click to reveal the next level.
3. Visually clear hierarchy — `subtask_of` edges distinct from dependency edges.
4. Collapse any branch; reset to the clean collapsed/root-only view.
5. Expand-all only by explicit user action.
6. Not overwhelming at first load (auto status-grouping above the clutter
   threshold on the Subtask Map; render-gated expansion on the Project
   Execution Map).

## Interaction parity

Pan, zoom, fit-to-view, center-selected, layout switch (radial / hierarchical /
left-to-right), search, filters, and a right-side node inspector are available
on both. Layout and expansion are presentation-only.

## Where subtasks show on the Project Execution Map

Subtask indicators and expansion live at the **Activities / Events** view
levels, where task nodes render. The **Milestones** level stays a clean
milestone flowchart (drill into a phase → see tasks → expand a task → see
subtasks). This is the intended progressive drill-down.
