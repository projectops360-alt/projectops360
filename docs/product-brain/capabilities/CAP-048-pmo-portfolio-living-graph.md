# CAP-048 — PMO Portfolio Living Graph (Dashboard 3)

**Status:** Phase 1 in progress · **Flag:** `PMO_LIVING_GRAPH_ENABLED` (default OFF)
**Route:** `/[locale]/(app)/pmo-living-graph` · **Owner capability:** PMO portfolio intelligence

A third, additive dashboard. It turns the portfolio into a queryable operational
graph: every project is a subgraph, and all projects in an organization connect
into one PMO supergraph. It answers what the two existing dashboards structurally
cannot — *which projects are entangled, through what, and what breaks if this
node moves*.

This document is the pre-implementation architecture record required before any
code is written. It states what exists, what does not, and what Phase 1 will and
will not do.

---

## 1. Existing surfaces — what must not change

Verified against the repository, not assumed.

| # | Surface | Route | Root | Data source | Access |
|---|---|---|---|---|---|
| 1 | **PMO Command Center** | `/` | `src/app/[locale]/(app)/page.tsx` | `src/lib/command-center/service.ts` (13 tables in parallel) | All org members |
| 2 | **Process Intelligence** | `/process-intelligence` | `src/app/[locale]/(app)/process-intelligence/page.tsx` → `CommandCenterShell` | `src/lib/pmo-process-intelligence/*` | Flag `PMO_PROCESS_INTELLIGENCE_DASHBOARD_ENABLED` + role ∈ {owner, admin}, else `notFound()` |
| — | **Project Living Graph** | `/projects/[projectId]/execution-map/living-graph` | `src/components/graph/living-graph-view.tsx` | `process_nodes` / `process_edges` **only** | Project members |

`src/lib/pmo-rollup/` is a **library**, not a dashboard — it is imported by tests
and internal callers, never by a route.

### Coexistence contract

Dashboard 3 is **additive**. It does not touch:

- `src/app/[locale]/(app)/page.tsx` and `src/lib/command-center/*`
- `src/app/[locale]/(app)/process-intelligence/**` and `src/lib/pmo-process-intelligence/*`
- `src/components/graph/**` and `src/lib/graph/**` (the project Living Graph)
- `src/config/navigation.ts` behaviour when the flag is OFF

With the flag OFF the application is byte-for-byte the application that exists
today. That is an executable claim, pinned by `PMO-LG-FLAG-OFF` (§8).

### Matrix — existing dashboards vs Dashboard 3

| Dimension | D1 Command Center | D2 Process Intelligence | **D3 PMO Living Graph** |
|---|---|---|---|
| Question | "How is the portfolio doing?" | "How does work flow, and where does it stall?" | "How is the portfolio *connected*, and what breaks if this moves?" |
| Primitive | KPI cards + lists | Process flow / variants | Typed graph (nodes + edges) |
| Unit | Project | Case (project or business object) | Node of any canonical entity |
| Scope | Organization | Organization or one project | Organization; each project is a subgraph |
| Cross-project | Aggregated totals | Not modelled | **First-class** (shared resources, dependencies, traceability) |
| Provenance | Implicit | Evidence per insight | **Per edge**, mandatory |
| Reads | 13 tables | Flow + finance + overlays | Canonical tables via its own read model |
| Writes | — | — | Views/layouts and declared edges **only** |

---

## 2. Entity coverage — verified, not assumed

Phase 1 rule (prompt rule 3): no invented tables, columns or entity names. Each
node kind below maps to a table that exists in `supabase/migrations/`.

### Supported in Phase 1

| Node kind | Table | Notes |
|---|---|---|
| `organization` | `organizations` | Graph root |
| `project` | `projects` | Subgraph anchor / cluster |
| `milestone` | `milestones` | |
| `task` | `roadmap_tasks` | Carries CPM fields (`is_critical`, `slack_days`) |
| `subtask` | `task_subtasks` | Deep zoom only |
| `risk` | `risks` | Has `linked_task_id`, `linked_milestone_id` |
| `decision` | `decisions` | |
| `resource` | `resources`, `resource_profiles` | |
| `team_member` | `project_team_members` | |
| `stakeholder` | `stakeholders` | |
| `kpi` | `kpi_definitions` | Org-level when `project_id IS NULL` |
| `budget_item` | `budget_items` | Only where finance data is trustworthy |

### Not supported in Phase 1 — no table exists

