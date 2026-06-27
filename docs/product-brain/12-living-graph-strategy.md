# 12 — Living Graph Strategy (Recovery Doc)

Ratified by [`ADR-002`](adrs/ADR-002-living-graph-primary-surface.md). Capability: CAP-005.
This document recovers and protects the intended vision so it is never reduced to a decorative
visualization again (REG-005).

## What the Living Graph IS (intended)

- **Primary project intelligence surface** — the first place a leader looks to understand the
  project.
- **Visual digital twin** of the project: a live model, not a static diagram.
- **Navigation layer** — a way to move through the product (jump to the task, the resource, the
  risk, the decision, the document) from the graph.
- **Relationship engine** — encodes how work, people, resources, risks, issues, decisions,
  documents, meetings, communication, and capacity relate.
- **Impact-analysis surface** — what-if and downstream-impact propagation.
- **AI explanation surface** — Isabella explains any node/edge in plain language, grounded in
  deterministic engines.

## What it must connect to
People · Resources & Capacity · Risks · Issues · Decisions · Documents · Meetings ·
Communication · Tasks/Milestones/WBS · Critical Path · Budget/Cost.

## Current implementation (audited 2026-06-27)
- **Implemented (~75%):** render (React Flow), longest-path critical path, cycles/bottlenecks,
  overlays (risk/rework/traceability/labor/variance), what-if simulation, executive insights
  panel, **Workforce Intelligence layer**, recalculate/orphan cleanup, live milestone status.
- **Source:** `lib/graph/*`, `components/graph/*`, `/execution-map/living-graph`.

## Missing functionality (the gap to the vision)
1. **Not yet the navigation layer** for the whole app (it's a tab, not a hub).
2. **Does not consume the Execution Status Engine** → node states are computed ad-hoc and the
   Blocked/Waiting conflation persists (REG-006).
3. **Not connected to issues/decisions/communications** as first-class node types.
4. **Isabella node explanations** are not wired to live execution state.
5. Limited as an **impact surface** beyond the existing what-if simulation.

## How the Living Graph should consume Resource Capacity Intelligence (CAP-009)
- Enrich displayed nodes (milestones/tasks) with capacity status so over-allocated/at-risk work
  lights up (the Workforce layer — already restored).
- Surface a **workforce roster** with utilization; show **overhead** and **availability** as
  node/edge signals; let capacity risk drive node emphasis.
- Future: simulate reassignment on the graph and propagate impact (schedule, budget, critical
  path) visually.

## How the Living Graph should consume the Execution Status Engine (CAP-016)
- Each node renders **four independent indicators** (Execution Status, Health, Risk, Dependency)
  plus Critical-Path and Progress — never a single "Blocked" lock derived from dependencies
  (ADR-006). Use semantic indicators: ⏳ Waiting · 🔗 Waiting on Dependency · 🚫 Blocked ·
  ⏸ On Hold · ✅ Completed · ⚠️ Risk · ◆ Critical Path.

## How the Living Graph supports the Executive Command Center (CAP-015, doc 14)
- The graph is the drill-down surface behind executive KPIs: from a health/risk number to the
  exact nodes and explanations driving it (evidence-first).

## How Isabella explains graph nodes (ADR-005)
- On selecting a node, Isabella answers "why is this X?" using the Execution Status Engine's
  deterministic explanation (e.g. "not blocked — waiting on 2 predecessors; no impediment
  recorded").

## Anti-pattern guard
Any change that makes the graph prettier without advancing its role as intelligence/navigation/
impact/explanation surface requires an ADR justifying it. Decoration is not progress (ADR-002).
