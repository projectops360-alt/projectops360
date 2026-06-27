# 29 — Sprint #4: Living Graph Navigation Hub & Evidence Drill-Down

Turn the Living Graph from a visualization into a **navigation + evidence layer**. Clicking a
meaningful node must answer: **(1) What am I? (2) Why am I here? (3) What evidence supports me?
(4) What am I connected to? (5) What should the user do next?** A node that can't be explained,
traced, or acted on is not project intelligence ([ADR-002](adrs/ADR-002-living-graph-primary-surface.md)).

> Scope guard: no new engines, no fake navigation, no AI-invented data.

---

## Decisions (binding)
- **Nodes are not dead visual objects.** Every node's detail panel offers a **"Go to record"**
  deep link to the real app area for its source record.
- **Navigation is honest.** Source types with a real page deep-link to it; types without a page
  yet return a **disabled** action with "This record type does not have a dedicated page yet" —
  never fake navigation. (`src/lib/graph/node-navigation.ts`, unit-tested.)
- **Evidence-first.** The panel shows the deterministic **Execution Status** (ADR-006), the
  status/dates/dependencies/capacity/variance/readiness evidence already computed, and the
  node's relationships (incoming/outgoing). When a node has no links, it says so
  ("not yet linked to other project records") rather than failing silently.
- **Isabella explanation** is present as an action but **safely deferred** (disabled, "soon") — the
  grounded context handoff lands in a later sprint. Isabella must only ever narrate deterministic
  evidence + Project Memory, never invent (ADR-005).

## Source type → record route (today)
| Source | Opens | Source | Opens |
|--------|-------|--------|-------|
| roadmap_tasks | Workboard | resources | Resource Capacity |
| milestones | Execution Map | construction_activities | Labor Capacity |
| decisions | Decisions | budget_items | Budget |
| communication_items | Communications | drawing_files/insights | Drawing Intelligence |
| meetings | Meetings | documents | Documents |
| project_memory_items | Project Memory (forward-compat) | | |

**No dedicated page yet (disabled, honest):** risks, rfis, submittals, inspections, permits,
material_requirements, procurement_items, critical_path_snapshots.

## Node detail model (implemented)
Title · type · status · **execution status** · progress/dates/duration · risk/blocker · critical
path · neighbors (in/out degree, downstream/upstream) · relationships (incoming/outgoing records) ·
capacity/readiness/variance evidence blocks · **Go-to-record actions** · graph actions (find path,
downstream, focus, edit) · simulation scenarios · **Ask Isabella (deferred)**.

## Command Center drill-down (preparation)
The structured node detail (source record + evidence + relationships + navigation) is the
evidence layer an Executive KPI will drill into: **KPI → nodes → evidence → action**. This sprint
makes the data structured enough to reuse; the Command Center surface itself is a later sprint
([doc 14](14-executive-command-center.md)).

## Permissions
The graph and its records are project-scoped (org-context + RLS). Cross-project data is never
exposed. Full PMO/PM/Team RBAC tiers (per-role evidence gating) remain a known gap — DEBT-002.

## What was intentionally NOT changed
Overlay engines/semantics, capacity/AI logic, Workforce/Labor layers, Critical Path,
Waiting-vs-Blocked, Focus Mode (S#2), overlay clarity (S#3), and the S#1 Workboard/Roadmap — all
intact (285 tests green).

## Protection rule
Every meaningful node must remain explainable, traceable to evidence, and navigable to its real
record (or honestly state no page/evidence exists). The Living Graph is the evidence-first
drill-down surface behind project intelligence.
