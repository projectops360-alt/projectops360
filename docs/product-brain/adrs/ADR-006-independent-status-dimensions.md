# ADR-006 — Execution, Dependency, Health and Risk are independent dimensions

**Status:** Accepted · 2026-06-27

## Context
The product conflated multiple execution scenarios into a single "Blocked" state, misleading
project managers (e.g. an item merely waiting for predecessors was shown as Blocked). See
REG-006.

## Decision
Four **independent** status dimensions are computed by the Execution Status Engine and must
never be mixed:

1. **Execution Status** — what the item is doing now: Draft, Ready, In Progress, Waiting,
   Waiting on Dependency, Blocked, On Hold, Completed, Cancelled.
2. **Dependency Status** — No Dependencies, Waiting for Dependency, Dependencies Satisfied,
   Critical Dependency, Circular Dependency.
3. **Project Health** — Healthy, Watch, At Risk, Critical, Failed.
4. **Risk Status** — None, Low, Medium, High, Critical.

**Hard rules:** Blocked REQUIRES an explicit recorded impediment and is NEVER inferred from
dependencies. Waiting on Dependency REQUIRES unfinished predecessor(s). Waiting means simply
not-yet-executable and is NOT a problem.

## Consequences
- One engine (`lib/execution/status-engine.ts`) is the single source of truth, reused by the
  Living Graph, dashboards, reports, timeline, critical path, navigator, health, Isabella,
  executive reports, and notifications.
- Every state must carry a deterministic, bilingual explanation Isabella can narrate.

## What this prevents
- The Blocked-vs-Waiting confusion (REG-006); status logic duplicated and drifting per surface.

## Related capabilities
CAP-016 Execution Status Engine, CAP-005 Living Graph, CAP-017 Risk, CAP-022 Dependencies.

## Related modules
`lib/execution` (status-engine, health, readiness, critical-path), `lib/graph`.
