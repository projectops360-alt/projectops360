# Milestone Flow Metrics Calculator (Phase 3, Task 4)

> Companion to the [MPF Engine Constitution](./milestone-process-flow-engine-constitution.md),
> [Architecture Note](./milestone-process-flow-engine-architecture.md),
> [Event Semantics](./milestone-process-flow-event-semantics.md), and
> [Transition Builder](./milestone-process-flow-transition-builder.md). Task 4
> computes **measurement only** — durations, time buckets, composition %, and flow
> efficiency. It does **not** classify health, bottlenecks, or constraint
> propagation (later tasks), and builds no UI.

## What is calculated

Per transition: planned/actual/forecast/elapsed/remaining durations; per-segment
durations; flow-time buckets by segment type; segment composition percentages;
flow efficiency ratio; segment counters; metric confidence; deduped evidence refs;
warnings + calculation notes.

## Files

| File | Responsibility |
|---|---|
| `src/lib/milestone-flow/metrics-calculator-types.ts` | `MilestoneFlowTransitionMetrics` (extends the Task 1 `MilestoneFlowMetrics` additively), buckets/percentages/counters/duration-detail types, completeness + warning-code vocabularies, options + result. |
| `src/lib/milestone-flow/metrics-calculator.ts` | all calculation functions (pure). |
| `engine.ts` (updated) | `buildMilestoneFlowProjection` populates `metricsByTransition` + metrics observability; `calculateFlowMetrics` delegates to the calculator (no longer throws). `classifyTransitionHealth` stays unsupported. |

## Transition duration

- **planned** = target `plannedDate` − source `plannedDate` (both present, non-negative), else null + `MISSING_PLANNED_DATES`.
- **actual** = transition `completedAt` − `startedAt` (Task 3 boundaries), else null + `MISSING_ACTUAL_DATES` while open.
- **forecast** = target − source `forecastDate` when both present (no warning when simply absent).
- **elapsed / remaining** = open transitions only, against an explicit `analysisAsOf` (see below); completed → elapsed = actual, remaining = 0.
- **durationCompleteness** = `complete` (actual known) · `partial` (elapsed/planned known) · `unknown`.

## Segment duration

- **Closed** (`endedAt` present, not open): `endedAt − startedAt` → `complete`.
- **Open** (`isOpenEnded` / no `endedAt`): `analysisAsOf − startedAt` → `partial`; **without** `analysisAsOf` → null + `MISSING_ANALYSIS_AS_OF_FOR_OPEN_SEGMENT` + `UNKNOWN_DURATION`.
- Missing start → `MISSING_SEGMENT_START`; negative duration → null + `INVALID_SEGMENT_DURATION`. **Dates are never fabricated.**

## Why `analysisAsOf` (replay stability)

Open durations depend on "now", so making them replay-stable requires an
**explicit** clock. The calculator **never calls `Date.now()`** (guarded by test).
Any open/elapsed duration is computed only against `options.analysisAsOf`. When
absent, open durations stay null (unknown) + warnings. The **engine's projection**
passes **no** `analysisAsOf`, so `buildMilestoneFlowProjection` is fully
replay-stable; a caller wanting elapsed metrics passes an explicit `analysisAsOf`.

## Time buckets & percentages

Known segment durations are summed into buckets by type (`active_work`, `waiting`,
`blocked`, `decision_delay`, `approval_delay`, `rework`, `handoff`, `review`,
`external_constraint`, `unknown`) plus `totalKnownSegmentTimeMs`. Unknown durations
are **never** counted. **Composition percentages** use denominator =
`totalKnownSegmentTimeMs` (documented); when it is 0/unknown, percentages are null.
Transition-duration comparison (planned vs actual) is kept separate from segment
composition.

## Flow efficiency

`flowEfficiencyRatio = activeWorkTimeMs / totalKnownSegmentTimeMs` (null when the
denominator is 0/unknown). Unknown/blocked/waiting/rework time is never treated as
active. **The ratio is not classified as healthy/unhealthy here** — that is the
Health Classifier's job.

## Confidence

`determineMilestoneMetricConfidence` starts from the weakest supporting evidence
(`aggregateConfidence`, which already reflects backfill/compensating provenance from
Tasks 2–3) and **caps to `low`** when unknown segments, invalid durations, or
open-without-`analysisAsOf` are present. No evidence → `unknown`. Confidence is
never inflated above the weakest required evidence.

## Evidence

`mergeMilestoneFlowMetricEvidence` collects segment evidence refs and
**deduplicates** by `kind|eventId|metricRef`. No evidence is invented; metrics
carry the same event-anchored refs that back the durations.

## Observability

Run summary gains `metricsCalculatedCount`, `metricsUnknownCount`,
`openSegmentDurationCount`, `invalidDurationCount`, `totalKnownSegmentTimeMs`
(additive, optional). Metrics warnings are merged into the run warnings.

## Unknown / partial representation

Every duration carries a `durationCompleteness` (`complete/partial/unknown/
unavailable`); nulls + warnings signal missing/invalid data. The calculator never
crashes on one bad segment — it degrades to partial/unknown and warns.

## Intentionally NOT implemented (Task 4)

Final transition health, bottleneck classification, constraint propagation,
escalation/unresolved-constraint counts (left null), Projection Runtime, Isabella
natural-language output, and all UI.

## How the future Health Classifier consumes metrics

The Health Classifier (later task) reads these metrics + segments + evidence to
produce **evidence-backed transition health** (replacing the preliminary structural
state) — e.g. high blocked/approval-delay percentage or low flow efficiency as
*inputs* to a health judgement, always with confidence and evidence. Living Graph,
Isabella, and dashboards remain **consumers** of metrics; they must not re-compute
them.
