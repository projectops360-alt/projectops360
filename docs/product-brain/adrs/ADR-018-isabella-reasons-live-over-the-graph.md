# ADR-018 — Isabella reasons live over the graph for status, and by retrieval for definitions

**Status:** Accepted
**Date:** 2026-07-26
**Pillars:** P1 · **Supersedes:** the open decision recorded as EKI §11 #6
**Related:** [ADR-005 Isabella is the primary AI interface](ADR-005-isabella-primary-ai-interface.md) ·
[ADR-016](ADR-016-trust-views-are-living-graph-lenses.md) ·
[ADR-017](ADR-017-trust-knowledge-in-retrieval-corpus.md)

---

## Context

Governance questions divide into kinds that require different mechanisms.
*What is a compensating control?* is definitional and stable. *Are we ready for a
Type II?* is a status question whose answer changes when evidence arrives or stops
arriving.

## Problem

Does Isabella traverse the graph live, or read a precomputed projection?

The question is a performance question on its surface and an honesty question
underneath. A cached status answer describes a state that may no longer hold, and
it describes it with full confidence.

## Decision drivers

| # | Driver |
|---|---|
| D1 | A status answer must reflect current state, not a recent state |
| D2 | Definitional answers are stable and expensive to recompute |
| D3 | Charter P2 — evidence over assumptions |
| D4 | Traversals must be reproducible (Charter P9) |
| D5 | Latency must not push the design toward caching status |

## Decision

**Split by question class, not by convenience.**

| Class | Mechanism | Why |
|---|---|---|
| Definitional | Retrieval over the corpus | Stable; the corpus is authoritative |
| Inventory | Live graph query | Changes when objects change |
| **Status** | **Live traversal with evidence aggregation. Never cached** | The answer is the current state |
| Causal | Live traversal | Structure changes rarely but the answer must be exact |
| Gap | Live absence query | A cached gap list is a stale gap list |
| Historical | Evidence record query | Immutable; freely cacheable |
| Hypothetical | Live dependency traversal | Depends on current structure |

**Derived figures are never read from the corpus.** A coverage percentage or a
control effectiveness stored as text is stale the moment evidence moves. If such
a figure appears in retrieved content, it is treated as illustrative and
recomputed before it is stated.

**Projections may exist for performance, with a constraint:** a projection may
serve a status answer only if it carries its computation timestamp **and the
answer states it**. An answer that cannot state its freshness must be computed
live.

## Detailed rationale

**Why status must not be cached, stated plainly.** The failure is not
staleness — it is *confident* staleness. A cached answer of "CC6.2 is satisfied"
is indistinguishable in tone from a live one, and the gap between them is exactly
where a control silently stopped operating. That gap is the failure mode the
entire EKI design exists to catch. Caching the answer would reintroduce it at the
last step.

**Why definitional questions use retrieval.** This is the correct role of
semantic search: **finding the right node, not the answer.** A definition does
not change between queries and recomputing it costs nothing useful.

**Why a timestamp makes a projection acceptable.** An answer that says *as of
this morning* is honest and often sufficient. An answer that omits the
qualification claims currency it does not have. The rule is therefore not "never
project" but "never project silently" — which keeps the performance option
available without the honesty cost.

**Why the split is by question class rather than by object.** The same object
answers different question classes differently. A control's definition is stable;
its effectiveness is not. Splitting by object would force one mechanism for both.

## Consequences

### Positive

- Status answers are current by construction (D1)
- Definitional answers are cheap and stable (D2)
- The reasoning path is deterministic and reproducible (D4)
- The projection escape hatch exists but cannot be used dishonestly

### Negative

- Status answers are slower than cached ones
- Question classification becomes load-bearing: a status question misclassified
  as definitional produces a fluent description of intent presented as current
  state — **the single most dangerous failure in this design**
- Live traversal cost grows with inventory size

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Misclassification of a status question | **High** | Classification is explicit and inspectable; ambiguity produces a clarifying question rather than a guess. The question classes are distinguishable by the object kinds they touch |
| Latency pressure leads to caching status "temporarily" | **High** | The timestamp rule makes caching permissible only when disclosed, which removes the incentive to hide it |
| A derived figure retrieved from the corpus is quoted directly | Medium | Derived attributes are recomputed by rule, and the provenance model marks them `DERIVED` rather than `OBSERVED` |

## Security implications

Live traversal is subject to entitlement per object (ADR-017). **A projection
must not become a way to read what live traversal would deny** — the projection
carries the same entitlement filter, or it is not used.

## RLS and tenant-isolation implications

Unchanged. Both mechanisms read rows already subject to RLS. A projection is
tenant-scoped like any other derived artefact.

## Evidence implications

- Status answers aggregate evidence records at query time, so an answer reflects
  evidence that arrived seconds ago
- The traversal itself is recorded as an evidence record (ADR-017), which means
  **the question a user asked is itself auditable** — useful when reconstructing
  what was known and when

## AI-governance implications

- Isabella states the basis of a status answer: which objects were traversed and
  which records were counted. **The traversal is the explanation** (Charter P9)
- She must not present a definitional answer as a status answer. *"A control is
  operating when evidence arrives"* is a definition; *"this control is operating"*
  is a claim requiring traversal
- Where a projection is used, the answer carries its timestamp
- Where an answer cannot be computed, she says so rather than retrieving
  something adjacent — the failure mode a generic corpus makes tempting, because
  it always contains something relevant-sounding

## Migration implications

Conceptual. No schema change. Question classification and traversal are
reasoning-layer concerns.

## Compatibility

| Component | Impact |
|---|---|
| Retrieval | None. Continues to serve definitional questions |
| Grounding gate | Applies to both mechanisms |
| Living Graph | Provides the traversal (ADR-016) |
| Isabella tool registry | Gains traversal tools; existing tools unchanged |

## Alternatives rejected

| Option | Rejected because |
|---|---|
| All retrieval | Answers status from documents describing intent — the failure this design exists to prevent |
| All live traversal | Recomputes stable definitions at cost, and produces worse definitional answers than the curated corpus |
| Cached status with invalidation | Invalidation must be perfect or the answer is confidently wrong. Perfect invalidation across an evidence stream is not achievable, and the failure is silent |
| Projection without timestamp | Claims currency it does not have |

## Validation criteria

1. A status question triggers traversal, not retrieval alone
2. A status answer references objects and evidence, not corpus passages
3. A derived figure is recomputed, never quoted from retrieved text
4. A projection-sourced answer states its computation time
5. An ambiguous question produces a clarifying question, not a guess
6. Evidence arriving between two identical questions changes the answer
7. Every traversal is recorded as an evidence record

## Implementation guardrails

- **No cache on a status answer without a visible timestamp**
- Question classification is explicit and logged; misclassification must be
  diagnosable after the fact
- Derived attributes are computed, never read from text
- A projection carries the same entitlement filter as live traversal

## Rollback

Reversible per question class. Definitional retrieval is independent of status
traversal, so either mechanism can be adjusted without the other.

## Open follow-up questions (non-blocking)

1. What latency budget makes a live status traversal unacceptable, and at what
   inventory size is it reached? *Non-blocking: measurable when the inventory
   exists; the timestamp rule already governs the fallback.*
2. Should question classification be model-driven or rule-driven? *Non-blocking:
   both satisfy the decision provided the classification is inspectable.*
