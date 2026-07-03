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

## Milestone Transition & Flow Segment Builder (Task 3 — added)

`transition-builder-types.ts`, `flow-segment-builder.ts`, and
`transition-builder.ts` build the first executable MPF **structure**: milestone
transition corridors (deterministic consecutive pairs from ordered milestones),
explicit event→corridor assignment (with unassigned reporting), and ordered flow
segments derived from Task 2 semantics — with evidence refs, provenance-preserving
confidence, and a **preliminary structural state** (`pending/active/completed/
regressed/unknown`, not final health). The engine's `buildTransitionModel` /
`buildFlowSegments` now delegate here, and `buildMilestoneFlowProjection` populates
`transitions` + observability counts. Metrics and final health stay deferred.
Additive-only type extensions: `MilestoneFlowEventRef.milestoneId?` and four builder
counts on the run summary. Test id **PEG-MPF-TRANSITION-SEGMENT-BUILDER**. Full
detail: [milestone-process-flow-transition-builder.md](./milestone-process-flow-transition-builder.md).
The **Metrics Calculator** (next task) consumes segment `startedAt`/`endedAt`/`type`.

## Milestone Flow Metrics Calculator (Task 4 — added)

`metrics-calculator-types.ts` and `metrics-calculator.ts` compute **measurement
only** from Task 3 transitions + segments: planned/actual/forecast/elapsed
durations, per-segment durations, flow-time buckets by segment type, composition
percentages (denominator = `totalKnownSegmentTimeMs`), flow efficiency
(`activeWork / totalKnown`), segment counters, provenance-aware confidence, and
deduped evidence. **Replay-stable:** open durations are computed only against an
explicit `analysisAsOf` — no `Date.now()` anywhere; the engine projection passes
no `analysisAsOf`, so it is deterministic. `buildMilestoneFlowProjection` now
populates `metricsByTransition`; `calculateFlowMetrics` delegates to the calculator
(no longer throws). Final **health** and bottlenecks stay deferred
(`classifyTransitionHealth` still unsupported; `escalationCount` /
`unresolvedConstraintCount` left null). Additive-only: `MilestoneFlowTransitionMetrics`
extends the Task 1 `MilestoneFlowMetrics`; five optional metrics counts on the run
summary. Test id **PEG-MPF-FLOW-METRICS**. Full detail:
[milestone-process-flow-metrics-calculator.md](./milestone-process-flow-metrics-calculator.md).
Next task: **Detect Blockers, Waiting Time, Decision Delays & Approval Delays.**

## Delay Detector (Task 5 — added)

`delay-detector-types.ts`, `delay-detector.ts`, and `blocker-detector.ts` (re-export)
are the first **detection layer**: structured findings for `blocker`,
`waiting_time`, `decision_delay`, and `approval_delay` from Task 3 segments + Task 4
metric durations (**read, never recomputed** — no `Date.now()`). Each finding
carries status (open/resolved/partial/unknown), **detection severity** (explicitly
NOT health), provenance-aware confidence, deduped evidence, and metric refs.
Unknown segments are skipped with a warning; missing metrics → partial + warning
(never a crash). `buildMilestoneFlowProjection` now populates the optional
`findingsByTransition` + detection observability counts. Final **health** and
**bottlenecks** stay deferred (`classifyTransitionHealth` still unsupported).
Additive-only: optional `MilestoneFlowProjection.findingsByTransition` (type-only
import to avoid a cycle) + nine optional finding counts on the run summary.
**Task 4 pre-flight verified:** unknown segments remain represented
(`unknownTimeMs`/`unknownSegmentCount`); efficiency denominator unchanged. Test id
**PEG-MPF-DELAY-DETECTION**. Full detail:
[milestone-process-flow-delay-detector.md](./milestone-process-flow-delay-detector.md).
Next task: **Detect Rework, Bottlenecks & Constraint Propagation.**

## Transition Health & Isabella Evidence Packets (Task 7 — added)

