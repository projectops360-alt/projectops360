# PMO Portfolio Aggregation & Roll-up Engine — Architecture Audit

Status: architecture baseline frozen before implementation  
Date: 2026-07-24  
Feature flag: `PMO_PORTFOLIO_ROLLUP_ENGINE_V1_ENABLED` (server-side, default OFF)

## 1. Canonical models found

| Domain | Canonical source | Grain / notes |
|---|---|---|
| Organization and membership | `organizations`, `organization_members`, `profiles` | `getOrgContext()` resolves the authenticated tenant and role. |
| Project | `projects` | Canonical project record. It has status and target end date, but no program, portfolio, macro-stage, strategic weight, baseline finish, or project-level forecast finish. |
| Program / portfolio | Not implemented as canonical entities | `project_event_log.portfolio_id` is optional event context, not a governed hierarchy model. No canonical program relation exists. |
| Milestone / task / dependency | `milestones`, `roadmap_tasks`, `task_dependencies` | Canonical execution state and dependency inputs. |
| Risk | `risks` | Project-scoped risk register. Probability and impact are categorical; expected cost/delay and shared-risk links are only possible when supplied in governed metadata. |
| Issue | Not implemented | RFIs are not a general issue register and are not reclassified as issues. |
| Decision | `decisions` | Canonical project decisions. |
| Resource capacity | `resource_profiles`, `project_resource_allocations`, `resource_workload_snapshots`, `workforce_health_scores` | Periodized resource inputs exist. Cross-project person-period deduplication must use `resource_profile_id` plus period. |
| Budget and actuals | `budget_items`, `cost_actuals` | Legacy execution sources remain canonical for their own workflows. |
| Controlled financial domain | Financial tables from migrations `20260858000000`, `20260858010000`, `20260859000000` | Baselines, funding, commitments, accruals, payments, changes, reserves, EVM measurements, forecasts, and reconciliation. |
| Financial project read model | `financial_project_cockpit` | Preferred project-level controlled financial projection. Actuals, commitments, and accruals remain separate. |
| Process events | `project_event_log` plus `project_event_objects` | Immutable Project Event Graph ledger and object references. No second event ledger is authorized. |
| Process discovery | `src/lib/process-mining/discovery` and `src/lib/process-mining/variants` | Reusable deterministic case, variant, temporal, conformance, and rework engines. |
| Living Graph | `process_nodes`, `process_edges`, `process_snapshots`, `src/lib/graph`, `src/lib/living-graph` | Existing graph remains unchanged. The roll-up engine is a parallel read layer. |
| PMO Process Intelligence | `src/lib/pmo-process-intelligence` | Existing versioned process and financial read contracts. This capability consumes the new aggregate snapshot later; it does not own aggregate formulas. |
| Project execution roll-up | `src/lib/project-rollups/project-rollup-engine.ts` | Reusable canonical task activity and milestone-health rules at project grain. |

## 2. Existing projections and services to reuse

- `financial_project_cockpit` for controlled project financial positions.
- `financial_measurement_snapshots` for dated BAC/PV/EV/AC evidence.
- `resource_workload_snapshots` for person-period capacity.
- `project_event_log` for process-flow reconstruction and historical event windows.
- `computeProjectExecutionRollup()` for task-state semantics.
- `computeEvmSnapshot()` and deterministic forecast formulas from `src/lib/financial`.
- Process discovery and variant engines for event-based cycle, rework, and conformance metrics.
- `getOrgContext()` plus database RLS for tenant scope, with a second in-engine authorization barrier.

The existing `portfolio-briefing` engine is a useful presentation precursor but is not the canonical PMO aggregation engine: it does not carry formula versions, coverage, confidence, hierarchy roll-ups, currency conversion, historical as-of behavior, or lineage.

## 3. New adapters required

1. **Project state adapter** — maps canonical project rows and optional governed hierarchy/stage assignments into normalized project facts.
2. **Schedule adapter** — accepts approved baseline/forecast dates when available; missing baseline finish remains an explicit exclusion.
3. **Financial adapter** — maps cockpit and dated EVM evidence without combining actual, commitment, and accrual.
4. **Risk adapter** — normalizes categorical probability and optional governed quantitative impacts; canonical `risk_id` is the deduplication key.
5. **Resource adapter** — normalizes person-period workload and deduplicates shared resources by resource and period.
6. **Process adapter** — maps existing discovery results into aggregate facts; Project State remains separate from Process Flow.
7. **Hierarchy adapter** — accepts governed project-to-program-to-portfolio relationships. Until canonical hierarchy entities exist, organization and project snapshots are available while program/portfolio metrics are `not-calculable`.
8. **Currency adapter** — requires an explicit, dated conversion rate for every non-reporting-currency amount.
9. **Isabella context adapter** — exposes only structured, authorized aggregate snapshots.

## 4. Proposed persistence

No new tables, views, materialized views, or database functions are created in this increment.

The first implementation is a pure, deterministic, cacheable read-model engine with a batch-oriented server adapter. This avoids premature persistence before the missing hierarchy, FX, schedule-baseline, benefits, and strategic-objective ownership decisions are approved.

