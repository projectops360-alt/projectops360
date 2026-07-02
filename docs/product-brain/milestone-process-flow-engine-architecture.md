# Milestone Process Flow Engine — Architecture Note (Phase 3, Task 1)

> Companion to the [MPF Engine Constitution](./milestone-process-flow-engine-constitution.md).
> Task 1 is **architecture + contracts only** — no UI, no final algorithms, no
> Projection Engine Runtime. It establishes the canonical foundation every future
> Phase 3 task consumes.

## Files created (`src/lib/milestone-flow/`)

| File | Responsibility |
|---|---|
| `constants.ts` | Frozen taxonomies (segments, health, friction, bottleneck, propagation, evidence kinds/confidence, data-quality flags, access scopes, error codes) + `MPF_ENGINE_VERSION` / `MPF_CONFIG_VERSION`. Every union type is derived from these arrays (one source of truth, mirrors `events/registry.ts`). |
| `types.ts` | The full derived-intelligence type model: scope, read-only `MilestoneFlowEventRef` / `MilestoneFlowMilestoneRef`, transitions, segments, metrics, health, friction/bottlenecks, constraint propagation, evidence, Isabella packet, Living Graph consumer model, observability, security, and the primary `MilestoneFlowProjection`. |
| `errors.ts` | `MpfError` base + typed subclasses for the 9 failure codes; `isMpfError` guard. |
| `security.ts` | `resolveMilestoneFlowAccess` (deny-by-default, absolute tenant isolation), `canInspectMilestoneFlowRuns`, `filterAuthorizedProjectIds`. |
| `evidence.ts` | Evidence-ref builders, `confidenceFromEvent` (backfill capped below high), `aggregateConfidence` (weakest-supporting), `hasGroundingFact`. |
| `observability.ts` | `openRunContext` → `closeRunSummary` producing the immutable run summary; `newRunId`. |
| `contracts.ts` | The 9 stable contracts: engine, input, output, evidence, health, security, observability, Living Graph, Isabella. Plus `MilestoneFlowEngineConfig` and `MPF_CONTRACTS` registry. |
| `engine.ts` | `MilestoneProcessFlowEngineStub` + `createMilestoneProcessFlowEngine` factory; `validateInputContract`; thin contract implementations. Returns a valid EMPTY projection; algorithmic methods throw `MpfUnsupportedOperationError`. |
| `index.ts` | Barrel (`export *`). |
| `__tests__/milestone-flow-engine-contracts.test.ts` | 22 foundation guards (map id **PEG-MPF-FOUNDATION**). |

## Contracts introduced

`MilestoneProcessFlowEngine`, `MilestoneFlowInputContract`,
`MilestoneFlowOutputContract`, `MilestoneFlowEvidenceContract`,
`MilestoneFlowHealthContract`, `MilestoneFlowSecurityContract`,
`MilestoneFlowObservabilityContract`, `MilestoneFlowLivingGraphContract`,
`MilestoneFlowIsabellaContract`.

## How future tasks consume this

- **Read events read-only.** Load `project_event_log` rows into
  `MilestoneFlowEventRef[]` at the call site; never pass the DB client into the engine.
- **Implement, don't replace.** Fill the `MilestoneProcessFlowEngine` algorithmic
  methods (currently `throw MpfUnsupportedOperationError`). Keep the stub's honest
  defaults: no evidence ⇒ health `unknown`, confidence `unknown`.
- **Attach evidence to every conclusion** via `evidence.ts` helpers; gate publication
  on `requireEvidence` / `hasGroundingFact`.
- **Authorize first.** Call `resolveMilestoneFlowAccess` before deriving anything;
  redact aggregates with `filterAuthorizedProjectIds`.
- **Always emit a run summary** via `openRunContext` / `closeRunSummary`.
- **Consumers** (Living Graph, Isabella, dashboards) import the model/packet types
  and call the contract methods — they must not re-derive flow logic.

## Intentionally NOT implemented (Task 1)

Transition identification, flow segmentation, metrics calculation, decision/approval
delay detection, rework detection, bottleneck classification, constraint
propagation, health scoring, Projection Engine Runtime, and all UI. The engine
returns empty-but-valid structures and discloses "not interpreted" as an
observability warning rather than fabricating output.

## How Task 2 should extend this

**Task 2 — "Map Project Event Graph Events to Milestone Flow Semantics."** Define a
deterministic mapping from the Canonical Event Taxonomy (`events/registry.ts`) to
flow meanings (which events open/close a transition; which imply
waiting/blocked/decision-delay/approval-delay/rework segments; how compensating and
backfilled events are weighted). Deliver it as a pure, tested mapping table that the
Transition Builder (Task 3) consumes — extending, not replacing, this foundation.

## Event Semantics layer (Task 2 — added)

The semantic interpretation layer now lives in `event-semantics-types.ts`,
`event-semantics-map.ts`, and `event-semantics.ts`. It maps **every** registered
canonical event to its milestone-flow meaning (transition/segment/health/rework/
constraint signals + provenance-aware confidence), producing only facts and
inferences. Coverage is enforced by `validateMilestoneFlowEventSemanticsMap()`
(test id **PEG-MPF-EVENT-SEMANTICS**). Full detail:
[milestone-process-flow-event-semantics.md](./milestone-process-flow-event-semantics.md).
The Transition & Flow Segment Builder (Task 3) consumes it and must not re-derive
event meanings.
