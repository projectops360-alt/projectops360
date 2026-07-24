# PMO Portfolio Aggregation & Roll-up Engine

## Purpose

This module is the canonical read layer for deterministic PMO metrics. It aggregates authorized project facts into project, program, portfolio, and organization snapshots without changing canonical operational records, the current PMO dashboard, Process Intelligence, or Living Graph.

The engine is:

- pure and deterministic;
- tenant-, authorization-, filter-, date-, currency-, and calendar-aware;
- versioned and explainable;
- safe for caching and later immutable projection persistence;
- disabled by default through `PMO_PORTFOLIO_ROLLUP_ENGINE_V1_ENABLED=false`.

## Aggregate metric contract

An aggregate metric is not only a number. `AggregatedMetricValue` includes:

- value and unit;
- numerator and denominator when applicable;
- population, eligible, and excluded counts;
- coverage and confidence;
- aggregation method and formula version;
- cutoff and period;
- reporting currency or calendar;
- contributing and excluded entities;
- complete, partial, estimated, or not-calculable status;
- a plain-language explanation.

## Aggregation methods

| Method | Meaning | Example |
|---|---|---|
| Sum | Adds comparable atomic values | `Σ actual cost` |
| Average | Adds values and divides by eligible observations | Average cycle time |
| Weighted average | Uses an explicit governed weight | `Σ completion × BAC / Σ BAC` |
| Ratio of sums | Rebuilds a ratio from atomic numerators and denominators | `Portfolio CPI = Σ EV / Σ AC` |
| Count-distinct | Counts canonical IDs once | Unique risks |
| Median / percentile | Uses the observed distribution | P50/P90 delay |
| Longest path | Uses dependency topology, not blind addition | Dependency-adjusted delay |

An average of project CPI, SPI, completion, utilization, or child Health Scores is not used where atomic numerators and denominators exist.

## Project State and Process Flow

Project State answers: “Where is each project now?” Each project belongs to one current macro-stage in the stage distribution.

Process Flow answers: “What activities and transitions occurred during the period?” One project can generate events in several stages.

The snapshot keeps these perspectives separate:

- `PmoStageAggregate.currentProjectCount` is Project State.
- `PmoStageAggregate.projectsActiveInPeriod` is Process Flow.
- `total_projects` never uses event count.
- `total_cases` and `event_count` never masquerade as project counts.
- `activeLayer` is preserved in lineage for consumers.

## Stage ontology

`DEFAULT_PMO_STAGE_ONTOLOGY` version `1.0.0` defines:

1. Initiate
2. Plan
3. Execute
4. Control
5. Close
6. Unmapped / Needs Classification

Every stage has a semantic definition, business value, included activities, entry criteria, exit criteria, and mapping rules. An organization can pass a governed replacement ontology into the engine. Unmatched state or process evidence remains visible as `unmapped`.

## Metric registry

`PMO_METRIC_REGISTRY` version `1.0.0` declares each metric’s domain, unit, aggregation method, source grain, missing-data policy, direction, deduplication key, and formula version.

To add a metric:

1. Add the definition to `metric-registry.ts`.
2. Compute it in the appropriate pure domain aggregator.
3. Return it through `buildMetricValue()` so coverage, confidence, cutoff, and lineage are preserved.
4. Add a fixture where the wrong formula produces a different result.
5. Add cross-tenant and missing-data cases when the source scope changes.
6. Update this document and the final report.

React components must never implement metric formulas.

## Schedule semantics

- `signed_schedule_variance_days = business_days(baseline_finish, forecast_finish)`
- `accumulated_delay_days = Σ max(0, signed variance)`
- `late_project_count = count-distinct(project where variance > 0)`
- `average_delay_late_projects = accumulated delay / late project count`
- median, P90, maximum, net variance, weighted delay, and on-time rate are calculated separately.

An early project never cancels another project’s accumulated delay. Net schedule variance is secondary and explicitly disclosed.

Weighted delay uses approved budget first. Governed strategic or complexity weight is only a fallback.

