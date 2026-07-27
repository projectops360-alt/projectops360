# ADR-016 — The trust views are Living Graph lenses, not a compliance graph

**Status:** Accepted
**Date:** 2026-07-26
**Pillars:** P2 · **Supersedes:** the open decision recorded as EKI §11 #4
**Related:** [ADR-002 Living Graph is a primary surface](ADR-002-living-graph-primary-surface.md) ·
[ADR-012 PMO Intelligence Center orchestration](ADR-012-pmo-intelligence-center-orchestration.md) ·
[ADR-014](ADR-014-governance-objects-are-knowledge-objects.md)

---

## Context

EKI defines eight trust views: Trust, Compliance, Evidence, Policy, Control,
Risk, Audit and Certification. Each answers a different question over governance
knowledge.

The Living Graph already renders typed nodes and edges with lens-based filtering,
and the PMO Portfolio Living Graph already composes engines without recomputing
them (ADR-012).

## Problem

Are the eight views lenses over the existing graph, or a separate compliance
graph surface with its own rendering, layout and interaction?

## Decision drivers

| # | Driver |
|---|---|
| D1 | Charter P12 — one canonical source |
| D2 | Governance and delivery objects must be traversable in one query |
| D3 | UX-015 progressive disclosure must apply, or a compliance graph is unreadable |
| D4 | The AI must reason across governance and delivery without choosing a graph first |
| D5 | A new view must not cost a subsystem |

## Decision

**The eight trust views are lens definitions over the single Living Graph
projection.** No separate compliance graph, no separate graph store, no separate
rendering surface.

A lens is a four-part specification: a node-kind filter, an edge-type filter, a
traversal root, and a rendering intent. It is configuration, not code.

Governance objects (ADR-014) enter the graph as nodes; governance relationships
(gate document Annex B) enter as typed edges.

## Detailed rationale

**Why eight graphs is the wrong answer even though it was the request.** Eight
graphs means eight sets of edges kept consistent by discipline, and eight answers
to any question that spans them. The questions worth asking span them: *what is
our largest unmitigated exposure, and which principle does it threaten?* crosses
risk, control, evidence and trust.

**The decisive argument is the AI's.** An assistant reasoning over eight
disconnected graphs must first classify the question into a graph. That
classification is a guess, it is made before the traversal that would inform it,
and when it is wrong the answer is confidently drawn from the wrong subgraph.
One graph removes the decision.

**Why this is proven rather than theoretical.** The Living Graph already carries
eight lenses over one projection — overview, process, risk, finance, resources,
dependencies, benefits, what-if. The pattern is in production and its cost is
known: a lens is a definition.

**Why progressive disclosure is load-bearing here.** A compliance graph rendering
every control, mapping, binding and record at once is unreadable at any realistic
inventory size. UX-015 already solved this for knowledge objects — show objects,
reveal evidence on selection — and the solution applies unchanged. Building a
separate surface would mean solving it again, worse.

## Consequences

### Positive

- One projection, one layout engine, one interaction model, one set of
  performance characteristics
- Governance and delivery objects are traversable in a single query (D2)
- A ninth lens costs a definition (D5)
- Isabella traverses one graph (D4)
- UX-015, saved layouts and existing graph controls apply without modification

### Negative

- The node and edge vocabularies grow, and vocabulary growth affects every lens
- Governance-specific rendering needs (a coverage matrix, an evidence timeline)
  may not suit a graph and will need non-graph surfaces alongside

### Risks

| Risk | Mitigation |
|---|---|
| Graph becomes unreadable as the inventory grows | UX-015 progressive disclosure, and lens filters that are narrow by default |
| A governance lens accidentally exposes delivery data to a governance-only role, or the reverse | Authorization is per object, not per lens. A lens filters presentation; it never grants access |
| Vocabulary growth destabilises existing lenses | Existing lenses filter by explicit node and edge kinds, so new kinds are invisible to them by construction |

## Security implications

**A lens is a presentation filter and must never be an authorization boundary.**
An object the user may not see must be absent from the projection, not merely
absent from the current lens — otherwise switching lenses becomes a privilege
escalation. Authorization happens before projection.

## RLS and tenant-isolation implications

None. The graph is a projection over rows already subject to RLS. Governance
nodes carry a non-null `organization_id` (ADR-013), so isolation is identical to
every other node.

## Evidence implications

The Evidence lens — binding freshness across the observation window — is the lens
that would have surfaced a zero-row governance audit trail on day one. It is
therefore the highest-value lens and should be built first, ahead of the more
visually appealing Compliance lens.

## AI-governance implications

- Isabella selects a lens and a root; the graph produces the path. **The
  traversal is the explanation**, not a narration of one — Charter P9
- She may not create lenses that widen visibility, because a lens does not grant
  access and must not appear to
- When a traversal crosses from governance into delivery, the answer says so

## Migration implications

Conceptual. Additive vocabulary. No existing lens changes behaviour.

## Compatibility

| Component | Impact |
|---|---|
| Living Graph core | Additive vocabulary only |
| Existing lenses | None — they filter explicitly |
| UX-015 | Applies unchanged |
| Saved layouts (UX-007) | Applies unchanged; presentation-only guarantee holds |
| PMO Portfolio Living Graph | Gains a trust lens by composition (ADR-012) |

## Alternatives rejected

| Option | Rejected because |
|---|---|
| Eight separate graphs | Eight sources of truth; cross-cutting questions unanswerable; the AI must guess a graph before traversing |
| One separate compliance graph | Still a second source of truth, and re-solves layout, interaction and progressive disclosure |
| Table-only compliance views | Loses relationship traversal, which is the entire value — a compliance answer *is* a path |

## Validation criteria

1. No separate graph store or projection exists for governance
2. Each of the eight views is expressible as a filter and a root
3. A single query returns a path from a Charter principle to an evidence record
4. Existing lenses are unchanged by the addition of governance vocabulary
5. An object the user may not see is absent from every lens, not filtered by one
6. UX-015 progressive disclosure governs governance rendering

## Implementation guardrails

- A lens is configuration. **A lens requiring new traversal code is a signal that
  the vocabulary is wrong**, not that the lens needs an exception
- No lens may bypass authorization
- Non-graph surfaces (matrices, timelines) are permitted and read the same
  projection — they are not a second graph

## Rollback

Reversible. A lens can be withdrawn without data impact.

## Open follow-up questions (non-blocking)

1. Should the trust lenses appear in the project Living Graph, the PMO Portfolio
   Living Graph, or both? *Non-blocking: a placement decision.*
2. Does the coverage matrix warrant a dedicated non-graph surface? *Non-blocking:
   a presentation decision once the lens exists.*
