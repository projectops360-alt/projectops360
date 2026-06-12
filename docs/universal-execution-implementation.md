# Universal Execution Model — Implementation Summary

Date: 2026-06-12. Companion to `universal-execution-audit.md` (Step 1 audit).

## 1. Executive summary

ProjectOps360° now has one universal execution model shared by every project
type (software, data center, residential, commercial, infrastructure,
industrial, general). Project type configures the experience — templates,
terminology, visible modules — without splitting the architecture. The pass
added: `project_type` + module system, universal resources, materials +
procurement + suppliers, budget + cost actuals, risks/RFIs/submittals/
inspections/permits as first-class tables, task assignment, a real CPM engine
with external-blocker constraints and snapshots, a universal task readiness
score, a Project Health Engine, three full project templates, and the Drawing
Intelligence → material requirements bridge. All migrations are additive;
nothing existing was broken (full test suite + typecheck + build pass).

## 2. Database migration

`supabase/migrations/20260708000000_universal_execution_model.sql` (additive only):

**New tables (13)**: `suppliers`, `resources`, `budget_items`, `cost_actuals`,
`material_requirements`, `procurement_items`, `risks`, `rfis`, `submittals`,
`inspections`, `permits`, `resource_assignments`, `critical_path_snapshots`.
All follow house conventions (uuid PK, org FK, soft delete, `set_updated_at`,
member RLS + service-role policies, partial indexes).

**Modified tables**:
- `projects`: + `project_type` (CHECK, default `general`), + `enabled_modules` (jsonb, NULL = type defaults).
- `roadmap_tasks`: + `assigned_to`, `assigned_resource_id`, `assignment_type`,
  `required_skills`, `required_crew_size`, `estimated_labor_hours`,
  `location_zone`, `discipline`, `trade_key`, `cost_code`, `budget_item_id`,
  `source_drawing_id`, `source_insight_id`.
- Living Graph CHECKs extended: node types (`material_event`, `risk_event`,
  `rfi_event`, …), source types (`material_requirements`, `risks`, `rfis`, …),
  edge types (`requires_material`, `assigned_to`, `impacts_cost`,
  `creates_risk`, `mitigates_risk`, `supplied_by`, …).

**Backfill**: every active `labor_resources` row is projected into universal
`resources` (crew/person/vendor) with `legacy_labor_resource_id` provenance.
Idempotent; the labor lab keeps working untouched.

**⚠️ Not yet applied** — apply after the pending Drawing Intelligence
migrations (20260705–20260707), which it depends on (`drawing_files` FKs).

## 3. Domain layer (`src/lib/execution/`)

| File | Purpose |
|---|---|
| `constants.ts` | Project types + labels, universal status set, TaskStatus/MaterialStatus/Milestone → UniversalStatus mappings, RFI/submittal/material gate sets |
| `modules.ts` | `DEFAULT_MODULES` per project type, `getEnabledModules()` / `isModuleEnabled()` — type configures visibility, never architecture |
| `critical-path.ts` | Pure CPM engine: Kahn topological order + cycle isolation, forward/backward pass, all 4 dependency types with lag, SNET from planned dates, external `ScheduleConstraint`s (material delivery, RFI, submittal), total float, critical + near-critical flags, `getDownstreamTaskIds()` |
| `critical-path-service.ts` | Loads tasks/deps/materials/RFIs/submittals, builds constraints, runs the engine, writes CPM fields back to `roadmap_tasks`, records a `critical_path_snapshots` row with trigger reason |
| `readiness.ts` | Universal task readiness: predecessors, ownership, resource availability, materials, RFIs, submittals, inspections, permits → score 0..1 + bilingual blockers + recommended actions (matches the Step 22 output shape) |
| `health.ts` | Project Health Engine: schedule/budget/resources/materials/risks/dependencies/critical-path dimensions, each with score, level, and evidence-backed bilingual findings |
| `templates.ts` | Typed template catalog: Software (8 phases), Data Center (10 phases), Residential (10 phases) — tasks, dependencies, resources, budget lines, risk placeholders, all bilingual |
| `template-service.ts` | Instantiates a template: milestones + tasks (+CPM-scheduled dates) + dependencies + resources + budget + risks |
| `material-extraction.ts` | Drawing extractions (`material_takeoff`, `quantity_takeoff`, `mep_elements`, `equipment`) → evidence-first `material_requirements` candidates; never invents quantities; `needs_review` below 0.85 confidence; idempotent |

Types: `src/types/execution.ts` (new entities), re-exported from
`src/types/database.ts`; `Project` and `RoadmapTask` extended; `DatabaseTables`
map updated.

## 4. UI / navigation

- Create Project dialog: project type selector + "start from template" checkbox
  (en/es translations added under `projects.form`).
- `createProjectAction`: validates `projectType`, stores it, optionally
  instantiates the matching template (template failure never loses the project).
- `ProjectTabs` + project layout: tabs are now module-gated — Labor Capacity and
  Drawing Intelligence hide for software projects, full set for construction.
  Hidden ≠ removed: routes and tables remain.

## 5. Tests

37 new vitest tests in `src/lib/execution/__tests__/`:
- `critical-path.test.ts` — chains, parallel float, lag, SS/FF types, external
  material constraint, SNET, cycle isolation, duration fallbacks, near-critical.
- `readiness.test.ts` — every blocker type, in-flight material tolerance,
  cross-task isolation, score weights.
- `health.test.ts` — all dimensions incl. CPM-vs-target overrun and blocked
  critical task ⇒ critical health.
- `templates.test.ts` — key uniqueness, dependency resolvability, bilingual
  completeness, acyclic scheduling of all three templates, module defaults,
  universal status mapping totality.

Full suite: 128/128 pass. `tsc --noEmit` clean. `next build` succeeds.

## 6. Manual QA checklist

- [ ] Apply migrations 20260705 → 20260708 (in order) to the Supabase project.
- [ ] Create a Software project from template → 8 milestones, ~15 tasks with
      dates, dependencies visible in Workboard/Timeline, no RFI/Drawing tabs.
- [ ] Create a Data Center project from template → construction tabs visible,
      resources include UPS/generators/racks, risks pre-seeded with needs_review.
- [ ] Create a Residential project from template → inspection tasks present.
- [ ] Run `recalculateCriticalPath()` for a project → `roadmap_tasks.is_critical`
      populated and a `critical_path_snapshots` row created.
- [ ] Add a material with `required_by_task_id` + a procurement item with a
      future `expected_delivery_date` → recalculation pushes the task.
- [ ] Existing projects unaffected: `project_type='general'`, all tabs visible.

## 7. Known limitations / next sprint

1. **UI pages pending** for the new entities: Materials, Budget, Risks, RFIs,
   Submittals, Procurement, Resources list views (model + services are ready;
   recommended as the next sprint, one Execution Map tab each).
2. CPM uses calendar days; working-day/holiday calendars
   (`availability_calendars`) are a follow-up — engine interface already
   isolates this.
3. `construction_activities` remains a parallel specialized model for the labor
   lab; converging it onto `roadmap_tasks` is a future migration.
4. Living Graph emitters for the new entities (material/risk/RFI node creation
   on insert) are not wired yet — CHECKs and types are ready.
5. Drawing → material extraction is exposed as a service
   (`extractMaterialsFromDrawing`) but not yet called from the ingestion
   pipeline UI.
6. No automatic recalculation triggers yet — call `recalculateCriticalPath`
   from mutations (dependency/duration/material/RFI changes) as they get UI.
