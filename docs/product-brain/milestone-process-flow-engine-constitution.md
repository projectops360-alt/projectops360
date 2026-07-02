# Milestone Process Flow Engine — Constitution (Phase 3)

> **Constitutional status.** This document is the source of truth for the Milestone
> Process Flow Engine (**MPF Engine**). It overrides chat memory and prompts
> (ADR-007). Corrected behavior must remain corrected; approved architecture is
> **extended, never replaced**. The engine is not a UI feature, a Gantt chart, or a
> status dashboard — it is an **execution-intelligence engine** that derives how
> work flows *between* milestones from the Project Event Graph.

Phase 3, Task 1 delivers the **architecture + contract foundation** in code
(`src/lib/milestone-flow/`). This document is its canonical companion.

---

## 1. Purpose

The MPF Engine answers one question:

> **How does execution actually flow between project milestones, and what is helping or hurting that flow?**

It must eventually reveal, with evidence: waiting time, decision delays, approval
delays, rework loops, bottlenecks, constraint propagation, transition health, and
root-cause structure — turning immutable event history into execution understanding.

## 2. Position in the approved architecture

```
Canonical Domain
  → Project Event Graph            (project_event_log — Phase 2, immutable)
    → Milestone Process Flow Engine (derives milestone-flow projections)   ← this
      → Living Graph / PM Dashboard / PMO Dashboard / Isabella / Process Intelligence
```

The engine sits **between** the Project Event Graph and future visualization /
intelligence layers. It must not bypass the event graph, must not modify canonical
truth, and must not replace the Projection Engine.

## 3. Engine First Principle™

ProjectOps360° builds **engines**, not isolated features. The engine is defined
first (purpose, responsibilities, inputs, outputs, contracts, owners, producers,
consumers, observability, security, AI integration, roadmap). UI comes **after**
and only as a consumer.

## 4. Canonical truth boundaries

The engine **owns** derived milestone-flow intelligence only: flow interpretations,
transition health, flow segments, waiting-time calculations, bottleneck
classifications, constraint-propagation interpretations, and MPF-scoped evidence
packets / Living-Graph structures.

It **must never** mutate: canonical project/milestone/task/risk/decision/approval
records, immutable event history (`project_event_log`), `process_nodes`, or
`process_edges`. In code this is enforced by keeping the engine a pure consumer:
it accepts read-only `MilestoneFlowEventRef` / `MilestoneFlowMilestoneRef` values
and imports no write path (guarded by test `PEG-MPF-FOUNDATION`).

## 5. Inputs

- **Project scope** (`MilestoneFlowProjectScope`) — org/project/portfolio/program ids.
- **Canonical milestones** (`MilestoneFlowMilestoneRef[]`) — planned/forecast/actual
  dates, owner, status, predecessor.
- **Project Event Graph events** (`MilestoneFlowEventRef[]`) — read-only projection
  of `project_event_log` rows, in occurrence order, with provenance
  (`lifecycleClass`, `confidence`, `isCompensatingEvent`).
- **Configuration** (`MilestoneFlowEngineConfig`) — versioned thresholds/calendar.
- **Access context** (`MilestoneFlowAccessContext`) — RBAC scope + authorized ids.

## 6. Outputs

- **`MilestoneFlowProjection`** — the primary derived output: transitions, per-
  transition metrics + health, bottlenecks, constraint propagations, data-quality
  flags, and an observability run summary.
- **Transition health summaries**, **evidence packets**, **Isabella evidence
  packets**, **Living Graph consumer model**, **run summary**.

Every derived output carries **evidence refs** and a **confidence** level.

## 7. Core concepts

Milestone · Milestone Transition (the execution corridor between two milestones) ·
Flow Segment (`active_work | waiting | blocked | decision_delay | approval_delay |
rework | handoff | review | external_constraint | unknown`) · Waiting Time ·
Decision Delay · Approval Delay · Rework · Bottleneck · Constraint Propagation ·
Transition Health.

## 8. Responsibilities / Non-responsibilities

**Responsible for** (future tasks): identifying transitions, segmenting flow,
computing metrics, detecting decision/approval delays + rework + bottlenecks,
constraint propagation, transition health, evidence packets, Living-Graph/Isabella
structures, replay, observability, RBAC-safe aggregation.

**Not responsible for** (must never do): replacing the Projection Engine / Living
Graph / Process Intelligence; owning any canonical status; mutating events,
`process_nodes`, or `process_edges`; hidden business logic in React; unexplained
health labels; Isabella claims without evidence; treating inference/prediction as
fact.

## 9. Producer / consumer model