Future optional projection tables may persist immutable snapshots and lineage tokens after live scale measurements justify them. They must remain derived read models, never canonical truth.

## 5. Metric availability

### Available now

- Project counts and status distributions.
- Project-state stage distribution when a governed stage assignment or deterministic mapping is supplied.
- Task and milestone execution counts.
- Controlled financial sums for same-currency or explicitly converted inputs.
- Portfolio CPI and SPI as ratio-of-sums from dated EV/AC and EV/PV.
- BAC-weighted progress and fallback progress policies.
- Risk counts and severity distributions.
- Resource capacity, allocation, utilization, and over-allocation from person-period snapshots.
- Process event/case counts, variants, cycle time, rework, and conformance when discovery inputs exist.
- Coverage, confidence, formula version, contributing/excluded entities, and as-of metadata.

### Partially available

- Schedule delay: project target end exists, but approved baseline finish and forecast finish are not canonical project fields. The engine supports them and excludes projects lacking the pair.
- Quantified risk exposure: probability is categorical and quantitative cost/delay fields are not canonical columns. Governed metadata can supply them; otherwise exposure is not calculable.
- Stage attribution: no canonical project macro-stage field exists. Status-derived mappings are estimated and disclosed.
- Financial stage attribution: baseline lines can carry WBS/CBS/control-account references, but no canonical stage allocation exists.
- Historical reconstruction: event and EVM evidence are dated; many current-state tables are not bitemporal. The engine filters dated facts by `asOf` and declares incomplete historical coverage.
- Currency conversion: project currencies exist, but no canonical exchange-rate table exists. Explicit rate inputs are required.

### Not available without new canonical ownership

- Canonical programs and portfolios.
- General issue management.
- Benefits realized/projected and portfolio ROI.
- Strategic objectives and strategic value weights.
- Project complexity weights.
- Inter-project dependency critical-chain calculations.
- Canonical project schedule baseline/forecast pair.
- Governed organizational work calendars.
- Canonical risk sharing/affected-project relation.
- Canonical quantitative risk probability, cost, and delay impacts.
- Cash-flow time series and burn rate at portfolio grain.
- Phase-level financial allocation.
- Vendor-capacity and critical-skill-gap facts with consistent organization-wide grain.

These gaps are never replaced with fabricated values.

## 6. Double-counting risks

- `budget_items.actual_cost` and `cost_actuals` can represent overlapping legacy actuals; controlled aggregation prefers financial projections and never adds both blindly.
- Actuals, commitments, accruals, payments, and reserves are separate truths.
- Shared risks may appear once per affected project; organization-level exposure deduplicates by canonical risk ID.
- Resource workload can appear in several projects; organization over-allocation deduplicates by resource and period before comparing allocated versus available hours.
- Child aggregate totals cannot be summed blindly for deduplicated domains.
- Project-level stage budget is not assigned to the current stage without an allocation.

## 7. Security risks and controls

- Admin/service-role clients bypass RLS and are unsafe unless preceded by trusted session authorization and followed by organization/project filters.
- The new server adapter must derive organization and role from `getOrgContext()`, never from request payloads.
- The pure engine rejects cross-organization rows and filters to the caller's authorized project set.
- Organization/program/portfolio aggregation requires PMO/admin scope.
- Financial metrics require `financial.view`.
- Lineage must omit unauthorized project IDs.
- Realtime consumers must reapply the same scope before accepting deltas.

## 8. Performance risks and controls

- The existing PMO financial adapter performs N+1 reads; the new adapter uses batch reads.
- Event windows can be large; process metrics consume bounded, disclosed windows or existing projections.
- Lineage returns compact source summaries and supports detail tokens instead of sending unlimited IDs.
- The pure engine is deterministic and suitable for memoization or immutable snapshot persistence later.
- Incremental invalidation is defined by project, then program, portfolio, and organization ancestors.

## 9. Planned files

Create:

- `src/lib/pmo-rollup/contracts.ts`
- `src/lib/pmo-rollup/metric-registry.ts`
- `src/lib/pmo-rollup/stage-ontology.ts`
- `src/lib/pmo-rollup/math.ts`
- `src/lib/pmo-rollup/currency.ts`
- `src/lib/pmo-rollup/quality.ts`
- `src/lib/pmo-rollup/security.ts`
- `src/lib/pmo-rollup/engine.ts`
- `src/lib/pmo-rollup/isabella-context.ts`
- `src/lib/pmo-rollup/isabella-feedback.ts`
- `src/lib/pmo-rollup/read-model.server.ts`
- domain calculators and canonical adapters under `src/lib/pmo-rollup/`
- `src/lib/pmo-rollup/flags.ts`
- `src/lib/pmo-rollup/index.ts`
- `src/lib/pmo-rollup/__fixtures__/canonical-fixtures.ts`
- `src/lib/pmo-rollup/__tests__/*.test.ts`
- `docs/pmo-rollup/README.md`
- `docs/pmo-rollup/FINAL-REPORT.md`

Modify:

- `.env.example`
- `src/lib/env.ts`

No React component, dashboard, Living Graph file, navigation file, migration, production configuration, or deployment artifact is modified.
