# Milestone Flow Advanced Detectors (Phase 3, Task 6)

> Companion to the [MPF Engine Constitution](./milestone-process-flow-engine-constitution.md),
> [Architecture Note](./milestone-process-flow-engine-architecture.md), and the
> Task 2–5 docs. Task 6 is the **second detection layer**: rework, bottleneck
> candidates, and constraint propagation. It is **detection only** — no health, no
> Isabella natural language, no UI.

## What it does / does not do

**Does:** derive rework findings, bottleneck **candidates** (evidence-gated), and
conservative constraint-propagation findings from Task 3 segments + Task 4 metrics
+ Task 5 findings. **Does not:** classify final transition health, generate Isabella
explanations, build UI, rebuild transitions/segments, recompute metrics, or
re-interpret event semantics. `severity` is detection severity, **not** health.

## Files

| File | Responsibility |
|---|---|
| `advanced-detection-types.ts` | rework / bottleneck / propagation finding types + vocabularies + thresholds + options/input/result/stats + warning codes. |
| `advanced-detection-shared.ts` | shared leaf helpers: status, DETECTION severity, confidence capping, evidence dedup, validation. |
| `rework-detector.ts` | rework detection + `determineMilestoneReworkType`. |
| `bottleneck-detector.ts` | bottleneck candidate detection + `determineMilestoneBottleneckType` (gated). |
| `constraint-propagation-detector.ts` | cross-transition propagation + `determineMilestonePropagationType`. |
| `advanced-detection.ts` | orchestrator `detectMilestoneFlowAdvancedFindings`. |
| `engine.ts` (updated) | populates `reworkFindingsByTransition` / `bottleneckFindingsByTransition` / `constraintPropagationFindings` + observability. |

## Rework detection

A **`rework` segment** (built from `TaskReopened` / `DecisionReversed` /
`ApprovalRejected` / `DrawingRevised`) is **definite** rework; a non-rework segment
carrying `scope_change` / `quality` friction (from `ScopeChanged` / `DefectRaised`)
is **possible** rework (status `possible`). `reworkType` and `triggerType` are
derived from the segment's semantic categories / friction (attached by Task 2/3) —
events are never re-interpreted. Duration is **read** from Task 4 metrics. Types:
`task_reopened, approval_rejection, decision_reversal, scope_change,
requirement_change, defect_or_quality_failure, deliverable_revision,
milestone_regression, unknown`.

## Bottleneck candidate detection — and why not every delay is a bottleneck

Task 5 delay findings + Task 6 rework are grouped per transition by
**bottleneckType** (Task 1 vocabulary: decision_delay→`decision`,
approval_delay→`approval`, blocker→`dependency` conservative default,
waiting_time→`unknown`, rework→`rework`). A group becomes a **candidate only if it
meets at least one conservative criterion**:

- `long_duration` — aggregate delay ≥ `longDurationMs` (default 7d);
- `repeated_occurrence` — ≥ `repeatedOccurrenceCount` (default 2);
- `high_severity_source` — a Task 5 finding is high/critical;
- `open_long_unresolved` — open **and** long;
- `significant_time_share` — ≥ `significantPctOfKnownTime` (40%) **and** the delay
  is non-trivial (≥ `mediumMs`, so a short delay that is 100% of a tiny corridor is
  **not** a bottleneck).

Groups meeting none are **not** classified as bottlenecks. `isStructuralCandidate`
is true on repeated occurrence or ≥ 2 criteria. `candidateReason` lists the matched
criteria. Task 5 severity is **not** equated with health.

## Constraint propagation — conservative & evidence-backed

Two signals only, ordered by the transition array (milestone order):

1. **Shared evidence** — the SAME `eventId` appears in two distinct transitions'
   segment/finding evidence → propagation (origin = earlier, affected = later),
   `propagationType` from the origin finding, higher confidence.
2. **Sequential unresolved** — an **open** upstream blocker/decision/approval finding
   + a downstream `blocked`/`waiting` segment → status `possible`, low confidence,
   `POSSIBLE_PROPAGATION_LOW_CONFIDENCE` warning.

**Without linkage there is NO finding** (never fabricated); when ≥ 2 transitions
exist but nothing links them, a `MISSING_PROPAGATION_EVIDENCE` warning is emitted.
Types: `direct_dependency, decision, approval, risk, blocker, resource, rework,
scope_change, external_constraint, unknown`.

## Status / severity / confidence

- **Status:** `open / resolved / partial / possible / unknown` (possible for
  inferential rework/propagation; unknown when no evidence).
- **Severity (detection, NOT health):** from duration ladder + occurrence bump +
  time-share bump + open-long bump; `unknown` when unsized & unrepeated; low
  confidence downgrades one level.
- **Confidence:** weakest of evidence + source-finding confidences; capped `low`
  when duration unknown or entity linkage missing; `unknown` with no evidence.
  Reflects backfill/compensating provenance carried from Tasks 2–5.

## Metric & Task 5 consumption

Durations are **read** from Task 4 (`reworkTimeMs`, `blockedTimeMs`,
`segmentDurations`, `totalKnownSegmentTimeMs`, `confidence`) — never recomputed; **no
`Date.now()`**. Bottleneck detection consumes Task 5 findings' `findingType`,
`status`, `severity`, `durationMs`, `confidence`, `evidenceRefs`.

## Observability

Run summary gains `reworkFindingCount`, `bottleneckFindingCount`,
`constraintPropagationFindingCount`, `structuralBottleneckCandidateCount`,
`possiblePropagationCount`, `openAdvancedFindingCount`,
`resolvedAdvancedFindingCount`, `unknownAdvancedFindingCount`,
`highSeverityAdvancedFindingCount` (additive, optional).

## How future tasks consume these

- **Transition Health Classifier** — reads rework/bottleneck/propagation findings
  (severity, status, confidence, evidence) + metrics + Task 5 findings to produce
  **evidence-backed transition health**, mapping detection severity to health only
  there.
- **Isabella evidence packets** — consume the structured findings + evidence refs to
  build fact/inference/prediction/recommendation/uncertainty frames (natural language
  is not generated here).
- Living Graph, dashboards, and Isabella remain **consumers**; they must not re-detect.
