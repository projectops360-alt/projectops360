# 12 — Living Graph (Module — Strategy & Audit)

> **Module doc** for the Living Graph, following the standard
> [Module Documentation Template](module-documentation-template.md). This is both the recovery
> doc (so the vision is never lost again — see [REG-005](10-regression-log.md)) and the
> living audit of the implementation. Ratified by
> [ADR-002](adrs/ADR-002-living-graph-primary-surface.md).
>
> **Capability:** [CAP-005](05-capability-registry.md) · **Last reviewed:** 2026-06-27 (Claude/Opus, module audit pass 1).

---

## 1. Module Overview
The Living Graph is the **visual digital twin** of a project: a live, navigable model of how the
work, people, resources, risks, decisions, documents, and capacity of a project relate and
influence each other. It turns the project from a set of lists into a single system you can
*see, question, and reason about.*

## 2. Product Role
It is the **primary project intelligence and navigation surface** ([ADR-002](adrs/ADR-002-living-graph-primary-surface.md)) — the
first place a leader looks to understand a project, and (intended) the hub from which they
navigate to any record. It is **never decorative** (Product DNA #2, [doc 19](19-product-dna.md)).

## 3. Primary Users
- **PMO / Admin** — full graph, cross-project intelligence (intended).
- **PM** — the graph for their assigned project(s).
- **Executives** — health/risk/critical-path at a glance, with evidence drill-down.
- **Project team** — relevant assigned work, where permitted.
- **Isabella (AI)** — reads the graph + engines to explain nodes/edges.

## 4. Core Capabilities
Visual project intelligence · critical path · risk/rework/bottleneck/traceability overlays ·
**Workforce Intelligence layer** (utilization/at-risk) · resource-capacity signals · live
milestone status · what-if simulation · executive insights panel · recalculate/orphan cleanup ·
(intended) evidence drill-down, navigation to records, and Isabella explanations.

## 5. Data Sources
`process_nodes` / `process_edges` (the graph substrate) enriched from: Tasks · Milestones · WBS ·
Dependencies · Risks · **Issues** *(missing entity)* · Decisions · Documents · Meetings ·
Communications · Resources · **Resource Capacity** (`project_resource_allocations`) · **Labor
Capacity** (construction) · Critical Path · **Execution Status Engine** *(not yet consumed)* ·
Project Memory *(future)*.

## 6. Deterministic Engines (must feed the graph)
- **Critical Path** — `lib/execution/critical-path.ts` (+ client longest-path approximation).
- **Resource Capacity Intelligence** — `lib/capacity` ([CAP-009](05-capability-registry.md), [doc 13](13-resource-capacity-intelligence.md)).
- **Risk / Dependency** — `lib/execution/health.ts`, dependency edges.
- **What-if Simulation** — `lib/graph/living-graph-analysis.ts` (`runSimulation`).
- **Workforce Health Index** — `lib/capacity/formulas.ts`.
- **Execution Status Engine** — `lib/execution/status-engine.ts` ([CAP-016](05-capability-registry.md), [doc 18](18-execution-status-engine.md)) — **MUST become the source of node state** ([ADR-006](adrs/ADR-006-independent-status-dimensions.md)). *Currently NOT wired.*

## 7. AI Behavior (Isabella) — [ADR-005](adrs/ADR-005-isabella-primary-ai-interface.md)
**Isabella MAY:** explain graph state; summarize deterministic evidence; suggest PM actions.
**Isabella MUST NOT:** invent task states, blockers, capacity gaps, risks, or dependencies; or
override the deterministic engines. She narrates the engines' truth — e.g. *"not blocked —
waiting on 2 predecessors; no impediment recorded."* (Today this wiring is **missing**.)

## 8. Permissions
- **PMO/Admin:** full graph + cross-project (intended).
- **PM:** assigned-project graph. **Team:** relevant assigned work if permitted.
- **Clients/viewers:** only external-safe views if explicitly enabled (default: no access).
- Enforced by project isolation + RLS; see [Governance Rules](23-governance-rules.md) and CAP-028.
  *(Note: full PMO/PM/Team RBAC parity on `master` is a known gap — DEBT-002.)*

## 9. Connected Modules
[Resource Capacity Intelligence](13-resource-capacity-intelligence.md) · [Execution Status
Engine](18-execution-status-engine.md) · [Executive Command Center](14-executive-command-center.md) ·
Tasks/Milestones/Dependencies/Critical Path · Risks · (future) Issues/Decisions/Communications ·
[Project Memory](17-project-memory.md) · [Isabella](16-isabella-ai-workforce.md).

## 10. Current Implementation (audited 2026-06-27) — ~75%
| Part | Source | Classification |
|------|--------|----------------|
| React Flow render, node/edge types | `components/graph/living-graph-node.tsx`, `living-graph-edge.tsx` | Implemented |
| Longest-path critical path, cycles, bottlenecks | `lib/graph/living-graph-analysis.ts` | Implemented |
| Overlays: risk / rework / traceability / bottleneck | `living-graph-analysis.ts` | Implemented |
| Labor & variance overlays | `living-graph-analysis.ts`, `variance-detail-block.tsx` | Implemented |
| What-if simulation | `living-graph-analysis.ts` (`runSimulation`) | Implemented |
| Workforce Intelligence layer | `lib/graph/workforce-graph-mapping.ts` | Implemented (restored, REG-005) |
| Executive insights panel | `components/graph/executive-summary-panel.tsx` | Implemented (restored) |
| Milestone status (live from tasks) | `lib/roadmap/progress.ts` | Implemented |
| Orphan cleanup / recalculate | `lib/roadmap/living-graph-sync.ts`, `living-graph/actions.ts` | Implemented (restored) |
| Node "Blocked" indicator | `living-graph-node.tsx` | **Ad-hoc / Needs refactor** (conflates Blocked vs Waiting — REG-006) |
| Execution Status Engine consumption | — | **Missing** |
| Isabella node explanations (live state) | — | **Missing** |
| First-class Issues/Decisions/Communications nodes | — | **Missing** |
| Navigation hub (jump to any record) | — | **Partial** (limited) |

## 11. Known Gaps (gap analysis)
Each: *current → expected · risk · path · priority · needs-ADR? · needs-PI-update?*

1. **Tab, not navigation hub.** Current: a tab under Execution Map. Expected: hub to navigate to
   any record. Risk: under-used strategic surface. Path: add node→record deep links incrementally.
   Priority: Med. ADR: no (ADR-002 covers it). PI-update: this doc. ✔
2. **Doesn't consume Execution Status Engine.** Current: node state ad-hoc. Expected: 4 independent
   dimensions from the engine ([ADR-006](adrs/ADR-006-independent-status-dimensions.md)). Risk:
   wrong status shown. Path: wire engine → node indicators. Priority: **High**. ADR: no (exists).
3. **Ad-hoc node states.** Same root as #2; status logic duplicated (DEBT-006). Priority: High.
4. **Blocked vs Waiting conflated ([REG-006](10-regression-log.md)).** Current: lock for any
   `isBlocked`/dependency. Expected: 🚫 only with explicit impediment; 🔗 waiting-on-dependency.
   Risk: misleads PMs. Path: engine wiring (#2). Priority: **High**.
5. **No first-class Issues/Decisions/Communications nodes.** Risk: relationships incomplete. Path:
   add node types + enrichers. Priority: Med. ADR: maybe (Issues = ADR-011 proposed). PI-update: yes.
6. **Isabella not wired to live state.** Expected: deterministic explanation per node
   ([ADR-005](adrs/ADR-005-isabella-primary-ai-interface.md)). Priority: **High** (after #2).
7. **Impact analysis limited** beyond what-if. Expected: richer downstream/critical-path impact.
   Priority: Med.
8. **Capacity/Workforce integration shallow.** Workforce layer restored; deeper signals
   (overhead/availability, reassignment sim) pending ([CAP-009](05-capability-registry.md)).
   Priority: Med.
9. **No Executive Command Center evidence drill-down.** Expected: graph is the drill-down behind
   KPIs ([doc 14](14-executive-command-center.md)). Priority: Med.
10. **Anti-pattern protection is doc-only.** Expected: reviewers reject decorative-only changes.
    Priority: ongoing (see §12).

## 11a. Recovered Labor / Workforce Load Layer ([REG-007](10-regression-log.md))
This capability previously existed, was lost on `master` (REG-005 facet), and was **restored in
code (PR #23)**; it became visible in production only after the alias promotion on 2026-06-27 (the
deployment-promotion gap). It is now **protected** — it must never be removed again. The Living
Graph MUST support:
- **Resource / labor nodes** (people/crews) with capacity status.
- **Assignment edges** between resources and their activities/tasks, colored by overload
  (red = overallocated/critical · amber = near capacity · green = available/healthy).
- **Workload status badges** and **overloaded vs available** indicators per resource.
- **Activity-level workload impact** — *which task/activity is causing the overload* (the
  assignment edges from an overloaded resource point to exactly those tasks).
- **Milestone impact** from overloaded resources; **missing-assignment / missing-estimate** warnings.
- **Construction:** the `laborCapacity` overlay (`labor-graph-mapping.ts`) keeps crew/trade labels.
- **All project types:** the `workforceCapacity` overlay (`workforce-graph-mapping.ts`) over the
  generic Resource Capacity engine ([doc 13](13-resource-capacity-intelligence.md), [ADR-009](adrs/ADR-009-reconcile-capacity-engines.md)).

**How to see it (verification):** Execution Map → Living Graph → overlay selector → **Workforce**
(or **Labor** for construction) → set the view level to **Activities** → resource nodes appear with
overload colors and assignment edges to the tasks driving the load; click a resource node for its
workload detail. *(Requires captured capacity data — `hasResources`.)* **Known discoverability
limitation:** the people-nodes view shows in **Activities/Events** level, not the default
**Milestones** level — a follow-up should auto-surface it when the overlay is selected.

## 12. Risks / Anti-patterns (GUARD — strengthened)
**Any change that makes the Living Graph prettier without advancing its role as intelligence,
navigation, evidence, execution understanding, or impact analysis MUST be rejected.** Decoration
is not progress. A purely cosmetic change requires an ADR justifying it
([ADR-002](adrs/ADR-002-living-graph-primary-surface.md)).

**Status truth ([REG-008](10-regression-log.md), partially resolves [REG-006](10-regression-log.md)):**
- **Blocked is not Waiting.** The graph must never infer "Blocked" from dependencies, and never
  from a stale flag on a **completed** item ([ADR-006](adrs/ADR-006-independent-status-dimensions.md)).
- **Node states come from the Execution Status Engine** (`lib/graph/living-graph-status.ts` →
  `lib/execution/status-engine.ts`), not ad-hoc logic.
- **Header counts derive from the same resolver as the node indicators** — they must agree.
- **Resolved blockers must not appear** in graph summary counts (terminal lifecycle wins).
- **Waiting on Dependency uses a different indicator** (🔗) from Blocked (🚫); the header shows
  blocked and waiting separately.

## 13. Future Roadmap (recommended sequence)
1. **Wire the Execution Status Engine** → fixes gaps #2/#3/#4 (the highest-leverage move).
2. **Isabella node explanations** from the engine (gap #6).
3. **Deeper capacity/workforce signals** (gap #8).
4. **First-class Issues/Decisions/Communications nodes** (gap #5).
5. **Command Center evidence drill-down** (gap #9) + **navigation hub** deep links (gap #1).
6. **Richer impact analysis** (gap #7).

## 13b. Governing product decisions
Binding decisions recorded in the [Product Decision Log](30-product-decision-log.md):
**PD-001** Critical Path lives in the Living Graph · **PD-003** Variance requires a baseline ·
**PD-004** Timeline Playback requires real history · **PD-005** What-if is sandbox-first
(simulation only) · **PD-006** Risk/SOP disconnected nodes must be explained · **PD-007** Focus
Mode (the graph is the protagonist).

## 14. Related ADRs
[ADR-002](adrs/ADR-002-living-graph-primary-surface.md) (primary surface) ·
[ADR-006](adrs/ADR-006-independent-status-dimensions.md) (independent status dims) ·
[ADR-005](adrs/ADR-005-isabella-primary-ai-interface.md) (Isabella) ·
[ADR-003](adrs/ADR-003-resource-capacity-intelligence.md) (capacity it consumes).

## 15. Capability IDs
[CAP-005](05-capability-registry.md) (owner) · consumes [CAP-009](05-capability-registry.md),
[CAP-016](05-capability-registry.md), [CAP-023](05-capability-registry.md); supports
[CAP-015](05-capability-registry.md).

## 16. Last Reviewed
2026-06-27 — module audit pass 1 (documentation only; no runtime changes).
