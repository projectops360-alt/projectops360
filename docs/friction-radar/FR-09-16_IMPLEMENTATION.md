# Friction Radar v1 — FR-09 through FR-16

Implementation date: 2026-08-18

Project used for production validation:
`a40a7436-c63f-4e3b-94cd-041447ee54d4` (Aurora Retail).

Supabase mode: metadata and `SELECT` only. No migration, DDL, RPC, write,
deployment or production configuration change was performed.

## Frozen task contract

The task codes did not exist in GitHub issues or repository documentation, so
this block freezes them against the eight gaps explicitly left by FR-01–FR-08.

| Task | Contract | Acceptance result |
|---|---|---|
| FR-09 | Dependency friction: blocked-by-predecessor and downstream propagation, without equating an incomplete predecessor with a blocker | Implemented. An active explicit blocker is mandatory; `dependency_wait` stays insufficient until both lifecycle boundaries and lag share qualified time evidence. |
| FR-10 | Schedule friction: finish variance, overdue work, milestone lateness and critical-path exposure | Implemented from real baseline/current fields. Date-only targets use the whole calendar day. Critical membership alone is not friction. |
| FR-11 | Effort/cost friction: current entry overrun and qualified CPI/SPI/EAC/VAC signals | Implemented fail-closed. Missing actuals and `quality_status=insufficient_inputs` emit no performance signal. |
| FR-12 | Resource friction: assignee/effort concentration, key-person exposure and workload overload | Implemented. Concentration requires actual assignments or current entries; overload requires a capacity-bearing workload snapshot. |
| FR-13 | Risk friction: explicit open exposure and aging | Implemented. Task links are preserved, but linkage/adjacency never proves materialization. |
| FR-14 | Decision friction: explicit proposed/deferred aging and qualified pending approvals | Implemented. Missing decisions never become an invented approval wait. |
| FR-15 | Evidence contract, independent 0–100 scores, Top 20 and category aggregation proposal | Implemented. Incomplete signals are rejected before the read model. Top 20 is deterministic. Category/global scores remain `null`; the top-three confidence-weighted formula is exposed as `proposal_only`. |
| FR-16 | Production composition, Aurora validation and regression protection | Implemented in the authenticated RLS loader and validated with read-only production queries plus automated tests. |

## Detector contract

### Dependency

- `blocked_by_predecessor` requires a non-terminal task with an explicit current
  blocker and at least one recorded incomplete predecessor. Confidence is medium
  because the two facts support a candidate cause but do not establish causality.
- `dependency_propagation_risk` requires that same active blocker plus recorded
  successors. Fan-out alone is only topology.
- `dependency_wait` remains `INSUFFICIENT_EVIDENCE`: Aurora's lifecycle capture
  timestamps conflict with operational work dates, so subtracting predecessor
  completion from successor start would manufacture a duration.

### Schedule

- `overdue_task` means a canonical non-terminal task remains open after the end
  of its baseline finish day. It does **not** mean waiting to start.
- `planned_finish_variance` compares current finish with baseline finish; Aurora
  has no such variance in the audited snapshot.
- `milestone_lateness` applies the same rule to milestone baseline targets.
- `critical_path_exposure` requires critical membership plus an active blocker or
  overdue state. The 12 Aurora critical tasks finish in December and have neither,
  so none is emitted.

Duration-based scores use a diminishing logarithmic scale. This preserves the
ordering of old items without saturating every task older than a few weeks at
100. Task overdue uses a 35-point floor and 180-day horizon; milestone lateness a
40-point floor and 180-day horizon; plan variance a 25-point floor and 90-day
horizon.

### Effort, cost and resources

- Effort overrun requires current non-deleted time entries greater than 110% of
  the task planned-hour baseline.
- A zero count of cost actuals is absence, not zero cost performance.
- CPI/SPI require an `available` or `provisional` financial measurement. EAC/VAC
  requires a qualified cockpit with both current baseline and EAC.
- Assignee concentration requires one recorded assignee to own at least 40% of
  assigned active tasks and at least three tasks.
