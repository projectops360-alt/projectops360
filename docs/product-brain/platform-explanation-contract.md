# Platform Explanation Contract

## Scope

P8-T2C defines the data contract used to explain facts, inferences, recommendations, predictions, and uncertainty. It deliberately excludes the visual explanation interface in P8-T2D.

## Required controls

- Every non-uncertainty claim cites project-scoped evidence.
- Confidence contains both a bounded value and an explicit basis.
- Freshness is computed from the newest evidence and a declared validity window.
- Inferences, recommendations, predictions, and uncertainty disclose limitations.
- Recommendations and predictions always require human approval and are never directly executable.
- Predictions require a horizon and calibration reference. Until P6 forecasting calibration is complete, uncalibrated prediction packages are rejected.

## Realistic validation scenario

The commissioning recommendation keeps integrated systems testing on hold until the Safety Lead approves the BMS alarm verification report. Its evidence chain combines the Owner Commissioning Lead email with the current project status record, exposes the evidence age, and leaves the final decision with an authorized human.

## Deferred interface

`visualHooks` provides stable labels and counts for a future interface. P8-T2D remains deferred until the Phase 7 confidence and trust framework is available.
