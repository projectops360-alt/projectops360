# 13 — Resource Capacity Intelligence (Module — Strategy & Audit)

> **Module doc** following the [Module Documentation Template](module-documentation-template.md).
> Recovery + audit doc for the most-lost capability in the product's history
> ([REG-004](10-regression-log.md)). Ratified by
> [ADR-003](adrs/ADR-003-resource-capacity-intelligence.md) and
> [ADR-009](adrs/ADR-009-reconcile-capacity-engines.md).
>
> **Capability:** [CAP-009](05-capability-registry.md) · **Last reviewed:** 2026-06-27 (module audit pass).

---

## 1. Module Purpose
Answers the executive question: **"Do we have enough real workforce capacity to deliver this
project plan?"** — by modeling each resource's *real* available hours (after availability and
overhead) versus the work assigned to them, then rolling that up to milestones, roles, and the
whole project.

## 2. Product Role
Pillar **P3 — Resource & Capacity Intelligence**. The generic, project-type-agnostic capacity
engine of ProjectOps360°. Not "assign a person to a task" — it is *capacity intelligence*
([ADR-003](adrs/ADR-003-resource-capacity-intelligence.md), Product DNA).

## 3. Primary Users
PMO/Admin (portfolio capacity, bottlenecks, workforce health) · PM (their project's capacity) ·
Executives (workforce health + at-risk milestones) · Team members (their own workload, if
enabled) · Isabella (explains capacity from the numbers).

## 4. Core Workflows
Capture per-resource capacity (weekly hours, availability %, overhead %) in the capacity editor →
the engine computes effective capacity, utilization, overhead, remaining, overallocation,
bottlenecks, workforce health → surfaced on the **Resource Capacity** page, the **Living Graph
Workforce layer**, and (intended) the **Executive Command Center**.

## 5. Data Model
- **`project_resource_allocations`** (primary): `weekly_capacity_hours`, `availability_percent`,
  `overhead_percent`, `project_role`, `display_name`, `user_id`, `project_team_member_id`, `status`.
- Reads `project_team_members`, `profiles` (names/roles), `roadmap_tasks` (assigned + estimates),
  `milestones`, `task_dependencies`.
- Tables present for future depth (some unused today): `resource_profiles`,
  `resource_availability_exceptions`, `resource_workload_snapshots`, `workforce_health_scores`.
- Migration `20260812_resource_capacity` (applied in prod).

## 6. AI Capabilities (Isabella) — see §17
Deterministic engine produces all numbers; Isabella only **explains** them (why a resource is
overloaded, why a milestone is at risk, how overhead cut effective capacity, which tasks drive
pressure) and **recommends** PM actions. **She never invents** capacity, names, estimates,
availability, or overhead, and never reassigns/reschedules automatically.

## 7. Deterministic Logic — formulas (REAL, from `lib/capacity/formulas.ts`)
Percentages are 0–100. Same inputs → same outputs. No AI, no randomness.

```
nominal_capacity_hours   = weekly_capacity_hours
effective_capacity_hours = weekly * (availability%/100) * (1 - overhead%/100)
assigned_work_hours      = Σ estimated hours of assigned tasks in the period
remaining_capacity_hours = effective - assigned
utilization_percent      = assigned / effective * 100      (null if effective ≤ 0)
overallocated_hours      = max(0, assigned - effective)
capacity_gap_hours       = required - available_effective
workforce_availability%  = total_effective / total_nominal * 100   (null if nominal ≤ 0)
project_overhead_hours   = max(0, total_nominal - total_effective)
```
**Workforce Health Index** (`calculateWorkforceHealthIndex`): starts at 100, subtracts
*explainable* deductions — critical resource −10, overallocated −5, unassigned critical task −5,
missing estimate −3, milestone severe gap −10, missing critical role −5, overhead-over-threshold
−5, effective<70% nominal −5 — clamped 0–100. Band: ≥85 healthy · ≥70 watch · ≥50 at_risk · else
critical. Every deduction is returned so the UI shows *why*.

### Missing-data handling (never invent)
Utilization is `null` when effective ≤ 0. Per-task flags (`TaskCapacityFlag`): `incomplete_estimate`,
`unassigned`, else `ok`. Resource status `needs_review` whenever there is no capacity data. The UI
must show `needs_review` / `incomplete` / `not_enough_data` rather than a fabricated number.
Story-points → hours requires an explicit conversion ratio (not assumed).

## 8. Status Classification (REAL thresholds, `classifyCapacityStatus`)
| Utilization | Status |
|---|---|
| 0–69% | Available |
| 70–89% | Healthy |
| 90–100% | Near Capacity |
| 101–120% | Overallocated |
| >120% | Critical |
| no capacity data | Needs Review |
| no estimate | Incomplete Estimate (task flag) |
| no assignee | Unassigned (task flag) |
Thresholds are constants today; **make configurable later** (keep these as MVP defaults).

## 9. What it shows (intended completeness)
- **Project-level:** total nominal / effective / assigned / remaining / overallocated hours,
  workforce availability %, project overhead %, # overloaded & critical resources, # unassigned
  tasks, # missing estimates, # milestones at capacity risk. *(Most present today.)*
- **Resource-level:** name, role, (skills — pending), nominal weekly, availability %, overhead %,
  effective, assigned, remaining, utilization %, overallocated hours, status. *(Present.)*
- **Milestone-level:** required effort, assigned capacity, capacity gap, overloaded resources,
  missing roles, capacity risk level, schedule impact. *(Partial.)*
- **Role-level:** required vs available hours by role, gap by role, missing coverage, constrained
  skills. *(Missing/partial.)*

## 10. Connected Modules
[Living Graph](12-living-graph-strategy.md) (Workforce layer) · **Labor Capacity** (construction
profile — §13a) · [Executive Command Center](14-executive-command-center.md) ·
Tasks/Milestones/Dependencies · Resources/Team · [Project Memory](17-project-memory.md) (future) ·
[Isabella](16-isabella-ai-workforce.md).

## 13a. Relationship to Labor Capacity (`lib/labor/capacity.ts`)
**Labor Capacity is construction-specific and must be preserved.** It computes weekly labor gaps
by **trade / crew / headcount / shortage severity** from `construction_activities` +
`labor_resources` (mirrors SQL `compute_labor_capacity()`), and feeds the Living Graph via
`labor-graph-mapping.ts` (the `laborCapacity` overlay). **Resource Capacity Intelligence**
(`lib/capacity`) is the **generic** engine (hours/availability/overhead/utilization), feeding the
graph via `workforce-graph-mapping.ts` (the Workforce overlay). Today both coexist as **two
parallel capacity systems** — the reconciliation is governed by
[ADR-009](adrs/ADR-009-reconcile-capacity-engines.md): generic engine is canonical; Labor Capacity
becomes a construction view/profile over it; no duplicated capacity math.

## 11. Living Graph integration (Workforce Intelligence Layer)
> **Foundational requirement ([REG-007](10-regression-log.md)):** restoring/protecting the Living
> Graph workforce-load view ("who is overloaded, who is available, which activity causes it") is a
> baseline requirement of this module — it was lost and is now recovered (PR #23, live after the
> 2026-06-27 alias promotion). It must never be removed again. See
> [doc 12 §11a](12-living-graph-strategy.md).

Resource Capacity must drive — not decorate — the graph. It should surface: resource nodes, role
nodes, capacity-risk signals, assignment edges, overloaded-resource highlights, tasks/milestones
impacted by capacity, project workforce-health summary, overhead/availability signals, and
missing-estimate / unassigned-task warnings — always showing **how capacity affects execution,
risk, schedule, milestone health, and decisions** (not a pretty overlay). Anti-pattern guard from
[ADR-002](adrs/ADR-002-living-graph-primary-surface.md) applies.

## 12. Executive Command Center integration
Provides the workforce KPIs (health index, utilization, overload, at-risk milestones) and the
evidence (which resources/tasks) behind them for drill-down ([doc 14](14-executive-command-center.md)).

## 17. AI Behavior (Isabella) — [ADR-005](adrs/ADR-005-isabella-primary-ai-interface.md)
**MAY:** explain overload, milestone capacity risk, overhead's effect, workload-driving tasks;
recommend PM actions; summarize workforce health for PMO. **MUST NOT:** invent capacity numbers,
resource names, estimates, availability, or overhead; auto-reassign or reschedule; override the
deterministic engine. All explanations grounded in calculated data.

## 18. Permissions
- **PMO/Admin:** all resource capacity (org/portfolio), workforce health, bottlenecks, sensitive
  capacity data; update assumptions if authorized.
- **PM:** view/manage capacity for assigned projects; project bottlenecks.
- **Team member:** own workload only (if enabled); not org-level capacity; no edits to others'.
- **Viewer/Client:** **no access by default**; external-safe summaries only if explicitly shared.
- **Sensitivity:** workload/availability/overhead/cost-like assumptions must NOT reach
  client-facing roles by default. Enforce **server-side** ([Governance Rules](23-governance-rules.md)).
  *(Today the page gate uses org-context; full PMO/PM/Team RBAC parity is a gap — DEBT-002.)*

## 19. Current Implementation — ~45%
**Implemented:** engine (`lib/capacity/formulas|service|insight`, with tests), `/resource-capacity`
page (per-resource table, weekly capacity, capacity risks, PMO summary), capacity editor, Workforce
Health Index, Living Graph Workforce layer. Migration applied in prod.

## 20. Known Gaps (gap analysis) — classify each
1. Generic RCI page/view — **Implemented**.
2. Construction Labor Capacity preservation — **Implemented; should remain construction-specific**.
3. Generic vs construction engine — **Duplicated → reconcile (ADR-009)**.
4. Overhead calc — **Implemented**. 5. Availability calc — **Implemented**. 6. Effective capacity — **Implemented**.
7. Assigned workload from tasks — **Partial** (depends on estimates/assignees present).
8. Task estimate handling / story-point ratio — **Partial** (flags missing; no SP→hours ratio).
9. Workforce Health Index — **Implemented**.
10. Living Graph Workforce layer — **Partial** (overlay present; deeper signals/role nodes missing).
11. Command Center capacity KPIs — **Missing/Partial**.
12. Isabella capacity explanations — **Missing** (needs wiring to engine outputs).
13. Role-based capacity visibility — **Partial** (org-gate only; RBAC parity gap).
14. Missing-estimate / missing-assignee detection — **Implemented** (flags).
15. Multi-project allocation — **Missing**.
16. Project-type adaptation — **Partial** (labels adapt; engine is generic).
17. Forecast & burnout prediction — **Missing** ([ADR-003](adrs/ADR-003-resource-capacity-intelligence.md) vision).
18. What-if reassignment / workforce digital twin — **Missing**.

## 21. Risks / Anti-patterns (must never be broken)
- Never reduce RCI to "assign a person to a task." Never invent missing capacity values — flag
  them. Never expose capacity to client/viewer roles by default. Never duplicate capacity math
  (one engine — ADR-009). Never let Isabella override or fabricate engine outputs.

## 22. Future Roadmap (recommended sequence)
1. **ADR-009 reconciliation** (generic engine canonical; Labor as profile; one math).
2. **Wire Isabella** capacity explanations from engine outputs (gap #12).
3. **Command Center** capacity KPIs + drill-down (gap #11).
4. **Deeper Living Graph** Workforce signals + role nodes (gap #10).
5. **Forecast + burnout + over/under-allocation insights** (gaps #17).
6. **Multi-project allocation** + **what-if reassignment / digital twin** (gaps #15/#18).

## 14. Related ADRs
[ADR-003](adrs/ADR-003-resource-capacity-intelligence.md) (capacity vision) ·
[ADR-009](adrs/ADR-009-reconcile-capacity-engines.md) (reconcile engines) ·
[ADR-002](adrs/ADR-002-living-graph-primary-surface.md) (graph it feeds) ·
[ADR-005](adrs/ADR-005-isabella-primary-ai-interface.md) (AI).

## 15. Capability IDs
[CAP-009](05-capability-registry.md) (owner); relates to CAP-010 (Labor), CAP-011/012/013 (overhead/
availability/utilization), CAP-014 (burnout — missing), CAP-005 (graph), CAP-015 (command center).

## 16. Last Reviewed
2026-06-27 — module audit pass (documentation only; no runtime changes).
