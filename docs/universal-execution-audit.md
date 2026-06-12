# Universal Execution Model — Codebase Audit (Step 1)

Date: 2026-06-12
Scope: full audit of ProjectOps360° before the universal standardization pass.

## 1. What exists today

### Core domain (DB)
| Area | Tables | Notes |
|---|---|---|
| Tenancy/auth | `organizations`, `profiles`, `organization_members` | RLS via `is_org_member()` everywhere |
| Project | `projects` | status: planning/active/on_hold/completed/cancelled. **No `project_type`.** |
| Roadmap | `milestones`, `roadmap_tasks` | Tasks already carry scheduling (`start_date`, `end_date`, `duration_days`, `progress`, `is_blocked`) **and CPM fields** (`earliest_start/finish`, `latest_start/finish`, `slack_days`, `is_critical`) |
| Dependencies | `task_dependencies` | 4 dependency types + `lag_days`. Mirrored by `activity_dependencies` for construction |
| Construction lab | `trade_taxonomy`, `labor_resources`, `construction_activities`, `activity_dependencies`, `labor_weekly_capacity` | Parallel execution model, construction-only. `compute_labor_capacity()` SQL fn |
| Living Graph | `process_nodes`, `process_edges`, `process_snapshots` | CHECK-constrained node/edge/source types, extended in `20260707` migration. Vector embeddings + traversal RPCs |
| Drawing Intelligence | `drawing_files`, `drawing_pages`, `drawing_extractions`, `drawing_insights`, `drawing_versions`, `drawing_processing_jobs`, `drawing_evidence` | Evidence-first. `drawing_insights.linked_risk_id / linked_rfi_id / linked_submittal_id` point at **tables that do not exist yet** |
| Memory/traceability | `decisions`, `meetings`, `communication_items`, `documents`, `stakeholders`, `action_items`, `traceability_links`, `ai_runs`, `audit_logs` | Polymorphic `traceability_links` |

### Application layer (TS)
- `src/lib/roadmap/` — progress calc, centralized status/color mappings (`status-mappings.ts`), topological sort (Kahn), notes-based dependency parsing, recommendations.
- `src/lib/labor/` — capacity, workface readiness (checklist on `construction_activities.readiness_checklist`), lookahead, crew idle risk, labor/productivity variance, cause classification. Bilingual explanations.
- `src/lib/graph/` — living graph analysis, layout, styles, labor mapping, event emission.
- `src/lib/drawing-intelligence/` — ingestion, PDF extraction, OCR, extractors, interpretation service, version sync, vendor connectors (Autodesk behind connector registry). Tested with vitest.
- `src/lib/ai/` — OpenAI provider, prompts, service; `ai_runs` audit trail.
- Types: hand-written `src/types/database.ts` with `DatabaseTables` map.

## 2. Duplications
1. **Two task models**: `roadmap_tasks` vs `construction_activities` (status sets differ slightly; activities add trade/crew/zone/readiness).
2. **Two dependency tables**: `task_dependencies` vs `activity_dependencies` (identical shape).
3. **Readiness logic** exists only for construction activities, not tasks.
4. Status conventions diverge: tasks use AI-execution statuses (`prompt_ready`, `sent_to_ai`, `implemented`, `tested`), activities use `not_started/in_progress/completed/blocked/deferred`.

## 3. Missing (vs universal model)
- `projects.project_type` and per-type module configuration.
- Universal `resources` (materials, equipment, software licenses, cloud services, vendors) — `labor_resources` covers only crews/specialists/inspectors/vendors/witnesses.
- `material_requirements`, `procurement_items`, `suppliers`.
- `budget_items`, `cost_actuals` — no budget model at all.
- `risks`, `rfis`, `submittals`, `inspections`, `permits` as first-class tables (drawing_insights already anticipates them).
- Task assignment: `roadmap_tasks` has **no** `assigned_to`; only `action_items.assigned_to` exists.
- CPM fields exist on tasks but **no engine computes them** (no forward/backward pass anywhere in `src/`).
- `critical_path_snapshots`.
- Project templates (none — projects are created empty).
- Project Health Engine (partial signals exist: labor shortage risk, milestone at_risk, variance engines — not aggregated).
- Task readiness score (only construction checklist exists).

## 4. Reuse / standardize decisions
- **Keep** `roadmap_tasks` as the single universal task entity; extend with assignment/cost/location/discipline fields. `construction_activities` stays for the labor lab (backward compat) and is documented as a specialized projection; new work should target tasks.
- **Keep** `task_dependencies` as canonical dependency table.
- **Reuse** Living Graph; extend CHECKs additively for new entity types.
- **Reuse** `drawing_insights` link columns by finally creating the target tables (`risks`, `rfis`, `submittals`) with matching ids.
- **Reuse** `status-mappings.ts` pattern; add universal-status mapping layer.
- **Additive migrations only** — no column drops, no destructive changes.
- Templates live as **typed code catalogs** (versionable, testable), instantiated into real rows at project creation; no template tables needed yet.

## 5. Migration & compat notes
- All new tables follow house conventions: uuid PK, `organization_id` FK, soft delete, `set_updated_at` trigger, member RLS + service-role policy, partial indexes.
- `labor_resources` rows are backfilled into universal `resources` (type `crew`/`person`/`vendor`) with `legacy_labor_resource_id` for traceability; original table untouched.
- Existing projects get `project_type = 'general'` (safe default) and all current modules enabled.
