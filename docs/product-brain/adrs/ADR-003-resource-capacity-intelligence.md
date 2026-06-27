# ADR-003 — Resource Capacity Intelligence includes labor, overhead, utilization, availability and forecast

**Status:** Accepted · 2026-06-27

## Context
Resource/capacity thinking has been the single most-lost concept in the product's history
(it disappeared from `master` entirely until restored on 2026-06-27). It is frequently
reduced to "assign a person to a task."

## Decision
Resource Capacity Intelligence is a first-class capability that models the **real workforce**:
nominal vs effective vs available vs remaining capacity, **utilization**, **overhead**
(admin, meetings, documentation, support, training, travel, internal work), workforce
availability, billable vs non-billable, bench/idle, over/under-allocation, **burnout
prediction**, **capacity forecast**, **resource health**, and a **workforce digital twin**
with what-if reassignment whose impact propagates to schedule, budget, critical path, the
Living Graph, and Isabella.

## Consequences
- The capacity engine (`lib/capacity`) is canonical; new capacity features extend it, not
  fork it. (Note: `lib/labor/capacity.ts` is the construction-specific labor engine — both
  coexist; see doc 13 for reconciliation.)
- Capacity data must be consumable by the Living Graph and the Execution Status Engine.

## What this prevents
- Re-losing the capacity vision (REG-004).
- Shipping a decorative capacity page with no forecast/burnout/simulation.

## Related capabilities
CAP-009..014 (Resource Capacity, Labor, Overhead, Availability, Utilization, Burnout).

## Related modules
`lib/capacity`, `lib/labor`, `lib/graph` (workforce layer), `project_resource_allocations`.
