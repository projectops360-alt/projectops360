# ADR-009 — Reconcile Resource Capacity and Labor Capacity Engines

**Status:** Accepted · 2026-06-27 · Pillars P3 (Resource & Capacity), P2 (Living Intelligence)

## Context
Two capacity systems coexist and both feed the Living Graph:
- **`lib/capacity`** — generic Resource Capacity Intelligence (nominal/effective hours,
  availability, overhead, utilization, remaining, overallocation, Workforce Health Index). Feeds
  the graph via `workforce-graph-mapping.ts` (Workforce overlay). Project-type-agnostic.
- **`lib/labor/capacity.ts`** — construction-specific Labor Capacity (weekly gaps by **trade /
  crew / headcount / shortage severity**; mirrors SQL `compute_labor_capacity()`). Feeds the graph
  via `labor-graph-mapping.ts` (laborCapacity overlay).

This is duplicated capacity logic with overlapping concepts (utilization, availability,
shortage/overload) computed two ways — a drift and confusion risk (DEBT-003). It was flagged by the
Living Graph audit ([doc 12](../12-living-graph-strategy.md)) and confirmed by the Resource
Capacity audit ([doc 13](../13-resource-capacity-intelligence.md)).

## Decision
1. **Resource Capacity Intelligence (`lib/capacity`) is the canonical, generic capacity engine.**
   All hours/availability/overhead/utilization/health math lives here and is the single source.
2. **Labor Capacity remains a construction-specific view/profile**, preserved as-is for now
   (trade/crew/headcount/shortage). Over time its generic capacity math should be expressed *in
   terms of* the generic engine; its construction vocabulary and trade/headcount modeling stay as a
   domain layer/profile.
3. **The Living Graph consumes capacity through the generic engine** (Workforce layer). The
   construction laborCapacity overlay stays for construction projects but must not re-derive generic
   capacity numbers differently.
4. **No duplicated capacity calculations.** A given capacity concept is computed in exactly one
   place.
5. **AI/Isabella explanations use the deterministic capacity outputs only** — never recomputed or
   invented.
6. **Missing data is flagged, never invented** (`needs_review` / `incomplete_estimate` /
   `unassigned` / `not_enough_data`).

## Consequences
- Future capacity features extend `lib/capacity`; Labor Capacity adapts to consume/align with it
  rather than maintaining a parallel formula set.
- This is a **governance decision now**; the actual code reconciliation is a future implementation
  task (no runtime change in this pass). It must not break the existing construction Labor Capacity
  experience (REG-safe).
- The Living Graph's two overlays remain, but their numbers must agree (one engine).

## What this prevents
- Drift between two capacity truths; the re-loss of the generic capacity vision (REG-004);
  contradictory capacity numbers across the page, the graph, and the Command Center.

## Related
[CAP-009](../05-capability-registry.md) (Resource Capacity), CAP-010 (Labor Capacity), CAP-005
(Living Graph). ADRs: [ADR-003](ADR-003-resource-capacity-intelligence.md),
[ADR-002](ADR-002-living-graph-primary-surface.md). Debt: DEBT-003.
