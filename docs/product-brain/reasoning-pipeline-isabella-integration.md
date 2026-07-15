# P4-T2 — Governed Reasoning Pipeline and Isabella Integration

## Purpose

P4-T2 unifies the existing diagnosis, root-cause and recommendation engines behind one governed reasoning contract. Isabella remains the conversational interface, while deterministic engines and approved evidence remain the source of truth.

## Pipeline

Every governed answer records these stages:

1. `intent` — deterministic route selection.
2. `scope` — organization and project scope from the authorized context.
3. `evidence` — sanitized evidence packets only; raw rows and payloads are excluded.
4. `conflict_resolution` — conflicting statements from the same source are identified and dependent inferences are withheld.
5. `findings` — each finding declares claim type, confidence, evidence references and whether it is accepted or withheld.
6. `confidence` — evidence requirements from the Isabella claim policy determine whether a claim may survive.
7. `recommendation` — unsupported recommendations are removed; surviving recommendations remain advisory and require human approval.
8. `narration` — Isabella formats the governed result in the user's language.

## Hard Rules

- Cross-organization or cross-project evidence is rejected before reasoning.
- Confirmed explicit blockers may use the direct `blocker_claim` contract. Inferred root causes require the stricter multi-signal `root_cause_claim` contract.
- Unsupported causes are downgraded to `insufficient_evidence`; their evidence chains and recommendation handoffs are removed.
- Conflicting evidence never resolves by choosing the most convenient statement; the dependent inference is withheld.
- Recommendations without qualifying evidence are filtered and never executed automatically.
- Process Mining aggregates from P4-T1 are exposed as verified facts only when supported by verified canonical-event evidence and valid integrity.
- Temporal succession and variants remain observed process patterns, not causal proof.

## Output Contract

`IsabellaProcessIntelligenceResult.reasoningTrace` exposes contract version, route, scope, stage list, accepted/rejected evidence counts, conflicts, accepted/withheld findings, accepted recommendation count and limitations. The audit remains compact and contains no raw data.

## Implementation

- `src/lib/isabella/reasoning-pipeline/`
- `src/lib/isabella/process-intelligence-runtime/runtime.ts`
- `src/lib/isabella/process-intelligence-runtime/types.ts`
- `src/lib/isabella/process-intelligence/claim-policy.ts`

The implementation is pure and read-only. It adds no database, event-log or graph writes.
