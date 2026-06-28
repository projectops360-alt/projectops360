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

## Home for Status & reports (REG-015 / UX-009 — binding)
Command Center / Dashboard is the home for project health, **status**, executive summaries, recent
activity, traceability, reports, and key actions.
- **Project Status belongs inside Command Center.** The Overview dashboard surfaces a prominent
  **Project Status** card near the top — explained health (band), % complete, blockers vs waiting,
  overdue, at-risk milestones, capacity warnings, top recommended attention, and a "View full status"
  link to `/status`. It is computed by the **same deterministic engine as Isabella's briefing**
  (REG-013, `buildProjectBriefing`) so the numbers agree everywhere (REG-008/010) — no parallel
  metric logic.
- **Closeout Report belongs inside Command Center / Reports and must be easy to find** (UX-009):
  promoted to a "Reports & Executive Outputs" card near the top, not buried below activity cards.
- **Status and Closeout share the project rollup/status source** where applicable.
- Navigation simplification (UX-006) must never make Status disappear; if removed from a tab it must
  be relocated to Command Center with prominence. See [REG-015](10-regression-log.md#reg-015).

## Dependencies
CAP-016 (status engine), CAP-009 (capacity), CAP-017 (risk), CAP-023 (critical path), CAP-005
(graph drill-down), CAP-002 (Isabella).

## Next action
After the Execution Status Engine is wired, assemble the Command Center as a read model over the
engines (no new business logic), with Living Graph drill-down and Isabella explanations.
