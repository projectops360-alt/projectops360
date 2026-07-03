# Milestone Flow Rework Detector (Phase 3, Task 6A)

> Companion to the [Advanced Detectors doc](./milestone-process-flow-advanced-detectors.md).
> **Status: already delivered.** Rework detection shipped as part of Task 6
> (advanced detectors). Task 6A re-scoped rework as a standalone concern; rather
> than duplicate it, Task 6A **exposes the rework-only public API** and pins it
> with its own regression (`PEG-MPF-REWORK-DETECTION`). Bottleneck and constraint
> propagation from Task 6 are unchanged.

## What it does

Identifies rework signals inside milestone transitions from Task 3 segments + Task 4
metrics. Derived intelligence, never canonical truth, never transition health.

## Standalone API (Task 6A)

- `detectMilestoneFlowReworkFindings(input)` — rework findings for **all**
  transitions (`{ scope, transitions, metricsByTransition, options? }` →
  `{ reworkFindingsByTransition, findings, warnings }`). This is the rework-only
  entry point; rework also flows through the Task 6 advanced-detection orchestrator.
- `detectMilestoneTransitionReworkFindings(transition, metrics, options)` — one transition.
- `buildMilestoneFlowReworkFinding(params)` — one normalized finding.
- `determineMilestoneReworkType(segment)` / `determineMilestoneReworkTriggerType(segment)`.
- `validateMilestoneReworkDetectionInput(input)`.

Status/severity/confidence/evidence-merge use the shared advanced-detection
primitives (`determineAdvancedFindingStatus` / `…Severity` / `…Confidence` /
`mergeAdvancedFindingEvidence`) — one source of truth, no duplication.

## Model

`MilestoneFlowReworkFinding` (defined in `advanced-detection-types.ts`):
`reworkType` ∈ `{task_reopened, approval_rejection, decision_reversal, scope_change,
requirement_change, defect_or_quality_failure, deliverable_revision,
milestone_regression, unknown}`; `triggerType` ∈ `{reopened_work, rejected_approval,
reversed_decision, changed_scope, raised_defect, revised_document, reopened_milestone,
unknown}`; plus status, severity, confidence, startedAt/endedAt, durationMs, isOpen,
sourceSegmentIds, sourceEventIds, evidenceRefs, metricRefs, semanticCategories,
affectedEntityRefs, calculationNotes, warnings.

## Behavior (unchanged from Task 6)

- A **`rework` segment** is definite rework; a non-rework segment with
  `scope_change` / `quality` friction is **possible** rework (status `possible`).
- **Type** from the segment's semantic categories / friction (Task 2/3) — events are
  never re-interpreted.
- **Duration** is READ from Task 4 metrics (`segmentDurations`); no `Date.now()`;
  open durations stay null (replay-stable).
- **Status:** open (open-ended / no resolution) · resolved (closing evidence) ·
  partial (evidence but unknown duration) · unknown (no evidence).
- **Severity** is detection severity, **not** health.
- **Confidence** capped by weakest/backfilled evidence + unknown duration.
- Engine `buildMilestoneFlowProjection` populates `reworkFindingsByTransition`.

## Intentionally NOT here

Bottleneck detection, constraint propagation, final transition health, Isabella NL,
and UI. (Bottleneck + propagation already exist from Task 6; final health + Isabella
packets are later tasks.)
