# Milestone Process Flow — Event Semantics Layer (Phase 3, Task 2)

> Companion to the [MPF Engine Constitution](./milestone-process-flow-engine-constitution.md)
> and [Architecture Note](./milestone-process-flow-engine-architecture.md). Task 2
> is the **semantic interpretation layer only** — no transition builder, no
> metrics, no health classification, no UI. It teaches the MPF Engine what an
> existing Project Event Graph event *means* for milestone flow.

## Why this layer exists

The MPF Engine derives flow intelligence from immutable events. Before it can
build transitions or detect delays/rework, it needs a **deterministic, single**
answer to: *"what does this event mean for milestone flow?"* This layer provides
that mapping so every future builder (Transition, Segment, Metrics, Delay, Rework,
Bottleneck, Constraint, Health, Isabella, Living Graph) reads **one** interpretation
instead of re-deriving its own.

## It consumes the Canonical Event Taxonomy — it does not replace it

Every mapping key is a **real registered canonical event** from
`src/lib/events/registry.ts`. No parallel taxonomy is invented. Coverage is
enforced by `validateMilestoneFlowEventSemanticsMap()`, which fails if a registered
event is unmapped, a phantom (unregistered) entry appears, or an
`EPHEMERAL_EXCLUDED` telemetry type leaks in. Test **PEG-MPF-EVENT-SEMANTICS**
asserts `ok === true`, so the map cannot silently fall out of sync as the taxonomy
grows.

## Files

| File | Responsibility |
|---|---|
| `src/lib/milestone-flow/event-semantics-types.ts` | Signal vocabularies (semantic category, transition signal, health signal, rework signal, constraint signal, confidence impact, provenance class/handling, replay behavior) + `MilestoneFlowEventSemantics`, `MilestoneFlowProvenanceClassification`, `MilestoneFlowEventClassification`, validation type. Flow-segment / friction / bottleneck / evidence types are **reused** from Task 1. |
| `src/lib/milestone-flow/event-semantics-map.ts` | `MILESTONE_FLOW_EVENT_SEMANTICS` — every canonical event → its flow meaning (deterministic, provenance-agnostic). |
| `src/lib/milestone-flow/event-semantics.ts` | Pure functions: lookup, `classifyMilestoneFlowEvent`, provenance normalization, evidence-ref builder, transition/blocking/unblocking/rework predicates, coverage validation. |

## Semantic categories

`milestone · phase · work · decision · approval · dependency · risk · issue ·
blocker · requirement · scope · deliverable · document · meeting · communication ·
note · scribe · cost · resource · quality · closeout · lessons · ai · isabella ·
system · portfolio · project · backfill · compensating · unknown`.

## Transition signals

`opens_transition · progresses_transition · closes_transition · reopens_transition ·
pauses_transition · resumes_transition · blocks_transition · unblocks_transition ·
regresses_transition · no_transition_signal · unknown`.

## Flow-segment signals

Reused from Task 1 (never redefined): `active_work · waiting · blocked ·
decision_delay · approval_delay · rework · handoff · review · external_constraint ·
unknown`.

## Health / rework / constraint signals

- **Health (directional only, NOT a final status):** `improves_health ·
  degrades_health · blocks_health · increases_risk · indicates_recovery ·
  indicates_regression · neutral · unknown`.
- **Rework:** `starts_rework · continues_rework · ends_rework ·
  indicates_possible_rework · no_rework_signal · unknown`.
- **Constraint propagation:** `creates_constraint · propagates_constraint ·
  resolves_constraint · intensifies_constraint · reduces_constraint ·
  no_constraint_signal · unknown`.

## How provenance affects confidence

`classifyMilestoneFlowEvent` resolves confidence as the **weakest** of three caps:
the event's own numeric confidence (`confidenceFromEvent`), the semantic cap
(`confidenceImpact`), and the provenance cap:

- **Native** event → eligible for `high`.
- **Backfilled** (`SYNTHETIC_BACKFILL_EVENT`, confidence ≥ 0.7) → capped `medium`;
  weaker/missing → classified **inferred**, capped `low`. Never `high`.
- **Derived** canonical events (e.g. `CostVarianceDetected`,
  `MilestoneForecastChanged`) → `evidenceKind: inference`, capped `medium`.
- **Compensating** events → `compensationAware: true`,
  `preservesOriginalEvidence: true`; interpreted as corrections, evidence ref
  carries a correction note. Never erase the original event's evidence.
- **Unknown** provenance → `unknown`.

Backfilled and compensating events are `replaySensitive`.

## Notable taxonomy mappings (real names)

- **Blockers** are `TaskBlocked` / `TaskUnblocked` (no separate `Blocker*` type).
- **Dependencies** are `TaskDependencyAdded` / `TaskDependencyRemoved`.
- **Decision "requested/changed"** → `DecisionProposed` / `DecisionReversed`.
- **Approval "delayed"** → closest is `ApprovalExpired`.
- **Deliverables** → `DocumentUploaded` / `DocumentApproved` (accepted);
  **"deliverable rejected"** → closest is `DefectRaised` (quality/rework).

## Intentionally NOT present in the current taxonomy

These conceptual families from the task brief have **no dedicated canonical event**
today, so they were **not invented**:

- `RequirementChanged` — only `ScopeChanged` exists (scope friction + possible rework).
- Dedicated `DependencyBlocked` — waiting-on-dependency is a status dimension, not an event.
- `DeliverableRejected` — approximated by `DefectRaised` / `DrawingRevised`.
- Scribe / note capture (`NoteCaptured`, `VoiceNoteCaptured`, `ScribeTaskGenerated`)
  — Scribe creates entities but emits no dedicated canonical event yet. The `note`
  and `scribe` categories exist in the vocabulary for a future mapping.

Backfill and compensation are **provenance flags** on any event
(`lifecycleClass` / `isCompensatingEvent`), plus the `BackfillCompleted` audit
event — not a separate event family.

## Intentionally NOT implemented in Task 2

No final health status, no durations/metrics, no final bottleneck decisions (only
**candidates**), no constraint-propagation graph, no transition building, no
natural-language Isabella output, no UI, no DB writes.

## How Task 3 should consume this

**Task 3 — "Build Milestone Transition & Flow Segment Builder."** Walk the ordered
event stream and use these predicates/classifications to cut transitions and
segments: `isMilestoneTransitionOpeningEvent` / `...ClosingEvent` bound a corridor;
`flowSegmentType` from each event's classification drives segment cuts;
`isMilestoneFlowBlockingEvent` / `...UnblockingEvent` open/close blocked/waiting
segments; `isMilestoneFlowReworkEvent` marks rework loops; attach evidence via
`buildMilestoneFlowEvidenceRefFromEvent` and carry `classifyMilestoneFlowEvent().confidence`
forward. The builder consumes this layer — it must not re-derive event meanings.
