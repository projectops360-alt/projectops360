# PMO Portfolio Aggregation & Roll-up Engine — Final Report

Status: implemented and validated in an isolated worktree  
Date: 2026-07-24  
Branch: `codex/pmo-portfolio-rollup-engine-v1`  
Base commit: `7d08545`  
Feature flag: `PMO_PORTFOLIO_ROLLUP_ENGINE_V1_ENABLED=false`

## 1. Executive summary

The foundational PMO aggregation layer now exists as a deterministic, versioned, tenant-aware, date-aware, currency-aware, and explainable read-model engine. It rolls authorized project facts upward through project, program, portfolio, and organization scopes without deriving portfolio formulas in React or creating a second source of truth.

The increment adds:

- a versioned contract (`PMO_ROLLUP_CONTRACT_VERSION = 1`);
- a versioned registry of 98 metrics;
- a versioned ontology for Initiate, Plan, Execute, Control, Close, and Unmapped;
- pure domain calculators for project, schedule, financial, risk, resource, process, stage, health, quality, currency, and lineage;
- batch server adapters over existing canonical Supabase projections;
- governed Isabella context, answers, evidence, and feedback envelopes;
- JSON examples for organization, portfolio, program, project, stage, and Isabella;
- 35 focused tests covering the ten mandatory scenarios and integration boundaries.

No dashboard, Living Graph, Project Event Graph, RLS policy, migration, navigation, or production configuration was changed.

## 2. Architecture found

The detailed pre-implementation inventory is in `ARCHITECTURE-AUDIT.md`.

Canonical sources reused:

- organization and membership: `organizations`, `organization_members`, `profiles`, `getOrgContext()`;
- projects: `projects`;
- execution: `milestones`, `roadmap_tasks`, `task_dependencies`;
- risks and decisions: `risks`, `decisions`;
- resources: `resource_profiles`, `project_resource_allocations`, `resource_workload_snapshots`;
- controlled finance: financial baseline, funding, commitment, accrual, actual, reserve, forecast, reconciliation, and EVM tables;
- financial read model: `financial_project_cockpit`;
- dated EVM evidence: `financial_measurement_snapshots`;
- process events: `project_event_log` and `project_event_objects`;
- process discovery: existing process-mining discovery and variant engines;
- graph: existing Living Graph and Project Event Graph models, unchanged.

Canonical gaps are recorded rather than replaced by assumptions.

## 3. Architecture implemented

The implementation is a parallel read layer under `src/lib/pmo-rollup/`.

Flow:

1. The authenticated server adapter derives organization, role, capabilities, and authorized projects.
2. Batch queries read canonical project, finance, EVM, risk, resource, and process evidence.
3. Adapters normalize source rows into versioned facts.
4. The pure engine filters by tenant, authorization, hierarchy, date, stage, layer, and reporting currency.
5. Domain calculators produce atomic aggregate metrics.
6. Quality, confidence, health, stage aggregates, child entities, alerts, and lineage are assembled.
7. A deterministic snapshot ID is generated from the effective inputs and results.
8. Living Graph, dashboards, reports, simulations, or Isabella can consume the snapshot without recalculating formulas.

The implementation uses `Promise.all`, tenant predicates, and project-ID batch filters. It does not use the admin Supabase client or an N+1 project cockpit helper.

## 4. Metric Registry

- Version: `1.0.0`
- Formula family: `pmo-rollup-1.0.0`
- Definitions: 98
- Domains: portfolio, schedule, financial, risk, resource, process, benefit, strategy, quality
- Every metric declares unit, source grain, aggregation method, missing-data policy, direction, formula version, and any numerator, denominator, weight, or deduplication key.

Implemented aggregation methods:

- sum;
- count-distinct;
- average;
- weighted-average;
- ratio-of-sums;
- minimum;
- maximum;
- median;
- percentile;
- derived;
- longest-path contract with honest `not-calculable` behavior until an inter-project dependency graph exists.

## 5. Stage Ontology

- Version: `1.0.0`
- Stages: `initiate`, `plan`, `execute`, `control`, `close`, `unmapped`
- Each definition contains meaning, why it matters, included activities, entry criteria, exit criteria, mapping rules, and version.
- Organization-provided stage definitions can replace defaults without editing UI code.
- Unmapped events are retained and warned as `stage_mapping_required`.
- Current Project State and observed Process Flow remain separate.

## 6. Key formulas

Schedule:

- `signed_schedule_variance_days = business_days(baseline_finish, forecast_finish)`
- `accumulated_delay_days = Σ max(0, signed_schedule_variance_days)`
- `late_project_count = count-distinct(project_id where variance > 0)`
- `average_delay_late_projects = accumulated_delay_days / late_project_count`
- `net_schedule_variance_days = Σ signed_schedule_variance_days`
- weighted delay prefers approved budget, then strategic/complexity/benefit weights.

Progress:

