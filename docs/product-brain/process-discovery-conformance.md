# P4-T1 — Process Discovery and Conformance Analysis

## Scope

P4-T1 is implemented as four independent, deterministic capabilities over canonical business events:

1. **Taxonomy** classifies known task, milestone, dependency, responsibility, phase, risk, decision, approval and rework activities. Unknown activities remain visible as `other`; they are never silently normalized.
2. **Direct-follow and variants** group events by canonical `case_id`, order them by `sequence_number`, aggregate observed successors and identify exact path variants with stable identifiers, frequency and rework rate.
3. **Conformance** compares a case only when an explicit declared process model is supplied. It reports invalid starts/ends, illegal transitions and missing mandatory activities. Without a model, the engine returns no conformance result rather than inventing one.
4. **Temporal metrics** keep business time (`occurred_at`) separate from recording time (`recorded_at`). Cycle and recording span are independent. Waiting time is counted only from explicit wait-start/wait-end semantics; gaps are never assumed to be waiting.

## Boundaries

- Input is restricted to one organization and one project; mixed scope is rejected.
- Only non-compensating `BUSINESS_EVENT` records participate in discovery.
- The engine is pure and read-only. It does not mutate the event log, graph, Knowledge Objects or operational tables.
- The canonical-event adapter excludes incomplete records explicitly.
- Isabella receives sanitized aggregate counts for direct-follow relations, variants, measured cases and unknown activities. She does not receive raw payloads and cannot claim conformance without a declared model.

## Implementation

- `src/lib/process-mining/discovery/taxonomy.ts`
- `src/lib/process-mining/discovery/direct-follow.ts`
- `src/lib/process-mining/discovery/conformance.ts`
- `src/lib/process-mining/discovery/temporal-metrics.ts`
- `src/lib/process-mining/discovery/engine.ts`
- `src/lib/process-mining/discovery/canonical-event-adapter.ts`

## Verification

The focused suite proves deterministic ordering, taxonomy honesty, stable variants, declared-model deviations, temporal separation, explicit waiting, tenant/project isolation and canonical-event adaptation. Existing Task Process and Isabella Process Mining evidence tests protect compatibility.
