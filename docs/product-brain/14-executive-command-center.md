# 14 — Executive Command Center

Capability: CAP-015 · Pillars P2/P4. Status: **Partial (~40%)**.

## Intent
A single executive surface that answers "how is this project, really?" by consolidating the
independent dimensions (ADR-006) and the capacity picture (ADR-003) into one evidence-backed
view, with the Living Graph as the drill-down (ADR-002) and Isabella as the explainer (ADR-005).

## What it must show
- **Project Health** (Healthy/Watch/At Risk/Critical/Failed) with the findings driving it.
- **Execution snapshot** — counts by Execution Status across the project.
- **Risk** posture and top risks.
- **Critical Path** status and schedule forecast vs target.
- **Resource Capacity** headline (utilization, overload, at-risk milestones).
- **Recommended actions** (require human approval).
- **Drill-down** into the exact entities/nodes behind every number (evidence-first).

## Current implementation (audited)
- `lib/command-center/service.ts` + the Command Center tab (project dashboard/overview) exist.
- Health engine (`lib/execution/health.ts`) and capacity insight (`lib/capacity/insight.ts`)
  produce much of the needed data already.
- **Gap:** not yet consolidated into one executive surface; does not consume the Execution
  Status Engine (CAP-016); drill-down to Living Graph not wired as the standard pattern.

## Dependencies
CAP-016 (status engine), CAP-009 (capacity), CAP-017 (risk), CAP-023 (critical path), CAP-005
(graph drill-down), CAP-002 (Isabella).

## Next action
After the Execution Status Engine is wired, assemble the Command Center as a read model over the
engines (no new business logic), with Living Graph drill-down and Isabella explanations.