## Actual delay, risk delay, and process waiting

These measures are never added or renamed as one another:

- **Actual delay**: observed project baseline-to-forecast schedule variance.
- **Expected risk delay**: `Σ probability × future schedule impact`.
- **Process waiting**: explicit waiting time observed inside process cases.
- **Duration**: elapsed case or project time.
- **Net variance**: signed aggregate that may contain early projects.

Isabella repeats this distinction in grounded answers.

## Financial rules

- Original baseline, current baseline, approved budget, BAC, commitments, actuals, accruals, payments, reserves, ETC, and EAC remain separate truths.
- The default reconciliation policy does not silently add accruals or commitments into Actual Cost.
- `remaining_budget = Σ approved budget - Σ actual cost`.
- `portfolio_cpi = Σ EV / Σ AC`.
- `portfolio_spi = Σ EV / Σ PV`.
- `portfolio_vac = Σ BAC - Σ EAC`.
- `budget_consumption = Σ actual cost / Σ approved budget`.
- `forecast_overrun = Σ max(0, project EAC - project BAC)`.
- Project financial totals are not attributed to a stage unless an explicit stage allocation exists.
- The server adapter uses batch reads and never the N+1 cockpit helper.

## Currency conversion

Mixed currencies are never summed directly. Every non-reporting-currency amount requires:

- original amount and currency;
- reporting currency;
- positive exchange rate;
- effective date not later than `asOf`;
- rate source and ID.

The latest eligible dated rate is used. Missing rates exclude the amount, reduce coverage and confidence, and add a visible warning. Rate IDs are retained in lineage.

## Risk deduplication

Risk metrics use canonical `risk_id`.

- A shared risk may appear in every affected project view.
- Organization/program/portfolio unique-risk counts include it once per aggregate scope.
- Quantitative exposure is computed once unless an explicit allocation rule says otherwise.
- The affected project list remains available.
- Actual delay and future risk exposure remain separate.

## Resource deduplication

Resource capacity uses `(resource_id, period_start, period_end)` as the comparison grain.

- Available capacity is not repeated for each project.
- Allocated hours are summed across authorized projects.
- `overallocated_hours = Σ max(0, allocated - available)` after person-period deduplication.
- Overallocated people are count-distinct resources.
- Shared resources are count-distinct resources assigned to multiple projects.

## Process metrics

The engine returns case and event counts, dominant variant frequency, average/median/P75/P90 cycle time, lead time, explicit waiting, rework cases and rate, conformance, skipped/repeated activity counts, SLA violations, completeness, and freshness.

`rework_rate = cases_with_rework / eligible_completed_cases`.

Dominant variant and bottleneck labels live in `processSummary`; numeric project-state metrics remain separate.

## Data quality

The snapshot evaluates:

- completeness;
- freshness;
- baseline availability;
- event continuity;
- sample sufficiency;
- currency conversion coverage;
- EVM coverage;
- date validity;
- stage mapping coverage;
- source reliability.

Missing sources produce partial, estimated, or not-calculable metrics. Incomplete values do not receive the same confidence or status as complete values.

## Confidence score

Confidence is a versioned weighted combination of available quality signals. Metric confidence also includes metric-specific coverage and sample sufficiency. Confidence is not business performance; it expresses how strongly the evidence supports the calculation.

## Health Score

The Health Score is recalculated from atomic aggregate metrics. It is not an average of child Health Scores.

Default version `1.0.0` weights:

- schedule 25%;
- financial 25%;
- risk 20%;
- delivery/process 15%;
- resources 10%;
- data quality 5%.

Consumers receive total score, subscores, applied weights, formula, configuration version, drivers, previous-period change, and confidence. An organization changes weights by supplying `PmoHealthScoreConfiguration`; no React code changes.

## Historical as-of behavior

Every input fact has an effective or data date. The engine selects the latest eligible version not later than `asOf`. Future facts are excluded.