- Effort concentration requires at least 50% of current recorded project hours
  across three tasks, or across two tasks with at least 40 hours.
- Resource overload requires a workload snapshot above 100% utilization or with
  positive overallocated hours. Task counts never substitute for capacity.

### Risk and decision

- Each `open` or `mitigating` risk is a separate `open_risk_exposure` signal.
  Score starts from the recorded severity and increases only with transparent
  aging. `risk_materialization` remains insufficient without explicit evidence.
- A decision wait requires an explicit `proposed` record older than seven days
  or a `deferred` record. Qualified financial pending approvals are accepted as
  their own signal, never as a generic approval inference.

## Evidence and scoring

Every promoted signal now carries the complete contract:

`signalId`, organization/project/task/milestone identity, category, signal type,
independent `score`, observed value, expected/baseline, severity, confidence,
evidence status, evidence references, start/end timestamps, description and
source engine.

Explicit `null` is valid when the source has no qualified timestamp or baseline;
an omitted field or an empty reference list is rejected. The production loader
reports the rejected count and limitation instead of silently rendering the
signal.

Independent scores rank evidence; confidence remains a separate reliability
dimension. The category proposal takes at most the three highest independent
signals and computes a confidence-weighted mean (`high=1`, `medium=.8`,
`low=.6`, `unknown=.4`). It is not consumed by the read model. Category and
global scores remain `null` until manual validation approves an aggregation
policy.

## Aurora production result at 2026-08-18

| Detector | Actual result | Evidence status |
|---|---:|---|
| Active overdue tasks | 115: 113 `not_started`, 2 `in_progress` | confirmed current snapshot + task baseline |
| Late milestones | 2: 96 and 95 days | confirmed current snapshot + milestone target |
| Active blocked tasks | 0 | no dependency blocker/propagation signal |
| Planned-finish variance | 0 | no signal |
| Effort overruns | 0 | no signal; 43 current entries remain evidence |
| Effort concentration | 61.45% / 204h in one user across two tasks | candidate signal, high confidence from 27 entry ids |
| Assignee concentration | max 25.12% of 215 assigned active tasks | below 40%; no signal |
| Workload/capacity overload | 0 snapshots | `INSUFFICIENT_EVIDENCE`, not zero overload |
| Open risks | 10: 6 critical, 4 high; all unlinked | 10 confirmed project-level risk rows |
| Decisions | 0 | `INSUFFICIENT_EVIDENCE`; no approval wait invented |
| Cost actuals / measurements | 0 / 0 | `INSUFFICIENT_EVIDENCE` |
| Financial cockpit | `insufficient_inputs`; CPI/SPI/EAC/baseline null | no financial performance signal |
| Critical path | 12 tasks, all due in December and unblocked | no critical exposure signal |

The large schedule count is not a renamed waiting count. It says only that the
current non-terminal snapshot is beyond the committed finish. Tasks with
`implemented`, `tested`, `done` or `deferred` status use the canonical terminal
semantics and are excluded from active overdue/blocker analysis.

## Top 20 Aurora task-level signals

This is the deterministic task-level snapshot reproduced from production with
the exact v1 rules. Evidence for an overdue signal is its `roadmap_tasks` row;
event-based signals list the canonical event ids.

