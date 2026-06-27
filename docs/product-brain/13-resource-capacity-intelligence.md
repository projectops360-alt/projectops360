# 13 — Resource Capacity Intelligence (Recovery Doc)

Ratified by [`ADR-003`](adrs/ADR-003-resource-capacity-intelligence.md). Capabilities:
CAP-009..014. This is the most-lost concept in the product's history (REG-004). This document
recovers the **full intended vision** so it can never be silently reduced again.

> Reduction to avoid: "Resource Capacity = assign a person to a task." That is *assignment*,
> not capacity intelligence.

---

## Concept model

### Capacity types
- **Nominal capacity** — theoretical max hours (e.g. 40 h/week per resource).
- **Effective capacity** — nominal adjusted for **availability** and **overhead** (the hours
  actually available for project work).
- **Available capacity** — effective minus already-committed.
- **Remaining capacity** — what's left after assigned workload; can go negative
  (over-allocation).
- **Assigned workload** — hours committed by tasks/activities.

### Utilization & overhead
- **Utilization** = assigned ÷ effective (the headline "how busy" metric).
- **Overhead** = non-project hours: **administrative work, meetings, documentation, support,
  training, travel, internal work.** Overhead reduces effective capacity and must be explicit,
  not hidden.
- **Workforce availability** = % of nominal time actually available (PTO, partial allocation,
  shared resources, calendar exceptions).

### Allocation states
- **Overallocated** — assigned > effective (burnout risk; schedule risk).
- **Underallocated / bench / idle** — effective ≫ assigned (cost risk; reassignment opportunity).
- **Billable vs non-billable** — separate project-billable hours from internal/overhead.

### Intelligence layers
- **Burnout prediction** — sustained over-allocation + trend → risk flag *(MISSING today)*.
- **Capacity forecast** — projected capacity vs demand over future weeks *(MISSING today)*.
- **Resource health score** — composite of utilization, overhead, availability, over/under
  allocation *(partially present: workforce health index)*.
- **Workforce digital twin** — a live model of the workforce enabling **resource simulation** and
  **what-if reassignment** *(MISSING today)*.

### Impact propagation (what makes it "intelligence")
A capacity change must propagate to:
- **Schedule** (dates slip when capacity is short),
- **Budget** (over/under-allocation has cost),
- **Critical Path** (capacity on critical tasks is decisive),
- **Living Graph** (Workforce layer lights up at-risk work — *present*),
- **Isabella** (explains who is overloaded and why, and the consequences).

### Executive summary (PMO view)
One headline + bullets answering: do we have capacity, who is overloaded, where is the
bottleneck, which milestones are at risk, what should we do — with recommendations that require
human approval (*present today via `buildCapacitySummary`*).

---

## Current implementation status (audited 2026-06-27)

| Aspect | Status |
|--------|--------|
| Engine: nominal/effective/remaining, utilization, overhead, health index, deductions | Implemented (`lib/capacity/formulas.ts`, `service.ts`, `insight.ts`) |
| `/resource-capacity` page: per-resource table, weekly capacity, capacity risks, PMO summary | Implemented |
| Capacity capture editor (per-resource hours/availability/overhead) | Implemented |
| Living Graph Workforce layer (utilization/at-risk enrichment + roster) | Implemented |
| Data: `project_resource_allocations`, `resource_profiles`, `resource_workload_snapshots`, `workforce_health_scores`, `resource_availability_exceptions` | Tables exist (migration `20260812`, applied in prod) |
| Burnout prediction | **Missing** |
| Capacity forecast | **Missing** |
| What-if reassignment / workforce digital twin / simulation | **Missing** |
| Billable vs non-billable / bench / idle modeling | **Partial/Missing** |
| Impact on budget / critical path (wired) | **Partial** |

**Overall: Partial (~45%).** Restored to `master` on 2026-06-27 (PR #23) after being lost (REG-004).

## Missing pieces (priority order)
1. Reconcile with `lib/labor/capacity.ts` (construction labor) — define shared core vs domain
   layer (ADR-009).
2. Over/under-allocation insights surfaced as actions; bench/idle visibility.
3. Capacity forecast (demand vs supply over horizon).
4. Burnout prediction (sustained over-allocation + trend).
5. What-if reassignment with impact propagation → workforce digital twin.
6. Wire capacity impact into Critical Path and Budget explicitly.

## Implementation roadmap
- **R1:** harden current engine + tests; reconcile capacity engines (ADR-009).
- **R2:** allocation insights (over/under, bench, billable split) + Living Graph signals.
- **R3:** forecast + burnout prediction + resource health surfaced to Isabella & Command Center.
- **R4:** simulation / digital twin with cross-impact (schedule, budget, critical path, graph).

> Do not let this vision get lost again. Any capacity work updates CAP-009..014 and references
> this doc.
