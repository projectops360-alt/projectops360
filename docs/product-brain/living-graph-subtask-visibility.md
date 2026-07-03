# Living Graph Subtask Visibility — NotebookLM-style progressive expansion

> **Mandatory product requirement.** Subtasks must be visible and explorable
> inside the Living Graph experience. Two related but distinct surfaces expose
> task hierarchy: the **Project Execution Map** (project-level) and the
> **Subtask Map** (task-level). Both feel like NotebookLM mind-map exploration:
> the graph starts simple and the user clicks to reveal more — never dumping
> everything at once, never hiding the hierarchy.
> Guard: **LIVING-GRAPH-SUBTASK-VISIBILITY-NOTEBOOKLM-MODE**.

## 1. Two surfaces, clearly named

| Surface | Where | Root | Scope |
|---|---|---|---|
| **Project Execution Map** | Execution Map → Living Graph (`/execution-map/living-graph`) | the whole project graph (milestones → tasks) | milestones, tasks, dependencies, risks, decisions, approvals, execution status, health overlays, **and subtask hierarchy** |
| **Subtask Map** | Task card → "Subtask Map" (`/tasks/[taskId]`) | ONE selected parent task | that task + its subtasks, blockers, dependencies |

The task-level surface is now labeled **"Subtask Map"** (was "Task Execution
Map") so the two are never ambiguously both "Execution Map".

## 2. Project Execution Map — subtask hierarchy

- Task nodes that **have subtasks** show a visible indicator: a clickable
  badge with `completed/total` count, a blocked count, and an expand/collapse
  chevron (`aria-expanded`). Color is never the only signal (text + icon).
- **NotebookLM default:** the graph loads collapsed — **no subtask nodes are
  rendered until the user expands a task**. Clicking the indicator (or the
  toolbar **Expand all**) reveals that task's direct subtasks as child nodes
  connected by **hierarchy edges** (`subtask_of`: solid violet, curved),
  visually distinct from dependency edges (`caused`: gray solid) and signal
  edges (dashed).
- A **subtask controls bar** appears at the activities/events levels when any
  task has subtasks: it shows how many tasks have subtasks, how many are
  currently expanded, and **Expand all / Collapse all** (explicit user action).
- Subtask nodes respect the source subtask's status, priority, owner, progress,
  blocked flag, due date, and inherit the parent's milestone. Selecting a
  subtask node opens the detail panel with owner (team member name), due date,
  priority, blocked reason, and a **"View project team"** action.
- Subtasks appear where task nodes exist (Activities / Events view levels), not
  at the Milestones level — matching the progressive drill-down
  (milestones → tasks → subtasks).

## 3. Subtask Map — root-first exploration

- Opens showing **only the root task node**, with its subtask-count affordance
  ("Click to reveal N subtasks").
- Clicking the root (or **Expand**) reveals the direct subtasks; **Collapse**
  returns to the root-only view. Grouping/layout controls appear only once
  expanded. Pan / zoom / fit-to-view / center-selected / reset and the three
  layouts (radial / hierarchical / left-to-right) are all available.
- **Default layout is left-to-right**, so expanded subtasks flow horizontally
  from the parent (matching the Living Graph milestone drill-down, §11).
- **Manual drag + save (UX-007 parity):** nodes are draggable; a user drag
  overrides the auto-layout (presentation only). **Save layout** persists the
  arrangement + viewport to localStorage scoped per **project + task + layout
  mode** (`src/lib/subtasks/subtask-map-layout.ts`); it is restored on the next
  visit and reconciled against the live nodes (stale positions dropped, new
  subtasks auto-placed, with an honest "partially applied" notice). **Reset to
  auto** returns to the deterministic layout; **Clear saved** removes the
  stored arrangement. Saved data is **coordinates + viewport only** — never
  subtask data, status, or relationships.
- **Delete from the node:** managers (owner/admin) get a trash button on each
  subtask node (and in the detail panel) that deletes the subtask through the
  audited `deleteSubtaskAction` after a confirmation. Contributors/viewers
  never see it (RBAC — the handler is only supplied when `canManage`).
- The Table/List fallback view remains for fast editing.

## 11. Milestone drill-down flows left-to-right (Living Graph)

Selecting/drilling into a milestone in the Project Execution Map now switches
the layout to **timeline (left-to-right)** so the milestone's tasks read
horizontally — the same left-to-right flow the Subtask Map uses when it
expands. This is a presentation default; the user can still pick any layout
mode, and each mode keeps its own saved arrangement (UX-007).

## 4. Expand / collapse / reset behavior

- **Project Execution Map:** per-task toggle (client/session `Set<taskId>`),
  Expand all, Collapse all. Switching view level resets naturally.
- **Subtask Map:** root Expand / Collapse (client state), plus the existing
  group expand for large sets. Collapse returns to the clean root-only view.
- Expansion state is **session/client state only** — presentation, never
  persisted as canonical data. (The app's saved-layout model, UX-007, persists
  node coordinates only; expansion is intentionally kept in memory to avoid
  stale references.)

## 5. Layout controls

Both surfaces provide layout modes (mind-map/radial, hierarchical tree,
left-to-right) plus fit-to-view and reset. **Layout changes are
presentation-only:** they never change task order, status, or parent/subtask
relationships, and never mutate canonical data.

## 6. Team member access

- Subtask/task nodes show the owner/assignee when available.
- The node inspector resolves the owner id to a display name (server-fetched,
  RBAC-scoped) and offers **View project team** → the existing Team page. No
  second team-management system is created; the existing Resources / team
  member data is reused.

## 7. Data source & query behavior

- The Project Execution Map server page fetches `task_subtasks` for the project
  (org + project scoped; RLS enforced) and resolves owner display names via the
  admin client **for reads only** (access already gated by the project-ownership
  check). Deleted/archived subtasks are filtered (`deleted_at IS NULL`) and
  filtered again defensively in the pure layer.
- Ordering is deterministic: `sort_order` → `created_at` → `id`.
- The Subtask Map page already fetches the task's subtasks (Task Execution Map
  feature). Hierarchy is read from the existing `task_id` parent link — never
  fabricated.

## 8. RBAC / security

- Users only see subtasks of projects in their organization (server query
  scope + RLS). Cross-project / cross-org subtasks are never returned.
- Owner names are resolved read-only and only for the fetched subtasks.
- Unauthorized root task access falls through the existing project-ownership
  `notFound()` — a safe state with no leaked details.

## 9. What is read-only / never mutated

- Synthetic subtask nodes (`subtask_item`) and hierarchy edges (`subtask_of`)
  are **client-side presentation** built at render time. They are **never**
  written to `process_nodes` / `process_edges`.
- No `project_event_log` write is introduced by this feature.
- No canonical task/subtask data is mutated by expansion, collapse, or layout.
- The MPF Engine, the Project Event Graph, and the Living Graph Realtime Engine
  contracts are unchanged (the layer is a read-only consumer of already-fetched
  subtask rows).

## 10. Known limitations

- Subtasks are one level deep (`task_subtasks` has no self-parent), so
  "recursive" subtask-of-subtask expansion is structurally N/A today; the
  layer and reducers already support arbitrary expansion sets for a future
  nested model.
- The Project Execution Map does not lazy-load subtasks per expand — it fetches
  the project's subtasks once and renders only expanded ones (render-gated).
  Lazy per-expand loading is a future optimization for very large projects.
- Subtask nodes are excluded from critical-path/analysis metrics (they are a
  presentation layer over the analyzed task graph); this is intentional.
- Canvas keyboard navigation uses React Flow defaults; the table views remain
  the fully keyboard-accessible path.
