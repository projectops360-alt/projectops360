# Milestone Flow Delay Detector (Phase 3, Task 5)

> Companion to the [MPF Engine Constitution](./milestone-process-flow-engine-constitution.md),
> [Architecture Note](./milestone-process-flow-engine-architecture.md),
> [Event Semantics](./milestone-process-flow-event-semantics.md),
> [Transition Builder](./milestone-process-flow-transition-builder.md), and
> [Metrics Calculator](./milestone-process-flow-metrics-calculator.md). Task 5 is
> the **first detection layer** — blockers, waiting time, decision delays, and
> approval delays. It is **detection only**: no health, no bottlenecks, no
> constraint propagation, no UI.

## What it does

For each transition, emits structured **findings** for the four friction types
from the Task 3 segments already classified by Task 2, using the **Task 4 metric
durations** (never recomputed). Findings are derived intelligence — never
canonical truth, never health.

## What it intentionally does NOT do

Final transition health, bottleneck classification, constraint propagation, rework
detection (approval-rejected / decision-reversed are only supporting context here),
Projection Runtime, Isabella natural-language output, and all UI. It does not
rebuild transitions/segments, recompute metrics, or re-interpret event semantics.

## Files

| File | Responsibility |
|---|---|
| `src/lib/milestone-flow/delay-detector-types.ts` | `MilestoneFlowDetectionFinding`, finding-type/status/severity vocabularies, severity thresholds + defaults, options/input/result, detection warning codes. |
| `src/lib/milestone-flow/delay-detector.ts` | all detection logic + shared finding builder (status/severity/confidence/evidence) + orchestrator. |
| `src/lib/milestone-flow/blocker-detector.ts` | re-exports `detectBlockerFindings` (blocker detection lives with the others to share primitives; no import cycle). |
| `engine.ts` (updated) | `buildMilestoneFlowProjection` populates `findingsByTransition` + detection observability. `classifyTransitionHealth` still unsupported. |

## Finding types & mapping

`blocker` ← `blocked` segment · `waiting_time` ← `waiting` · `decision_delay` ←
`decision_delay` · `approval_delay` ← `approval_delay`. Other segment types
(`active_work`, `rework`, `handoff`, `review`, `external_constraint`, `unknown`)
produce **no** finding here; `unknown` segments are skipped with an
`UNKNOWN_SEGMENT_SKIPPED` warning. Resolved vs unresolved is expressed by
**status**, not by separate finding types.

## How each is detected

- **Blocker** — from a `blocked` segment (built by Task 3 from `TaskBlocked`, closed
  by `TaskUnblocked`). **Open** when the segment is open-ended; **resolved** when the
  unblocking event closed it. Not a bottleneck.
- **Waiting time** — from a `waiting` segment; distinguishes known duration, open
  measured (via metrics computed with `analysisAsOf`), and open unknown. Cause is
  never invented.
- **Decision delay** — from a `decision_delay` segment (decision proposed/deferred);
  resolved when a decision-made event closed it. Decision reversed/changed is only
  supporting context, not rework.
- **Approval delay** — from an `approval_delay` segment (approval requested/expired);
  resolved when a grant closed it. Approval rejected may support delay/regression
  evidence; final rework is a future task.

## Metric consumption (Task 4)

Each finding's `durationMs` is **read** from the transition's
`metrics.segmentDurations[segmentId].segmentDurationMs` — never recomputed. The
detector also uses `metrics.confidence` (to cap finding confidence) and attaches
`metricRefs` (e.g. `metrics.blockedTimeMs`, `metrics.segmentDurations.<id>`).
Because durations come from metrics (which use an explicit `analysisAsOf`), the
detector **never calls `Date.now()`** (guarded by test).

## Status (open / resolved / partial / unknown)

`open` when the source segment is open-ended · `resolved` when a closing event /
`endedAt` exists · `partial` when evidence exists but duration is unknown ·
`unknown` when there is no evidence.

## Severity (detection severity — NOT health)

Thresholds are configurable (conservative defaults: blocking critical ≥ 14d, high ≥
7d, medium ≥ 3d; waiting high ≥ 14d, medium ≥ 7d). `durationMs == null` → `unknown`
(unsized delays are not escalated). Low **confidence** downgrades severity one
level. Severity is **never** mapped to the health vocabulary
(`healthy/degraded/blocked/at_risk`) — that is the Health Classifier's job.

## Confidence

Starts from the weakest of segment confidence, metric confidence, and evidence
`aggregateConfidence` (which already reflects backfill/compensating provenance from
Tasks 2–4), and is **capped to `low`** when the duration is unknown. No evidence →
`unknown`. Never inflated above the weakest required evidence.

## Evidence

Findings merge segment evidence + segment-metric evidence, **deduplicated** by
`kind|eventId|metricRef`. `sourceEventIds` collect the segment's source/closing
events + evidence event ids. No evidence → `unknown`/warning. Nothing invented.

## Unknown / partial handling

Unknown segments → no finding (+ warning). Missing metrics → `MISSING_METRICS_FOR_TRANSITION`
warning and `durationMs` null (partial), never a crash. Missing evidence →
`unknown` confidence + warning. Missing duration → `durationMs` null.

## Observability

Run summary gains `delayFindingCount`, `blockerFindingCount`, `waitingFindingCount`,
`decisionDelayFindingCount`, `approvalDelayFindingCount`, `openFindingCount`,
`resolvedFindingCount`, `unknownFindingCount`, `highSeverityFindingCount`
(additive, optional). Detection warnings are merged into the run warnings.

## Task 4 pre-flight verification

Verified: the Metrics Calculator does **not lose** unknown segment information.
Unknown-type segments are represented via `timeBuckets.unknownTimeMs`,
`counters.unknownSegmentCount`, duration completeness, and warnings. The documented
efficiency denominator (`totalKnownSegmentTimeMs`) was **not** changed. No
correction was required; regression coverage added in the detector test.

## How future tasks consume findings

- **Health Classifier** — reads findings (severity, status, confidence, evidence)
  + metrics to produce **evidence-backed transition health**, mapping detection
  severity to health only there.
- **Bottleneck Detector** — aggregates repeated blocker/decision/approval findings
  across transitions/teams to classify structural bottlenecks.
- Living Graph, Isabella, and dashboards remain **consumers** of findings; they must
  not re-detect.