1. `ΣEV / ΣBAC` when EVM coverage is sufficient;
2. `Σ(completion × BAC) / ΣBAC`;
3. strategic-weighted progress;
4. estimated simple average with reduced confidence only as the last fallback.

Finance:

- `portfolio_cpi = ΣEV / ΣAC`
- `portfolio_spi = ΣEV / ΣPV`
- `portfolio_eac = Σ project_eac`
- `portfolio_vac = ΣBAC - ΣEAC`
- actual, commitment, and accrual remain separate;
- mixed currencies are never summed without an explicit dated rate.

Risk:

- `expected_risk_delay_days = Σ(probability × schedule_impact_days)`
- `expected_risk_cost = Σ(probability × cost_impact)`
- shared risks deduplicate by canonical `risk_id`.

Resources:

- capacity deduplicates by `resource_id + period_start + period_end`;
- `overallocated_hours = Σ max(0, allocated_hours - available_hours)`;
- overallocated people use count-distinct.

Process:

- `rework_rate = cases_with_rework / eligible_completed_cases`;
- event count is never represented as project count;
- delay, future risk exposure, and process waiting are distinct metrics.

Health:

- recalculated from atomic schedule, financial, risk, delivery, resource, and data-quality subscores;
- organization-provided versioned weights override defaults;
- child Health Scores are never averaged.

## 7. Required scenario results

1. Schedule: accumulated delay 30, late projects 2, average late delay 15, maximum 20, net variance 25.
2. CPI: ratio-of-sums verified both when it equals and differs from the average of project CPI values; the differing fixture returns `100/70`, not `(0.5+1.8)/2`.
3. Progress: BAC-weighted completion 27%, not 55%.
4. Shared risk: one unique risk, three affected projects, exposure counted once.
5. Finance: actual 100, commitment 200, accrual 50, EAC 700, VAC 300 with no double counting.
6. Currency: USD 100 plus EUR 100 at 1.2 becomes USD 220; missing rate produces partial USD 100 with 50% coverage.
7. Missing baseline: project remains in total count, is excluded from schedule calculation, excluded count becomes 1, coverage becomes 50%, confidence drops.
8. Security: foreign organization project and process facts contribute to neither metrics nor lineage; unauthorized project details are denied; financial metrics are withheld without `financial.view`.
9. Historical: January and March snapshots are reproducible, later project/EVM facts do not leak into the earlier cutoff, formula versions remain visible.
10. Reconciliation: additive finance reconciles project → program → portfolio → organization; shared risks intentionally do not equal a blind sum of child totals and lineage explains the deduplication.

## 8. Security results

- Tenant mismatch raises `PmoRollupAccessError`.
- Organization/program/portfolio scopes require PMO or administrator aggregate scope.
- Project detail requires explicit project authorization.
- Financial evidence requires `financial.view`.
- Cross-tenant facts are discarded before both calculations and lineage.
- Server reads derive tenant context from authentication and retain explicit organization predicates.
- The server adapter does not use `createAdminClient`.
- Isabella feedback rejects metric evidence outside the authorized snapshot.

No RLS policy was changed. Database RLS remains the first barrier and the engine adds a second application-layer barrier.

## 9. Data quality, confidence, history, and lineage

Each calculated metric returns:

- numerator/denominator when applicable;
- population, eligible, and excluded counts;
- coverage;
- confidence;
- aggregation method;
- formula version;
- cutoff and period;
- currency/calendar context;
- complete/partial/estimated/not-calculable status;
- contributing and excluded entities;
- human explanation.

Snapshot quality combines completeness, freshness, source reliability, calculation coverage, sample sufficiency, currency coverage, baseline coverage, EVM coverage, date validity, and mapping coverage.

Historical filtering uses `effectiveAt`, data dates, and EVM measurement dates. Current-state sources without bitemporal history reduce coverage instead of fabricating a past state.

Lineage records source facts, excluded facts, source types, formulas, filters, deduplication rules, exchange-rate IDs, and a compact token.

## 10. Isabella

Isabella now receives only structured, authorized aggregate context. Deterministic answer resolution covers project counts, late projects, accumulated/average/maximum delay, expected risk delay, budget, EAC, overrun, CPI, SPI, health/confidence, missing data, process waiting, rework, and utilization.

Every answer returns snapshot ID, metric IDs, formula version, cutoff, evidence, and confidence. Unknown questions reference the valid snapshot and state that the metric is not registered; they never use the dead-end response “Puede que no tenga el contexto.”

Governed feedback records organization, snapshot, metrics, formulas, question, answer, evidence, confidence, accepted/rejected/deferred decision, correction, outcome, timestamp, and knowledge version. Building feedback does not mutate the snapshot or alter model behavior.

Examples: `examples/isabella-answers.json`.

## 11. Data gaps and pending risks

Not currently canonical:

