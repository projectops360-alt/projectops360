# 04 — Module Map

Audited from the repo on 2026-06-27 (`git ls-files`, route tree, prod table list). This is
*what exists*, not what is fully working — see the registries for status.

## Project routes (tabs) — `src/app/[locale]/(app)/projects/[projectId]/`

| Route | Surface | Owner lib |
|-------|---------|-----------|
| `/` (Command Center) | Project dashboard/overview | `lib/command-center` |
| `/charter` (+ `/print`, `/summary`) | Project Charter & Governance | `lib/charter` |
| `/delivery` | Adaptive Delivery Framework | `lib/delivery` |
| `/team` | Project Team & Roles (RACI) | `lib/team`, `lib/team-roles` |
| `/workboard` | Kanban execution board | `lib/roadmap` |
| `/roadmap` | Timeline/Board/Tasks/Gantt views | `lib/roadmap` |
| `/execution-map` | Execution map (tabs: overview/timeline/tasks/gantt/critical-path/deps) | `lib/execution` |
| `/execution-map/living-graph` | **Living Graph** (digital twin surface) | `lib/graph` |
| `/labor-capacity` (+ `/workface`, `/lookahead`) | Labor Capacity (construction) | `lib/labor` |
| `/resource-capacity` | **Resource Capacity Intelligence** | `lib/capacity` |
| `/drawing-intelligence` | Drawing/BIM intelligence | `lib/drawing-intelligence` |
| `/memory` | Project Memory + Scribe | `lib/memory` |
| `/rhythm` | Rhythm Center (calendar + meetings) — **canonical meeting module** | `lib/rhythm` |
| `/rythm` (+ `/[meetingId]`) | **Redirect → `/rhythm`** (REG-011 alias; was Rythm Meeting Intelligence) | `lib/rythm` (dormant) |
| `/meetings` (+ `/[meetingId]`) | Meetings | `lib/rhythm` |
| `/status` | Status Report | `lib/execution/status-report` |
| `/closeout` | Project Closeout Report | `lib/rhythm/closeout` |
| `/budget` | Budget / cost | `lib/execution` (budget items) |
| `/decisions` (+ `/[id]`) | Decision log | — |
| `/communications` | Communication log | — |
| `/documents` (+ `/[id]`) | Document repository | — |
| `/stakeholders` | Stakeholders | — |
| `/audit` | Audit trail | `lib/audit` |
| `/search` | Project search | — |
| `/settings` | Project settings | — |

## Org / app routes

`/` (projects list), `/reports`, `/settings`, `/team`, `/import` (Project Import Intelligence),
`/ai-operator`, `/organization/{billing,plans,members,teams,external-contacts}`,
`/landing` (public marketing), `/navigator-preview`, auth routes.

## `src/lib` modules (engines & services)

`ai`, `audit`, `auth`, `billing`, `capacity`, `charter`, `command-center`, `delivery`,
`drawing-intelligence`, `embeddings`, `execution`, `graph`, `import-intelligence`,
`knowledge-os`, `labor`, `memory`, `reports`, `rhythm`, `rythm`, `roadmap`, `sync`,
`team`, `team-roles`, plus `theme.ts`, `utils.ts`, `env.ts`.

### `src/lib/execution` (the execution engines)
`critical-path.ts`, `critical-path-service.ts`, `health.ts`, `readiness.ts`,
`status-report.ts`, `templates.ts`, `template-service.ts`, `material-extraction.ts`,
`modules.ts`, `constants.ts`, `index.ts`. **(`status-engine.ts` exists in working tree as a
Prototype — see doc 18.)**

## `src/components` groups

`ai`, `auth`, `communications`, `decisions`, `documents`, `drawing-intelligence`, `graph`
(Living Graph), `isabella`, `labor`, `landing`, `layout`, `links`, `living-guide`,
`meetings`, `memory`, `navigator`, `phase0`, `projects`, `roadmap`, `rythm`, `settings`,
`shared`, `stakeholders`.

## Data model (Supabase, ~110 tables — selected areas)

- **Core/tenancy:** organizations, profiles, organization_members, projects, stakeholders.
- **Execution:** milestones, roadmap_tasks, task_dependencies, budget_items, cost_actuals,
  material_requirements, risks, rfis, submittals, inspections, permits, resources,
  resource_assignments, critical_path_snapshots.
- **Process Intelligence (Living Graph):** process_nodes, process_edges, process_snapshots.
- **Labor/Capacity:** trade_taxonomy, labor_resources, construction_activities,
  activity_dependencies, labor_weekly_capacity, **project_resource_allocations**,
  resource_profiles, resource_availability_exceptions, resource_workload_snapshots,
  workforce_health_scores.
- **Knowledge/Memory:** knowledge_packages/versions/localizations/chunks/answers,
  guide_events, project_memory_items, project_scribe_items.
- **Drawings:** drawing_files/pages/extractions/insights/versions/processing_jobs/evidence.
- **Governance/Delivery:** project_charters (+roles/versions/signoffs),
  project_governance_rules, project_approval_matrix, project_delivery_frameworks,
  project_backlog_items, project_execution_cycles, project_board_columns,
  project_framework_*, refinement_sessions, work_item_*.
- **Team/Billing:** project_team_members, project_raci_assignments, stakeholder_access,
  organization_teams(+members), external_contacts, plans, plan_entitlements, subscriptions.
- **Rythm:** project_rythm_audio_files/transcripts/processing_jobs/activity_log/
  speaker_mappings/intelligence.
- **Import & Reports:** project_import_* (jobs/raw/mappings/entities/validation/audit/created),
  saved_reports, report_runs/exports/schedules, cost_library_items.