| Rank | Score | Category | Signal | Entity | Evidence |
|---:|---:|---|---|---|---|
| 1 | 100 | Process | queue friction | `997c8d29-04de-4add-9620-764f6e71246a` | `4cffa807-36fa-4d8c-971e-c08b48e3d40d`; baseline start 2026-03-13 |
| 2 | 100 | Quality | completed then reopened | `b0ca5ded-efdc-455d-abf7-671eb3fd8670` | `5c172027-1ca5-429b-b752-637cdee317e7` → `44909854-4a9a-44a3-b23a-45668abbcb91` |
| 3 | 100 | Process | process interruption | `b0ca5ded-efdc-455d-abf7-671eb3fd8670` | same ordered pair; `done → blocked` |
| 4 | 100 | Resource | resource interruption | `b0ca5ded-efdc-455d-abf7-671eb3fd8670` | same pair + `roadmap_tasks.blocker_reason`; sensitive text not copied |
| 5 | 99 | Schedule | overdue task, 161d | `66fb0611-8e71-446b-90bc-7c9a1585fdd1` | task baseline finish 2026-03-10 + current `not_started` |
| 6 | 98 | Schedule | overdue task, 151d | `1555f874-11e2-4e8b-b8b9-a1915529341f` | task row; baseline finish 2026-03-20 |
| 7 | 98 | Schedule | overdue task, 148d | `2078a22c-88f1-4f60-9a29-d36cce069da9` | task row; baseline finish 2026-03-23 |
| 8 | 98 | Schedule | overdue task, 148d | `46394c48-887f-45cc-9cf6-ae53b7578caf` | task row; baseline finish 2026-03-23 |
| 9 | 98 | Schedule | overdue task, 151d | `6da1a944-3c60-4834-9889-cfa10c513a47` | task row; baseline finish 2026-03-20 |
| 10 | 98 | Schedule | overdue task, 148d | `997c8d29-04de-4add-9620-764f6e71246a` | task row; baseline finish 2026-03-23 + current `in_progress` |
| 11 | 98 | Schedule | overdue task, 148d | `a0746d6e-e515-4874-826a-dcdf4f4da296` | task row; baseline finish 2026-03-23 |
| 12 | 97 | Schedule | overdue task, 140d | `09337188-2ec7-40ff-887a-25b40348bcb0` | task row; baseline finish 2026-03-31 |
| 13 | 97 | Schedule | overdue task, 145d | `1ba57887-49e5-4503-8e59-14e350b27bf7` | task row; baseline finish 2026-03-26 |
| 14 | 97 | Schedule | overdue task, 137d | `2a0174ec-162b-437d-9d51-29d34c3c21a3` | task row; baseline finish 2026-04-03 |
| 15 | 97 | Schedule | overdue task, 137d | `2a8d27d4-af28-40fb-bc8a-157a660595b3` | task row; baseline finish 2026-04-03 |
| 16 | 97 | Schedule | overdue task, 145d | `32a87dd9-a445-4198-964f-78de8f331530` | task row; baseline finish 2026-03-26 |
| 17 | 97 | Schedule | overdue task, 145d | `359f546e-4397-45eb-a460-3216d91177cf` | task row; baseline finish 2026-03-26 |
| 18 | 97 | Schedule | overdue task, 147d | `6150394e-d6a5-49b5-8c3b-bf292fe64511` | task row; baseline finish 2026-03-24 |
| 19 | 97 | Schedule | overdue task, 147d | `67e89aa9-955c-40c4-a457-50798de075a2` | task row; baseline finish 2026-03-24 |
| 20 | 97 | Schedule | overdue task, 140d | `6a327843-96e1-4022-8514-43ef76b2f2f6` | task row; baseline finish 2026-03-31 |

The raw Top 20 is schedule-heavy because 115 task rows are genuinely beyond
their baselines. Category filters and a later aggregation policy should make the
UI explorable; the engine must not hide schedule evidence merely to manufacture
visual category balance.

## False positives explicitly prevented

1. An incomplete predecessor without an active blocker is not dependency
   friction and is not called blocked.
2. A terminal task with a stale blocker flag is never an active blocker.
3. Critical-path membership alone is exposure topology, not friction.
4. A planned date is late only after its full date-only calendar day.
5. Missing time/cost/capacity rows never become zero effort, zero cost or zero
   utilization.
6. Risk linkage and event adjacency never become materialization or causality.
7. Missing decisions/events never become approval wait.
8. Signals without a source reference or complete evidence fields are rejected
   before ranking.

## Remaining gaps

- Qualified dependency-wait duration.
- Workflow-specific expected states for skipped-state detection.
- Resource overload for Aurora (capacity denominator absent).
- Actual cost, CPI, SPI, EAC and VAC for Aurora.
- Risk materialization evidence and task/milestone risk links.
- Decision/approval lifecycle rows.
- A validated category/global aggregation policy.
- User interface, navigation, authorization UX and end-to-end browser tests;
  those belong to the next implementation blocks, not this engine block.
