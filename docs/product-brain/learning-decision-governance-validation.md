# Learning and decision governance validation

**Task:** P5-T3  
**Status:** Implemented

The Phase 5 governance suite protects two boundaries: unreliable history cannot become
organizational learning, and advisory intelligence cannot become an untraceable or automatic
decision.

## Bad-learning controls

- Reject inactive or weak Knowledge Objects, synthetic or incomplete histories, failed event
  integrity, unknown outcomes, missing evidence and cross-organization observations.
- Require at least three cases across two projects, adequate support, bounded contradiction and
  recent evidence.
- Require separate human owner/admin approvals for validated learning and practice promotion.

## Decision controls

- Require an evidence-backed Isabella recommendation and at least two alternatives.
- Accept only validated learning or practice as organizational support.
- Require a canonical decision, human owner/admin, rationale and selected alternative.
- Preserve append-only proposal and review trace; never execute the selected action.

The executable suites are `bad-learning-prevention.test.ts` and
`traceability-controls.test.ts`.