| Requested | Reality | Phase 1 behaviour |
|---|---|---|
| Portfolio | No table. A portfolio is the implicit set of an org's projects. | Organization node acts as root. `portfolio_id` exists on `project_event_log` but is unpopulated — not used. |
| Program | No table. | Omitted. |
| Phase | No table. | Omitted; `milestones` is the closest real unit. |
| Deliverable | Free text in `project_charters.major_deliverables`. | Omitted — free text is not a linkable entity. |
| Issue | No table. Appears only as a `raci_role` enum value. | Omitted. |
| Objective | Free text in `project_charters.objectives`. | Omitted. |

Surfacing these as empty or synthetic nodes would violate rule 14. They are
Phase 2 candidates and require domain tables first.

---

## 3. Edge derivation — every edge declares where it came from

No edge is invented. Each derives from a real relation, and each carries its
provenance and the evidence that produced it.

| Edge type | Derived from | Provenance |
|---|---|---|
| `contains` / `belongs_to` | FK: project→milestone→task→subtask | `OBSERVED` |
| `depends_on` / `blocks` | `task_dependencies` (`dependency_type`, `lag_days`) | `OBSERVED` |
| `impacts` | `risks.linked_task_id`, `risks.linked_milestone_id` | `OBSERVED` |
| `assigned_to` / `owned_by` | `project_resource_allocations`, `roadmap_tasks` owner, `risks.owner_user_id` | `OBSERVED` |
| `consumes_budget` | `budget_items.milestone_id`, `cost_actuals.task_id` | `OBSERVED` |
| `contributes_to` | `traceability_links` (`link_type` already typed) | `OBSERVED` |
| `triggered_by` | `project_event_log.caused_by` — explicit causation only | `OBSERVED` |
| **`shares_resource_with`** | Two projects allocating the same `resource_profile_id` over **overlapping dates** | `INFERRED` |

`shares_resource_with` is the only computed edge in Phase 1, and it is
deterministic: a date-range intersection over `project_resource_allocations`. No
LLM participates in edge creation (prompt rule: Phase 1 forbids it). Its
evidence records both allocation ids and the overlap window, so the UI can
answer "why does this edge exist?" with records rather than prose.

Temporal adjacency is **never** promoted to causation — the same rule CAP-045
already enforces on the project Living Graph.

---

## 4. Architecture

```
src/lib/pmo-living-graph/
  flags.ts                  Feature flag + role gate (mirrors CAP-047)
  contracts.ts              GraphNode / GraphEdge / GraphView, provenance enums
  node-projection.ts        Canonical rows  → GraphNode[]        (pure)
  edge-projection.ts        Canonical rows  → GraphEdge[]        (pure)
  shared-resources.ts       Date-overlap detection               (pure)
  graph-algorithms.ts       Neighbours, path, blast radius,
                            centrality, communities, orphans     (pure)
  portfolio-metrics.ts      PMO metrics + formulas               (pure)
  critical-nodes.ts         Criticality + its explanation        (pure)
  subgraph.ts               Semantic-zoom windowing              (pure)
  read-model.server.ts      Supabase reads, org-scoped           (server)
  views.server.ts           Saved views / layouts CRUD           (server)
  isabella-contracts.ts     getNode, getNeighbors, findPath, …   (server)

src/components/pmo-living-graph/   Canvas, side panel, filters, legend
src/app/[locale]/(app)/pmo-living-graph/page.tsx
supabase/migrations/20260861000000_pmo_living_graph.sql
```

Everything above the `.server.ts` line is pure and unit-testable without a
database — the same split that made the Process Intelligence engine testable.

**Reuse without coupling:** `@xyflow/react` v12 and `@dagrejs/dagre` are already
dependencies; the canvas uses them directly. It does **not** import from
`src/lib/graph/**` or `src/lib/pmo-process-intelligence/**`, so neither existing
dashboard becomes a dependency of this one.

### Persistence

Two new tables, both RLS-guarded by `is_org_member(organization_id)`:

- **`pmo_graph_views`** — saved views: node positions, pinned nodes, expanded
  clusters, filters, viewport, layout, version. Presentation state only.
- **`pmo_graph_declared_edges`** — human-declared relationships that do not exist
  in the domain yet, with author and audit trail. Provenance `DECLARED`.

The rule from UX-007/PD-008 carries over verbatim: **a stored position is never
operational truth.** Positions apply on top of auto-layout when the node still
exists; orphaned positions are dropped on load and reported.

A declared edge may never join two organizations — enforced in the migration by
a check that resolves both endpoints' `organization_id`, not merely in code.

### Computation and caching

