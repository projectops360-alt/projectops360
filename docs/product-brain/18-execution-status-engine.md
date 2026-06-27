# 18 — Execution Status Engine

Capability: CAP-016 · Pillar P4 · Ratified by
[`ADR-006`](adrs/ADR-006-independent-status-dimensions.md). Status: **Prototype (~20%)**.

## Intent
One deterministic engine that resolves the **true operational state** of any item (project,
phase, deliverable, milestone, WBS node, task) across **four independent dimensions** that are
never mixed:

1. **Execution Status** — Draft · Ready · In Progress · Waiting · Waiting on Dependency ·
   Blocked · On Hold · Completed · Cancelled.
2. **Dependency Status** — No Dependencies · Waiting for Dependency · Dependencies Satisfied ·
   Critical Dependency · Circular Dependency.
3. **Project Health** — Healthy · Watch · At Risk · Critical · Failed (project-scoped aggregate).
4. **Risk Status** — None · Low · Medium · High · Critical.

## Non-negotiable rules
- **Blocked requires an explicit recorded impediment** (is_blocked flag, blocker_event,
  material/RFI/permit/etc.). **Never inferred from dependencies.**
- **Waiting on Dependency** requires unfinished predecessor(s).
- **Waiting** = simply not-yet-executable (its moment hasn't arrived / workflow hasn't reached
  it). This is NOT a problem.
- Every result carries a deterministic, **bilingual** explanation for Isabella.

## Current implementation (audited 2026-06-27)
- **Prototype only:** `src/lib/execution/status-engine.ts` exists in the working tree with the
  core deciders (`resolveExecutionStatus`, `resolveDependencyStatus`, `resolveRiskStatus`,
  `buildExecutionExplanation`, `resolveExecutionState`) and types.
- **Not committed, not wired, no tests, no consumers.** (DEBT-007.)
- Health is intentionally computed separately (project-scoped) — reuses `lib/execution/health.ts`
  mapped to the 5-level scale.
- Foundations already exist to feed it: `readiness.ts` distinguishes predecessor vs real
  impediments; `health.ts` is the health engine; `is_blocked`+`blocker_reason` is the explicit
  impediment record.

## Why it matters
It is the fix for REG-006 (Blocked vs Waiting confusion) and the single source of truth that
the Living Graph, dashboards, reports, timeline, critical path, navigator, health, Isabella,
executive reports, and notifications must all consume (ADR-006).

## Roadmap to Implemented
1. **Commit the prototype** as Prototype (resolve DEBT-007) with this doc.
2. **Tests:** deterministic unit tests, especially "never Blocked from dependencies" and
   "Waiting on Dependency when predecessors unfinished."
3. **Adapters:** task / milestone / Living-Graph-node adapters that build `ExecutionSignals`
   from real data (predecessors via edges, explicit blockers, cycle, critical path).
4. **Wire Living Graph:** semantic node indicators (⏳ 🔗 🚫 ⏸ ✅ ⚠️ ◆), retire the
   dependency-derived lock (REG-006 / F-LG-008).
5. **Wire Isabella:** feed the focused node's deterministic explanation (doc 16).
6. **Expand consumers:** dashboards, Command Center, reports, notifications.

> This engine is the backbone of Pillar P4 (Execution Truth). Do not duplicate status logic
> elsewhere (DEBT-006).