- program and portfolio entities/relationships;
- general issue register;
- governed project baseline/forecast schedule pair;
- inter-project dependency graph;
- organization work calendars;
- governed FX-rate table;
- shared-risk relation and quantitative risk impacts;
- benefits and strategic objectives;
- project complexity and benefit weights;
- stage-level financial allocation;
- complete bitemporal history;
- cash-flow time series and normalized burn rate;
- vendor capacity and critical skill gaps.

Consequences:

- organization and project scopes work with current sources;
- program and portfolio scopes work with supplied governed hierarchy facts, but production hierarchy remains partial until canonical ownership exists;
- longest-path delay, ROI, benefits, stage finance, and some risk/resource metrics return partial or not-calculable states when evidence is absent;
- no invented values are used.

## 12. Files created

Documentation:

- `docs/pmo-rollup/ARCHITECTURE-AUDIT.md`
- `docs/pmo-rollup/README.md`
- `docs/pmo-rollup/FINAL-REPORT.md`
- `docs/pmo-rollup/examples/organization-snapshot.json`
- `docs/pmo-rollup/examples/portfolio-snapshot.json`
- `docs/pmo-rollup/examples/program-snapshot.json`
- `docs/pmo-rollup/examples/project-snapshot.json`
- `docs/pmo-rollup/examples/stage-snapshot.json`
- `docs/pmo-rollup/examples/isabella-answers.json`

Implementation:

- `src/lib/pmo-rollup/contracts.ts`
- `src/lib/pmo-rollup/adapters.ts`
- `src/lib/pmo-rollup/engine.ts`
- `src/lib/pmo-rollup/read-model.server.ts`
- `src/lib/pmo-rollup/metric-registry.ts`
- `src/lib/pmo-rollup/stage-ontology.ts`
- `src/lib/pmo-rollup/project-metrics.ts`
- `src/lib/pmo-rollup/financial-metrics.ts`
- `src/lib/pmo-rollup/risk-metrics.ts`
- `src/lib/pmo-rollup/resource-metrics.ts`
- `src/lib/pmo-rollup/process-metrics.ts`
- `src/lib/pmo-rollup/stage-aggregates.ts`
- `src/lib/pmo-rollup/health.ts`
- `src/lib/pmo-rollup/quality.ts`
- `src/lib/pmo-rollup/currency.ts`
- `src/lib/pmo-rollup/facts.ts`
- `src/lib/pmo-rollup/security.ts`
- `src/lib/pmo-rollup/metric-value.ts`
- `src/lib/pmo-rollup/math.ts`
- `src/lib/pmo-rollup/flags.ts`
- `src/lib/pmo-rollup/isabella-context.ts`
- `src/lib/pmo-rollup/isabella-feedback.ts`
- `src/lib/pmo-rollup/index.ts`

Fixtures and tests:

- `src/lib/pmo-rollup/__fixtures__/canonical-fixtures.ts`
- seven test files under `src/lib/pmo-rollup/__tests__/`.

## 13. Files modified

- `.env.example` — adds the independent feature flag with value `false`.
- `src/lib/env.ts` — exposes the server-side feature flag.

## 14. Validation results

- Focused lint: `npm run lint -- src/lib/pmo-rollup src/lib/env.ts` — PASS, zero problems.
- Typecheck: `npm run typecheck` — PASS.
- Focused tests: `npx vitest run src/lib/pmo-rollup` — PASS, 7 files and 35 tests.
- Full tests: `npm run test:run` — PASS, 259 files and 2,404 tests passed; 13 files and 58 tests skipped by their existing conditions.
- Diff integrity: `git diff --check` — PASS.
- Full repository lint: NOT GREEN because the base repository currently reports 99 errors and 177 warnings in unrelated pre-existing files. No error is in `src/lib/pmo-rollup` or `src/lib/env.ts`; this increment does not expand scope to rewrite unrelated modules.

One existing Isabella routing test timed out once during the first full run. It passed 5/5 in isolation, and the complete suite then passed on the final rerun.

## 15. Acceptance and initial release state

- Metric Registry: complete and versioned.
- Stage Ontology: complete and versioned.
- Project → Program → Portfolio → Organization: implemented for governed hierarchy facts.
- Average-of-averages: prevented where original numerators/denominators or weights are required.
- Financial separation, FX, risk/resource deduplication, history, lineage, confidence, and security: implemented and tested.
- Project State versus Process Flow: separated.
- Isabella structured consumption and governed feedback: implemented and tested.
- Dashboard and Living Graph: unchanged.
- Feature flag: OFF by default.
- Database migrations: none.
- At the close of the autonomous milestone, no deploy, merge, push, or commit had occurred, as originally required.
- Production promotion was authorized separately after this validation report; that release must preserve the documented CI, Preview, feature-flag, tenant, and rollback gates.

The increment is ready for code review and controlled integration. Repository-wide lint debt remains an existing baseline exception; focused lint, typecheck, and the complete test suite are green for this increment.