**Producers** feeding the engine: canonical modules, Event Ingestion Service,
Historical Backfill Service, Scribe, task/decision/approval/risk/dependency
workflows. **Consumers** of engine output: Living Graph, PM/PMO dashboards,
Isabella, Process Intelligence, and future Projection Runtime / Time Machine /
Organizational Process DNA™ / Predictive Execution. **Contract rule:** consumers
must not duplicate MPF logic — they request engine output.

## 10. Event-first interpretation & evidence

Interpretations derive from **event evidence**, never UI state alone. Every derived
statement is classified: **fact / inference / prediction / recommendation /
uncertainty**, with **confidence** `high | medium | low | unknown`. Backfilled
(`SYNTHETIC_BACKFILL_EVENT`) evidence is capped below `high`. **Unknown is better
than false confidence** — an empty/insufficient input yields health `unknown` and
confidence `unknown`, never a fabricated conclusion.

## 11. Transition health model

`healthy · watch · degraded · blocked · at_risk · recovering · regressed · unknown`.
Health is always evidence-backed and never decorative. Default = `unknown`.

## 12. Flow friction taxonomy

`decision · approval · dependency · resource · ownership · requirement_clarity ·
scope_change · quality · rework · communication · handoff · procurement ·
client_response · external_constraint · regulatory · calendar_availability ·
unknown`. Extensible per project type / organization.

## 13. Isabella integration contract

Isabella is an **evidence consumer**. She receives an
`IsabellaMilestoneFlowEvidencePacket` with a five-slot `ExplanationFrame`
(fact/inference/prediction/recommendation/uncertainty), recommended-action
categories, confidence, and uncertainty notes. She must **never invent** evidence
and must separate fact from inference from prediction. Natural-language responses
are not generated by the engine.

## 14. Living Graph integration contract

The Living Graph **consumes** `LivingGraphMilestoneFlowModel` (milestone nodes,
transition edges, flow-segment view models, health, evidence drill-down refs,
constraint-propagation refs). The model is **pure data** — no layout math, no UI,
no MPF logic. The visual layer is replaceable without touching the engine.

## 15. PM / PMO integration expectations

**PM:** tactical, project-specific — what blocks the next milestone, where we wait,
which decision/approval delays progress, what rework occurred, what changed.
**PMO:** portfolio-level aggregates — which projects have degraded transitions,
which teams/gate types are systemically slow, which patterns should become lessons.
Aggregation must not hide evidence and must not leak unauthorized projects.

## 16. Observability requirements

Every run emits a `MilestoneFlowEngineRunSummary`: runId, engine/config version,
org/project id, input/included/excluded event counts + exclusion reasons,
transition/segment/bottleneck/health counts, warning/error counts, start/complete
timestamps, durationMs, warnings, errors. Supports debugging, replay validation,
quality reporting, admin inspection, and Isabella evidence traceability.

## 17. Security / RBAC requirements

Deny-by-default (`resolveMilestoneFlowAccess`). Absolute tenant isolation — an
access context for org A can never be granted a scope in org B. PM sees only
authorized projects; PMO may aggregate authorized org/portfolio/program/project;
admin may inspect runs only with an explicit `canInspectRuns` grant. Evidence
packets and aggregates must never include out-of-scope data
(`filterAuthorizedProjectIds`). Real RBAC row resolution stays in the existing
auth/RLS layer; this module is the engine-side gate future tasks wire data into.

## 18. Replayability requirements

Given the same event log and the same engine + config version, the engine must
produce the same result. Backfill / compensating-event provenance is preserved.
`REPLAY_INCOMPATIBILITY` is a first-class typed error.

## 19. Regression protection requirements

The foundation is protected by
`src/lib/milestone-flow/__tests__/milestone-flow-engine-contracts.test.ts`
(map id **PEG-MPF-FOUNDATION**). Future algorithm tasks add tests for transition
identification, metrics, delay/rework detection, bottlenecks, propagation, health,
evidence packets, RBAC scope, backfill/compensating handling, and replay
determinism before any behavior is considered closed.

## 20. Future roadmap alignment

MPF outputs are kept **projection-ready, replay-ready, and pattern-ready** for the
future Projection Engine Runtime, Time Machine, Organizational Process DNA™, and
Predictive Execution Engine. Phase 3 does not build those; it must not preclude them.

---

## Implementation sequence (Phase 3)

1. **Constitution** *(this document + Task 1 code foundation)* — **done**.
2. Map Project Event Graph events → milestone-flow semantics *(next task)*.
3. Transition Builder → 4. Flow Segment Builder → 5. Metrics Calculator →
   6. Health Classifier → 7. Evidence Packet Builder → 8. Living Graph consumer →
   9. PM/PMO consumption → 10. Audit & regression consolidation.

**Final rule:** Corrected behavior must remain corrected. Extend the platform. Do
not replace it. Build the engine foundation first.
