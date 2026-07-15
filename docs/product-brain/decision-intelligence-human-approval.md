# Decision intelligence with human approval

**Task:** P5-T2  
**Status:** Implemented

Decision Intelligence converts an evidence-backed Isabella recommendation into a governed
proposal. It does not create a second decision system: every review must attach to the existing
canonical `decisions` record.

## Contract

- A proposal requires complete evidence and an advisory recommendation.
- Validated organizational learning may support a proposal; unvalidated learning is ignored.
- Every proposal contains at least two alternatives and explicit tradeoffs.
- Isabella, system actors and ordinary members cannot approve a decision.
- Acceptance requires a human organization owner/admin, rationale, a selected alternative and
  a canonical decision identifier.
- No proposal or review is executable. Operational changes remain separate human actions.

## Trace

The immutable review trace preserves the recommendation, validated learning references,
evidence references, proposal fingerprint, selected alternative, reviewer, rationale and time.