| Concern | Decision |
|---|---|
| Node/edge projection | On demand per request, org-scoped |
| Subgraph windowing | Server-side; the client never receives the full portfolio |
| Layout | Client, deterministic (dagre) |
| Positions | `pmo_graph_views`, per user + org |
| Invalidation | `revalidatePath` on the route; no bespoke cache in Phase 1 |
| Realtime | Out of scope for Phase 1 |

The default view opens at portfolio level with projects collapsed, so a large
org renders anchors and inter-project edges — never every task at once.

---

## 5. Security

- Every read is scoped by `organization_id` from `getOrgContext()`; the client
  never supplies it.
- The route calls `notFound()` when the flag is off or the role is not
  authorized, matching `/process-intelligence` and `/admin`.
- Both new tables get RLS with `is_org_member(organization_id)` plus a
  `service_role` policy, following the pattern in
  `20260611000000_enable_rls_business_tables.sql`.
- Cross-organization edges are rejected at the database level.
- Hover cards show operational fields only — never emails, rates or salary data.
- Declared edges are audited: author, timestamp, and mutation via server action.

---

## 6. Metrics — formulas, and what stays separate

Only metrics computable from real data are shown; anything else renders
**"Data unavailable"**, never a zero.

| Metric | Formula | Guard against double counting |
|---|---|---|
| Total projects | `count(projects)` where not deleted | — |
| Projects at risk | Projects with ≥1 `risks.severity ∈ {high, critical}` and `status ∈ {open, mitigating}` | Project counted once regardless of risk count |
| Risk exposure (monetary) | Σ of risk-linked `budget_items.estimated_cost` | A budget item reached by several risks counts once |
| Blocked days | Σ over tasks with `status = 'blocked'` of days in that state, from `project_event_log` transitions | Per task, not per event |
| Cross-project dependencies | Edges whose endpoints belong to different projects | Undirected pair counted once |
| Shared / overloaded resources | Resources allocated to >1 project with overlapping dates; overload from `resource_workload_snapshots.overallocated_hours` | Resource counted once |
| Critical nodes | Degree centrality above threshold **or** `is_critical` on the canonical row | — |

**Monetary exposure and day exposure are reported separately and never summed.**
Mixing currency with duration produces a number that means nothing.

---

## 7. Isabella

No conversational surface and no new AI provider in Phase 1. `isabella-contracts.ts`
exposes typed, permission-respecting, evidence-returning functions —
`getNode`, `getNeighbors`, `findPath`, `getBlastRadius`, `getCriticalNodes`,
`getPortfolioMetrics`, `explainRelationship` — ready for a later phase to call.

---

## 8. Test plan

| Guard | Protects |
|---|---|
| `PMO-LG-FLAG-OFF` | Flag off ⇒ route 404s, no nav entry, existing dashboards unchanged |
| `PMO-LG-NODE-PROJECTION` | Canonical rows → nodes, including missing/null fields |
| `PMO-LG-EDGE-PROJECTION` | Dependencies and links → typed edges with provenance |
| `PMO-LG-SHARED-RESOURCE` | Date-overlap detection, including boundary and non-overlap |
| `PMO-LG-PATH` | Path finding, unreachable pairs, cycle safety |
| `PMO-LG-BLAST-RADIUS` | 1/2/3 hops, no double counting when paths reconverge |
| `PMO-LG-CENTRALITY` | Centrality and the *explanation* of criticality |
| `PMO-LG-ORG-ISOLATION` | No cross-organization leakage in any projection |
| `PMO-LG-LAYOUT` | Layout persistence and orphaned-position cleanup |
| `PMO-LG-METRICS` | Formulas and double-count prevention |
| `PMO-LG-EMPTY-STATE` | Empty vs unavailable are distinguishable, never faked |
| existing suites | Both dashboards and the project Living Graph re-run unchanged |

---

## 9. Explicitly out of scope

AI prediction · What-if simulation · Time Travel · advanced Root Cause Miner ·
Variant Analysis · new process mining · autonomous recommendations · automatic
project mutation · Neo4j or any graph database · a new financial engine · new
external integrations · redesign of Dashboards 1–2 · restructuring the project
Living Graph · forced visual unification of the three dashboards.

The graph is a **projection over the existing architecture**. It introduces no
second source of operational truth.

---

## 10. Phase 2 candidates

Domain tables for Portfolio, Program, Phase, Deliverable, Issue and Objective —
without them those node kinds cannot exist honestly. Then: realtime sync,
Isabella conversational access, time travel over `project_event_log`, and
declared-edge review workflow (`DISPUTED` → `CONFIRMED`).
