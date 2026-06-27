# 07 — ADR Index

Architecture Decision Records. One file per decision in [`adrs/`](adrs/). An ADR is required
for any major architectural decision and for any change that would contradict an accepted ADR.

| ADR | Title | Status | Pillars |
|-----|-------|--------|---------|
| [ADR-000](adrs/ADR-000-product-intelligence-source-of-truth.md) | **Product Intelligence™ is the Official Source of Truth** (constitutional) | Accepted | All |
| [ADR-001](adrs/ADR-001-ai-first-execution-os.md) | AI-first Project Execution Operating System | Accepted | P1 |
| [ADR-002](adrs/ADR-002-living-graph-primary-surface.md) | Living Graph is a primary intelligence & navigation surface | Accepted | P2 |
| [ADR-003](adrs/ADR-003-resource-capacity-intelligence.md) | Resource Capacity = labor + overhead + utilization + availability + forecast | Accepted | P3 |
| [ADR-004](adrs/ADR-004-knowledge-os-substrate.md) | Knowledge OS is the product knowledge substrate | Accepted | P1/P5 |
| [ADR-005](adrs/ADR-005-isabella-primary-ai-interface.md) | Isabella is the primary AI Workforce interface | Accepted | P1 |
| [ADR-006](adrs/ADR-006-independent-status-dimensions.md) | Execution/Dependency/Health/Risk are independent dimensions | Accepted | P4 |
| [ADR-007](adrs/ADR-007-product-brain-is-source-of-truth.md) | Product Brain is the source of truth for product evolution | Accepted | All |
| [ADR-009](adrs/ADR-009-reconcile-capacity-engines.md) | Reconcile Resource Capacity (generic) & Labor Capacity (construction) engines | Accepted | P3 |

## Proposed / future ADRs (not yet written)
- ADR-008 — RBAC model on `master` (reconcile `feat/rythm` RBAC vs permissive org-context).
- ADR-010 — `rhythm` vs `rythm` consolidation (meetings).
- ADR-011 — Issue Management as a distinct entity from Risk Management.

## How to add an ADR
1. Copy an existing ADR file; number it sequentially.
2. Fill: Status, Context, Decision, Consequences, What this prevents, Related capabilities,
   Related modules.
3. Add a row here. Update affected registry entries.
