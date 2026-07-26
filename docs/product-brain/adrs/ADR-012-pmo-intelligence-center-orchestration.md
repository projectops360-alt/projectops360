# ADR-012 — Dashboard 3 orchestrates; it does not recompute

**Status:** Accepted (Milestone 1) · **Date:** 2026-07-25
**Related:** CAP-048, [parity matrix](../capabilities/CAP-048-phase2-functional-parity-matrix.md), ADR-002 (Living Graph primary surface), ADR-006 / REG-010 (single metric source)

## Context

Dashboard 3 must let a PMO understand portfolio health, process, risk, finance,
resources, dependencies and benefits from one place, with evidence, and act on
what it finds — a superset of what Dashboards 1 and 2 already do.

The obvious implementation is to give Dashboard 3 its own read model that
queries the same tables and computes the same figures. It is also the one that
fails. The product's documented recurring failure is re-breaking solved
problems, and REG-010 exists precisely because metrics had drifted between
surfaces before. A second definition of "portfolio health" would not announce
itself; it would appear months later as two screens disagreeing, with no way to
tell which is right.

The audit found that almost everything needed already exists and is
deterministic: health with six documented formulas, the PMO focus rules, the CPM
engine, the flow projection, the finance cockpit, the capacity engine, six
Isabella rules with mandatory evidence, and a feedback action that already
persists to `audit_logs`.

## Decision

**Dashboard 3 is an orchestration layer. It computes no metric of its own.**

`PmoIntelligenceReadModel` composes the existing services, normalises their
output into graph contracts, and correlates them under one shared scope. It
calls `getCommandCenterSummary`, `loadPmoPiFlowModel`, `loadPmoPiFinanceOverlay`,
`loadPmoPiOverlays`, `buildInsights` and `loadPortfolioGraph`. It defines no
formula and issues no query that duplicates one of theirs.

Consequences of that stance, stated so they are not negotiable later:

1. A number shown in Dashboard 3 **must be traceable to the function that
   produced it** in Dashboard 1 or 2. Tests assert equality against the source
   function, not against a literal.
2. Commands are **re-exported, never reimplemented**. Accept / reject / defer
   call `recordInsightFeedbackAction`. Import calls the existing actions.
   Reports call `runReport`. Critical path calls `recalculateCriticalPath`.
3. A new metric requires a row in the parity matrix and an amendment here.
4. Where a capability does not exist — portfolios, programs, benefits, blocked
   days — Dashboard 3 reports its absence. It never fills the gap with a
   plausible number.
5. The two capacity engines stay separate and labelled. Hours and headcount are
   not the same unit and are never summed.
6. Realtime uses the LGRE delta-sync engine, not a second subscription, because
   polling plus `router.refresh()` destroys layout and viewport.

## Alternatives rejected

**A second independent read model.** Fastest to write, and the direct cause of
metric drift. Rejected on the strength of REG-010.

**Embedding the existing dashboards (iframe / route composition).** Preserves
correctness but produces disconnected panels: a filter in one cannot move the
graph in another, which is the entire point of Dashboard 3.

**Refactoring Dashboards 1 and 2 into shared primitives first.** Architecturally
cleanest, and it changes two working, protected surfaces before the third proves
its shape. Deferred: extraction happens per-capability, only when needed, and
only behind characterization tests.

## Consequences

Positive: one source of truth per metric; Dashboard 3 gains capability as the
others improve; the blast radius of Phase 2 is additive.

Negative: Dashboard 3 inherits its sources' limitations — including D1's
heuristic resource utilisation, which must be labelled or replaced by the real
engine. Composing several services per request costs more than one tailored
query; mitigated by parallel reads, scope caching and subgraph windowing, and
measured in Milestone 7.

Neutral: the layer is thin by construction. Most Phase 2 work is state
coordination and projection, not calculation.
