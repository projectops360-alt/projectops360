# Friction Radar v1 — Production schema audit

Audit date: 2026-08-18

Supabase project: `ocopmlnkvidvmxgiwvxw`

Validation project: `a40a7436-c63f-4e3b-94cd-041447ee54d4`

Mode: metadata and `SELECT` only. No RPC, migration, DDL or data mutation.

## Friction-relevant schema

| Table | Column | Type | Use for friction | Quality / availability | Notes |
|---|---|---:|---|---|---|
| `projects` | `id`, `organization_id` | uuid | tenant/project scope | available | Both predicates are mandatory on every runtime query. |
| `projects` | `title_i18n`, `status` | jsonb, text | display/current state | available | Aurora status is `planning`. |
| `projects` | `start_date`, `target_end_date` | date | project schedule context | available | Not substituted for task baselines. |
| `projects` | `baseline_captured_at`, `baseline_source` | timestamptz, text | baseline provenance | available | Present in production project schema. |
| `milestones` | `id`, `project_id`, `organization_id` | uuid | milestone scope | available: 16 | Soft-deleted rows excluded. |
| `milestones` | `start_date`, `target_date`, `completed_date` | date | milestone schedule | available | Current dates. |
| `milestones` | `baseline_start_date`, `baseline_target_date` | date | committed milestone schedule | available | Prefer over current dates when populated. |
| `milestones` | `status`, `progress_percent`, `order_index` | text, integer | state/sequence | available | `order_index` is business order. |
| `roadmap_tasks` | `id`, `project_id`, `organization_id`, `milestone_id` | uuid | task identity/scope | available: 274 | Canonical task owner. |
| `roadmap_tasks` | `title`, `status`, `progress` | text, text, integer | current state | complete | Snapshot may disagree with latest event; disagreement is reported separately. |
| `roadmap_tasks` | `start_date`, `end_date`, `duration_days` | date, date, integer | current schedule | 274/274 dates | Not treated as observed lifecycle time. |
| `roadmap_tasks` | `baseline_start_date`, `baseline_end_date`, `baseline_estimate_hours` | date, date, numeric | planned baseline | 274/274 populated | Primary task baseline. |
| `roadmap_tasks` | `estimate_hours`, `estimated_labor_hours`, `actual_hours` | numeric | effort context | estimate available | Actual effort is not summed from `actual_hours`. |
| `roadmap_tasks` | `is_blocked`, `blocker_reason` | boolean, text | explicit interruption | 1 blocked | Reason is evidence only when explicitly populated. |
| `roadmap_tasks` | `assigned_to`, `assigned_resource_id` | uuid | person/resource context | `assigned_to` 0/274; resource 274/274 | Resource id is usable; person assignment is unavailable. |
| `roadmap_tasks` | `is_critical`, `slack_days` | boolean, numeric | critical-path exposure | 12 current critical | Corroborate with snapshot. |
| `task_subtasks` | `id`, `task_id`, `status`, `progress` | uuid, uuid, text, integer | child work evidence | available: 4 | Subtask events resolve to verified parent task. |
| `task_subtasks` | `owner_id`, `start_date`, `due_date`, `completed_at` | uuid, date, date, timestamptz | resource/schedule context | sparse | Never replaces task baseline. |
| `task_subtasks` | `estimated_hours`, `actual_hours` | numeric | effort context | available but derived cache | Actual source remains time entries. |
| `task_dependencies` | `predecessor_id`, `successor_id` | uuid | fan-in/fan-out/propagation | available: 155 | All endpoints validated against loaded project tasks. |
| `task_dependencies` | `dependency_type`, `lag_days` | text, integer | dependency semantics | 155 finish-to-start; all lag 0 | No inferred dependency type. |
| `project_event_log` | `event_id`, `sequence_number`, `case_id` | uuid, bigint, uuid | event identity/order/case | available: 869 | Sequence is authoritative order. |
| `project_event_log` | `event_type`, `event_category` | text | event taxonomy | 19 observed types | See `EVENT_TAXONOMY.md`. |
| `project_event_log` | `occurred_at`, `recorded_at` | timestamptz | business/recording time | populated | Imported/backfilled occurrence time is not duration-qualified. |
| `project_event_log` | `subject_type`, `subject_id` | text, uuid | focal entity | populated | Subtasks require verified payload/object relation to parent task. |
| `project_event_log` | `from_state`, `to_state` | text | explicit transitions | partial by event type | Used for backward transition and interruption only when explicit. |
| `project_event_log` | `source_module`, `source_entity_type`, `source_entity_id` | text, text, uuid | provenance/entity resolution | available | Cross-checked against known task ids. |
| `project_event_log` | `provenance`, `confidence` | jsonb, numeric | capture/data quality | confidence null on all Aurora events | Capture method remains available for many event types. |
| `project_event_log` | `caused_by`, `is_compensating_event`, `compensates_event_id` | uuid[], boolean, uuid | explicit cause/compensation | available | Temporal proximity never becomes causality. |
| `project_event_objects` | `event_id`, `object_type`, `object_id`, `role` | uuid, text, uuid, text | OCEL object relations | 3,141 refs; 795/869 events covered | 930 task refs and 641 milestone refs. |
| `subtask_time_entries` | `id`, `task_id`, `subtask_id`, `user_id` | uuid | effort/resource evidence | available: 43 | Current non-deleted rows only. |
| `subtask_time_entries` | `work_date`, `duration_hours` | date, numeric | observed work date/hours | 332 total hours | Authoritative over historical `TimeLogged` payloads. |
| `subtask_time_entries` | `crew_size`, `hours_per_person` | integer, numeric | labor effort | available | `duration_hours` is already total man-hours. |
| `risks` | `id`, `status`, `severity`, `probability`, `impact` | uuid, text | formal risk signals | 10 rows, all open | 6 critical and 4 high. |
| `risks` | `linked_task_id`, `linked_milestone_id` | uuid | task/milestone attribution | 0 linked | Project-level risk only; task causality unavailable. |
| `risks` | `confidence_score`, `evidence_json`, `needs_review` | numeric, jsonb, boolean | evidence quality | usable | No row needs review. |
| `decisions` | `id`, `status`, `decision_date` | uuid, text, timestamptz | decision friction | empty for Aurora | Decision waiting is `INSUFFICIENT_EVIDENCE`. |
| `decision_intelligence_reviews` | `decision_id`, `from_status`, `to_status`, `created_at`, `evidence_refs` | uuid, text, timestamptz, array | explicit review transitions | empty for Aurora | No approval/review wait can be demonstrated. |
| `resources` | `id`, `name`, `status` | uuid, text, text | assigned resource identity | 16/16 ids resolved | All referenced resources resolve. |
| `resources` | `capacity_per_day`, `availability` | numeric, jsonb | overload/capacity | 0/16 populated | Work overload cannot be calculated. |
| `resource_assignments` | `task_id`, `resource_id`, `allocation_pct`, `planned_hours`, `actual_hours` | uuid, uuid, numeric | multi-resource load | empty for Aurora | Key-person/load metrics remain insufficient. |
| `project_team_members` | `id`, `user_id`, `display_name`, `project_role`, `allocation_percentage` | uuid, uuid, text, text, integer | team context | 19 active | Not a task assignment by itself. |
| `project_resource_allocations` | `allocation_percent`, `weekly_capacity_hours`, `availability_percent` | numeric | capacity | empty for Aurora | Overload unavailable. |
| `resource_profiles` | `user_id`, `default_weekly_capacity_hours`, `default_availability_percent` | uuid, numeric | canonical person capacity | 0 profiles for 19 project users | No fallback capacity exists for Aurora. |
| `resource_workload_snapshots` | `period_start`, `period_end`, `effective_capacity_hours`, `assigned_work_hours`, `utilization_percent`, `overallocated_hours` | date, numeric | overload evidence | empty for Aurora | Absence is not zero utilization. |
| `resource_availability_exceptions` | `resource_profile_id`, `start_date`, `end_date`, `hours_unavailable`, `reason` | uuid, date, numeric, text | resource interruption | empty for Aurora | The task blocker remains the only explicit Aurora interruption evidence. |
| `organization_members` | `user_id`, `status`, `availability_status`, `skills`, `reports_to_user_id` | uuid, text, array, uuid | membership/resource context | 19 project users resolve; 0 availability statuses | Loader restricts this organization-wide table to exact project user ids. |
| `project_governance_assignments` | `governance_unit_id`, `relationship_type`, `effective_from`, `effective_to`, `status` | uuid, text, date | governance/decision context | 1 Aurora row | Project context only; not approval-wait evidence. |
| `project_raci_assignments` | `entity_type`, `entity_id`, `project_team_member_id`, `raci_role` | text, uuid | responsibility/key-person context | empty for Aurora | No RACI-based concentration signal. |
| `budget_items` | `id`, `milestone_id`, `estimated_cost`, `committed_cost`, `actual_cost`, `forecast_cost` | uuid, uuid, numeric | cost baseline/current | 7 rows | USD 1,744,600 estimated; committed/actual currently zero. |
| `cost_actuals` | `task_id`, `amount`, `cost_date`, `source` | uuid, numeric, date, text | actual task cost | empty for Aurora | CPI/cost overrun not inferred from zero rows. |
| `financial_measurement_snapshots` | `bac`, `pv`, `ev`, `ac`, `cv`, `sv`, `cpi`, `spi` | numeric | EVM | empty for Aurora | CPI/SPI/EAC/VAC unavailable. |
| `financial_project_cockpit` | `original_budget`, `current_baseline`, `actual_cost`, `latest_eac`, `cpi`, `spi`, `quality_status`, `data_date` | numeric, text, date | authoritative financial availability/read model | 1 derived row | `quality_status=insufficient_inputs`; baseline/EAC/CPI/SPI/data date null. Zero actual cost is not treated as cost performance. |
| `financial_baseline_versions`, `financial_baseline_lines` | `status`, `total_amount`, `amount`, `time_phased_amounts` | text, numeric, jsonb | approved cost baseline | empty for Aurora | `budget_items` are not relabelled as an approved financial baseline. |
| `financial_estimate_versions`, `financial_boe_versions` | `status`, `total_amount`, `quality_status`, `evidence_refs` | text, numeric, jsonb | estimate/BOE quality | empty for Aurora | No estimate-version evidence. |
| `financial_forecast_scenarios` | `etc`, `eac`, `vac`, `confidence`, `unavailable_reason` | numeric, text | forecast/cost friction | empty for Aurora | No EAC/VAC signal. |
| `financial_changes`, `financial_change_impacts` | `status`, `gross_impact`, `net_impact`, `schedule_days` | text, numeric, integer | change-driven cost/schedule friction | empty for Aurora | No inferred change impact. |
| `financial_accruals`, `financial_payments`, `financial_reconciliations` | `status`, amount fields, evidence/source refs | text, numeric, jsonb | actual/commitment/reconciliation friction | empty for Aurora | No actual-cost or reconciliation evidence. |
| `critical_path_snapshots` | `computed_at`, `critical_task_ids`, `project_duration_days` | timestamptz, jsonb, integer | path exposure | 1 snapshot | Latest snapshot contains 12 critical tasks. |
| `issues` | — | — | issue friction | table not present | Must stay `INSUFFICIENT_EVIDENCE`; risks are not relabeled as issues. |

## Production availability summary

- Strong: task identity, planned dates/hours, dependencies, canonical events, current time entries.
- Usable with limitations: assigned resource identity, risks, budget baseline, critical path.
- Insufficient: resource capacity/workload, task-level risk links, decisions, issues, approved financial baseline, cost actuals, forecasts and EVM. The financial cockpit explicitly reports `insufficient_inputs`.
- Data-quality conflict: direct lifecycle events were recorded in August while many current work dates are in the planned January–March window. Event order remains evidence; elapsed duration across conflicting clocks does not.