`transition-health-types.ts`, `transition-health-classifier.ts`,
`isabella-evidence-packet-types.ts`, and `isabella-evidence-packet-builder.ts`
converge the engine: **evidence-backed transition health** (conservative ladder,
machine reason codes, confidence capping, `unknown` on weak evidence) + **Isabella
evidence packets** (facts require evidence; predictions never facts; recommendations
are action categories; explicit uncertainties; allowed/disallowed claim guardrails —
a fallback dependency bottleneck is never a confirmed cause). **No LLM/AI call, no
natural language, no UI, no `Date.now()`.** `buildMilestoneFlowProjection` now
populates `healthByTransition` (Task 1 base contract) + optional
`healthSummariesByTransition` + `isabellaEvidencePacketsByTransition`, and
`classifyTransitionHealth` **delegates to the classifier (no longer throws)** — every
MPF engine contract method is now implemented. Additive-only: two optional projection
fields (type-only imports) + six optional health counts on the run summary. Test id
**PEG-MPF-TRANSITION-HEALTH-ISABELLA-EVIDENCE**. Full detail:
[milestone-process-flow-transition-health.md](./milestone-process-flow-transition-health.md).
Next task: **Build Milestone Process Flow Living Graph UI Consumer.**

## Advanced Detectors (Task 6 — added)

`advanced-detection-types.ts`, `advanced-detection-shared.ts`, `rework-detector.ts`,
`bottleneck-detector.ts`, `constraint-propagation-detector.ts`, and
`advanced-detection.ts` (orchestrator) are the second **detection layer**: rework
findings (definite from `rework` segments; possible from scope/quality friction),
bottleneck **candidates** (evidence-gated — **not every delay** — via conservative
criteria: long duration / repeated occurrence / high-severity source / open-long /
significant non-trivial time-share), and **conservative** constraint propagation
(shared-evidence across transitions, or sequential unresolved → `possible`/low;
**never fabricated** without linkage). Durations are **read** from Task 4 (no
`Date.now()`); bottleneck detection consumes Task 5 findings. Severity is detection
severity, **not health**. `buildMilestoneFlowProjection` now populates the optional
`reworkFindingsByTransition` / `bottleneckFindingsByTransition` /
`constraintPropagationFindings` + observability. Final **health** stays deferred
(`classifyTransitionHealth` still unsupported); no Isabella NL, no UI. Additive-only:
three optional projection fields (type-only imports to avoid a cycle) + nine optional
advanced counts on the run summary. Test id **PEG-MPF-ADVANCED-DETECTION**. Full
detail: [milestone-process-flow-advanced-detectors.md](./milestone-process-flow-advanced-detectors.md).
Next task: **Generate Transition Health & Isabella Evidence Packets.**

## Living Graph UI Consumer (Task 8 — added)

The first UI surface, and a **pure consumer**: `src/lib/milestone-flow-ui/`
(read-only projection adapter + pure display selectors) and
`src/components/milestone-flow/` render the full projection at
`/projects/[projectId]/execution-map/milestone-flow` (sibling of the Living
Graph subpage, linked from the Execution Map tab bar). Transitions, segments,
metrics, delay/rework/bottleneck/propagation findings, transition health, and
the Isabella evidence packet are **displayed exactly as the engine derived
them** — no rebuild, no recalculation, no reclassification, no re-detection, no
Isabella language, no LLM, no Projection Engine Runtime, no canonical mutation
(`project_event_log` SELECT-only; `process_nodes`/`process_edges` untouched).
Bottlenecks are always **candidates**, `possible` stays possible, the fallback
dependency cause renders as **ambiguous — never confirmed fact**, predictions are
visually distinct from facts, recommendations are action categories only,
allowed/disallowed claims stay inspectable, and unknown values render as
"Unknown". Deny-by-default RBAC at the adapter + engine gate; unauthorized →
safe state with no data. i18n: full EN/ES `milestoneFlow` namespace (UX-012).
Test id **PEG-MPF-LIVING-GRAPH-UI-CONSUMER**. Full detail:
[milestone-process-flow-living-graph-ui.md](./milestone-process-flow-living-graph-ui.md).
Next: **Phase 3 Final Audit and Release Readiness Review.**

## Rework Detector standalone API (Task 6A — added)

Task 6A re-scoped rework as a standalone concern. Rework detection was **already
delivered** by Task 6; rather than duplicate it, Task 6A exposes the rework-only
public entry point `detectMilestoneFlowReworkFindings(input)` (+
`determineMilestoneReworkTriggerType`, `validateMilestoneReworkDetectionInput`) in
`rework-detector.ts` and pins it with its own regression
(**PEG-MPF-REWORK-DETECTION**). Status/severity/confidence/evidence use the shared
advanced-detection primitives — one implementation, no duplication. Bottleneck and
constraint propagation from Task 6 are unchanged. Detail:
[milestone-process-flow-rework-detector.md](./milestone-process-flow-rework-detector.md).