Current-state tables without bitemporal history cannot be retroactively reconstructed with certainty. Their missing historical coverage is disclosed instead of backfilled with current values. The financial adapter refuses to merge a future cockpit row into an earlier EVM measurement.

## Lineage

Each snapshot includes:

- deterministic lineage token;
- contributing and excluded authorized fact IDs;
- source types;
- formula versions;
- filters and cutoff;
- deduplication rules;
- exchange-rate IDs.

Cross-tenant facts never appear as contributors or exclusions. A future persistence layer may resolve the token to larger detail sets on demand.

## Security

Security is enforced before aggregation:

- organization comes from trusted authentication context;
- aggregate organization/program/portfolio views require PMO/admin scope;
- project detail requires explicit project authorization;
- financial metrics require `financial.view`;
- every domain is filtered by tenant and authorized project;
- user-scoped Supabase RLS remains the primary barrier;
- the engine applies a second, pure barrier;
- the server adapter does not use the admin client;
- realtime/process facts are re-scoped before consumption.

## Hierarchy and reconciliation

The pure engine supports project relationships supplied by a governed hierarchy adapter:

`Project → Program → Portfolio → Organization`.

For additive domains without shared entities:

`Organization total = Σ portfolio totals = Σ program totals = Σ eligible project totals`.

Shared risks and resources are deduplicated at each requested scope. Therefore their organization total may intentionally differ from a blind sum of child totals, and lineage discloses the rule.

The current canonical schema has no governed program or portfolio entities. Production organization/project snapshots remain available, while program/portfolio metrics are not calculable until ownership is approved.

## Incremental updates

An incremental projection consumer should:

1. identify the changed project and metric domains;
2. recalculate the project snapshot;
3. recalculate its program;
4. recalculate its portfolio;
5. recalculate the organization;
6. publish an immutable snapshot or delta;
7. preserve formula and ontology versions.

The current implementation is pure and cacheable; it does not create projection tables prematurely.

## Living Graph consumption

Living Graph must consume `PmoAggregateSnapshot` and never derive PMO formulas in the browser. It can use:

- `stageAggregates` for macro-stage nodes;
- `childEntities` for drill-down;
- `metrics` for labels and overlays;
- `alerts` for governed attention states;
- `dataQuality` and metric status for honest empty/partial states;
- lineage tokens for evidence drill-down;
- `processSummary` only on the Process Flow layer.

No Living Graph file is changed by this milestone.

## Isabella consumption

`buildIsabellaPmoAggregateContext()` converts an authorized snapshot into a structured Isabella context. `answerIsabellaPmoAggregateQuestion()` demonstrates deterministic retrieval for project counts, delay, risk exposure, budget, EAC, overrun, CPI/SPI, process waiting, rework, utilization, confidence, and missing data.

Isabella never recomputes sums from free text. Every answer carries snapshot ID, metric IDs, formula versions, cutoff, evidence explanation, and confidence.

Example:

> accumulated_delay_days: 30. Cutoff 2026-03-31. Snapshot confidence 82%. Actual delay, future risk exposure, and process waiting remain separate.

`buildIsabellaPmoAggregateFeedbackRecord()` creates the governed feedback envelope for `accepted`, `rejected`, or `deferred` decisions. It binds the feedback to the tenant, snapshot, metric IDs, formula versions, evidence, confidence, knowledge version, timestamp, correction, and outcome. The builder rejects evidence outside the authorized snapshot and never mutates the snapshot or changes Isabella behavior automatically. Persistence can reuse the existing audited feedback path; this increment deliberately creates no second feedback store.

## Known canonical gaps

The following remain explicitly unavailable or partial until a canonical owner exists:

- program and portfolio entities/relationships;
- general issue register;
- approved schedule baseline/forecast pair;
- inter-project dependency graph;
- governed FX-rate table;
- risk sharing relation and quantitative impacts;
- benefits and strategic objectives;
- financial allocation by stage;
- complete bitemporal history;
- cash-flow time series and burn-rate normalization;
- organization work calendars.

See `ARCHITECTURE-AUDIT.md` for the source inventory and risk analysis.
