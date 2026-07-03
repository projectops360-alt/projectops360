# Transition Health & Isabella Evidence Packets (Phase 3, Task 7)

> Companion to the [MPF Engine Constitution](./milestone-process-flow-engine-constitution.md)
> and the Task 2–6A docs. Task 7 converges the whole engine: it classifies
> **evidence-backed transition health** and builds **Isabella evidence packets**.
> It is **not** UI, **not** an LLM/AI call, and **not** natural language.

## What it does

Consumes Task 3 segments + Task 4 metrics + Task 5 delay findings + Task 6 advanced
findings and produces, per transition: a conservative **health status** with
machine reason codes + confidence + evidence + recommended action category +
uncertainties, and a structured **Isabella evidence packet** with facts /
inferences / predictions / recommendations / uncertainties + allowed / disallowed
claim guardrails. Health is derived intelligence, never canonical truth.

## Files

| File | Responsibility |
|---|---|
| `transition-health-types.ts` | reason-code / action-category / uncertainty vocabularies, rich health summary type, inputs, metrics view. |
| `transition-health-classifier.ts` | the classifier (status, reason codes, confidence, action category, summary) + `toBaseTransitionHealth`. |
| `isabella-evidence-packet-types.ts` | `MilestoneFlowIsabellaEvidencePacket` + allowed/disallowed claims. |
| `isabella-evidence-packet-builder.ts` | facts/inferences/predictions/recommendations/uncertainties + claim guardrails + packet builders. |
| `engine.ts` (updated) | populates `healthByTransition` (base) + `healthSummariesByTransition` (rich) + `isabellaEvidencePacketsByTransition`; `classifyTransitionHealth` delegates (no longer throws). |

## Health model

Statuses (Task 1 vocabulary): `healthy · watch · degraded · blocked · at_risk ·
recovering · regressed · unknown`. **Conservative ladder** (worse operational
states win): open blocker → `blocked`; milestone regression → `regressed`;
structural bottleneck / high-severity delay / poor efficiency+friction → `at_risk`;
material friction (rework / bottleneck / poor efficiency / high unknown time /
high-severity delay) → `degraded`; resolved blocker on a completed transition →
`recovering`; minor resolved delay → `watch`; completed & clean → `healthy`;
insufficient evidence → `unknown`.

**Reason codes** (machine): `insufficient_evidence, no_material_friction,
minor_friction, waiting, blocker_open, blocker_resolved, decision_delay,
approval_delay, rework, bottleneck_candidate, propagation, poor_flow_efficiency,
high_unknown_time, missing_evidence, recovered, regressed, conflicting_evidence,
unknown`. **Action categories:** `resolve_blocker, escalate_risk,
investigate_friction, review_regression, monitor_recovery, monitor, gather_evidence,
none`.

**Confidence** starts from the weakest of metric confidence + evidence
`aggregateConfidence` and is **capped low** by missing evidence, high unknown time,
ambiguous blocker cause, possible propagation, backfilled-only evidence, or
conflicting signals; `unknown` when there is no evidence. A **fallback dependency
bottleneck** (Task 6's conservative default) is treated as an **ambiguous cause**
(`ambiguous_blocker_cause` uncertainty), never confirmed causal truth.

## Isabella evidence packet model

`MilestoneFlowIsabellaEvidencePacket`: facts (**require** an eventId/metricRef),
inferences (derived from reason codes, never facts), predictions (optional, kind
`prediction`, only for blocked/at_risk, **never** facts), recommendations (action
categories only — no prose), uncertainties (explicit), plus the Task 1 five-slot
`explanationFrame`, `allowedClaims`, and `disallowedClaims`.

- **allowedClaims** — only evidence-supported claim keys (e.g.
  `transition_has_open_blocker` when a blocker finding has evidence).
- **disallowedClaims** — always `confirmed_root_cause` + `guaranteed_milestone_slip`;
  plus `blocker_cause_is_dependency_confirmed` (ambiguous cause),
  `constraint_propagation_confirmed` (possible propagation),
  `any_causal_claim_without_evidence` (missing evidence), `any_health_conclusion`
  (unknown health). These are the guardrails that keep Isabella honest.

**No LLM/AI API is called and no natural language is produced** — only typed refs
and claim keys. Isabella (a later/UI layer) turns them into language within the
guardrails.

## Intentionally NOT here

Isabella natural-language responses, UI, Living Graph UI, Projection Runtime,
numeric health scoring (left null). No transitions/segments/metrics/findings are
rebuilt or recomputed; no `Date.now()`; no canonical mutation.

## How consumers use it

- **PM/PMO dashboards & Living Graph (future UI consumers)** read
  `healthByTransition` / `healthSummariesByTransition`.
- **Isabella** reads `isabellaEvidencePacketsByTransition`, asserting only
  `allowedClaims`, never `disallowedClaims`, and framing fact/inference/prediction/
  recommendation/uncertainty explicitly.
