# ADR-014 — Governance objects are knowledge objects, namespaced

**Status:** Accepted
**Date:** 2026-07-26
**Pillars:** All · **Supersedes:** the open decision recorded as EKI §11 #2
**Related:** [ADR-013](ADR-013-governance-knowledge-scope.md) ·
[ADR-004](ADR-004-knowledge-os-substrate.md) ·
[EKI Specification](../trust/03-enterprise-knowledge-intelligence.md)

---

## Context

EKI defines fifteen governance object kinds — Control, Policy, Risk, Finding,
Obligation and others. Each must carry identity, attributes, relationships,
lifecycle, ownership, versioning, evidence and dependencies.

The platform already has a knowledge-object family providing seven of those
eight properties, with two unusual guarantees enforced by the database: a version
cannot be written without a non-empty confidence reason, and a status transition
cannot be written without a rationale.

## Problem

Are governance objects *instances of* the existing knowledge-object model, or a
structurally similar but separate family sharing its design?

The question is not cosmetic. It decides whether the platform has one lifecycle
implementation or two, one evidence model or two, and one place where "how do we
know this?" is answered.

## Decision drivers

| # | Driver |
|---|---|
| D1 | Charter P12 — no separate system of record for compliance |
| D2 | Governance and project knowledge must be relatable to each other |
| D3 | The mandatory-rationale guarantees must apply to governance, where they matter most |
| D4 | Governance objects must be distinguishable in queries and in the interface |
| D5 | Governance vocabulary must not pollute project-learning vocabulary |

## Considered options

**Option 1 — One family, namespaced.** Governance objects are knowledge objects
whose `knowledge_type` comes from a reserved governance vocabulary, addressed
under a `trust:` namespace.

**Option 2 — A parallel family.** Structurally identical tables for governance,
sharing the design but not the storage.

**Option 3 — Governance as a specialisation.** A base object with a governance
extension table.

## Decision

**Option 1. Governance objects are knowledge objects with a reserved
vocabulary and namespace.**

The existing `knowledge_type` vocabulary (`finding`, `pattern`, `best_practice`,
`lesson_learned`, `recommendation`, `prediction`, `root_cause`) is **extended**,
not replaced, with the governance kinds defined in the EKI gate document.

Governance objects are addressed as `trust:<kind>:<identifier>`. The namespace is
an identity convention, not separate storage.

`finding` already exists in the project vocabulary and is **deliberately reused**
rather than duplicated as `trust:finding`. A finding is a finding; its scope
(ADR-013) and its relationships determine whether it is governance or delivery.
Creating a second finding type would be the beginning of the divergence this ADR
exists to prevent.

## Detailed rationale

**Why not a parallel family.** It is the option that looks safest and is not.
Two families begin identical and diverge on the first requirement that touches
only one — a new evidence role, a lifecycle state, a confidence rule. Within a
year there are two answers to "how is knowledge versioned here", and the
governance one is the less-maintained, because it has fewer users.

Charter P12 was written about exactly this: *two systems describing the same
events will diverge, and the divergence will be discovered at the worst possible
moment.*

**Why not a specialisation table.** It buys type-safety for governance-specific
attributes at the cost of a join on every read and a second write path on every
mutation. The existing model already carries `structured_content` as typed JSONB
for exactly this purpose. The extension table would duplicate a solved problem.

**Why the vocabulary is extended rather than made generic.** A free-form type
column would remove the need for this decision and reintroduce it as a data
problem. EKI R1 requires closed vocabularies; the governance kinds are enumerated
in the gate document and validated the same way project kinds are.

**Why reusing `finding` is correct rather than sloppy.** The two are the same
concept at different scopes: something is wrong, someone owns it, it is due. The
scope distinguishes them; the lifecycle does not need to. Had the lifecycles
genuinely differed, this would be the wrong call — they do not.

## Consequences

### Positive

- One lifecycle, one evidence model, one versioning model, one audit path
- Governance objects inherit the mandatory-rationale guarantees **for free**, and
  those guarantees are worth more in governance than in project learning (D3)
- A governance control and a project lesson can be related directly, because they
  are the same kind of thing (D2)
- Isabella reasons over one object model rather than choosing between two

### Negative

- The `knowledge_type` vocabulary grows substantially. Interfaces that enumerate
  types must filter by namespace or scope rather than listing everything
- A change to the shared model now affects governance, so shared-model changes
  carry a wider blast radius and require broader review

### Risks

| Risk | Mitigation |
|---|---|
| Governance types leak into project-learning interfaces | Namespace and scope (ADR-013) both filter. Project surfaces query project scope, which excludes governance objects by construction |
| A future governance requirement forces a change that harms project knowledge | The requirement is evaluated against both consumers, which is the intended effect, not a side effect |

## Security implications

Governance objects are more sensitive than project knowledge — they enumerate
weaknesses. Sharing storage does **not** mean sharing access: authorization is
applied per object by scope, kind and purpose, above the unchanged tenant
boundary (ADR-013).

## RLS and tenant-isolation implications

None beyond ADR-013. The same policies cover both, because both carry a non-null
`organization_id`.

## Evidence implications

Governance evidence uses the existing evidence model unchanged, including the
`supports | contradicts | context` roles. The `contradicts` role — already
present — is what makes EKI's contradiction handling possible without new
machinery.

## AI-governance implications

Isabella's existing constraints on knowledge objects apply automatically: she may
propose objects in `proposed` status; only a human may transition them, and the
transition requires a rationale the database enforces. **The AI boundary for
governance is inherited rather than invented**, which is stronger than a
governance-specific rule, because it is already enforced in production.

## Migration implications

Conceptual. Extend the `knowledge_type` vocabulary. No data migration; no
existing row changes meaning.

## Compatibility

| Component | Impact |
|---|---|
| Project knowledge objects | None. Vocabulary is additive |
| Knowledge lifecycle | None |
| Evidence model | None |
| Living Graph | Governance objects become available as nodes (ADR-016) |
| UX-015 progressive disclosure | Applies unchanged, and is needed more here |

## Alternatives rejected

| Option | Rejected because |
|---|---|
| Parallel family | Charter P12. Two implementations of one concept diverge, and the less-used one decays |
| Specialisation table | A join and a second write path to solve what `structured_content` already solves |
| Free-form type column | Removes the decision by making it a data problem. Violates EKI R1 |
| Separate `trust:finding` type | Duplicates a concept whose lifecycle is identical. Scope already distinguishes them |

## Validation criteria

1. No governance-specific knowledge table exists
2. Every governance object appears in the same tables as project knowledge
3. Governance types are enumerated in a closed vocabulary, validated identically
4. A governance object cannot be versioned without a confidence reason
5. A governance object cannot transition without a rationale
6. A project-scoped query returns no governance object
7. A governance object and a project object can be directly related

## Implementation guardrails

- No table whose name contains `compliance`, `control` or `governance`
- Governance kinds are added to the existing vocabulary, never to a new column
- Interfaces filter by scope and namespace, never by hardcoded type lists

## Rollback

Reversible while adoption is low: governance rows could be moved to a separate
family. The cost rises with the number of cross-scope relationships, which is
expected — those relationships are the point.

## Open follow-up questions (non-blocking)

1. Should the governance vocabulary be a separate enum constrained by scope, or
   one vocabulary with a namespace convention? *Non-blocking: both satisfy the
   decision; the choice is a schema detail for implementation design.*
