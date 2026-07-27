# ADR-017 — Trust knowledge enters the retrieval corpus under purpose-bound authorization

**Status:** Accepted
**Date:** 2026-07-26
**Pillars:** P1/P5 · **Supersedes:** the open decision recorded as EKI §11 #5
**Related:** [ADR-004](ADR-004-knowledge-os-substrate.md) ·
[ADR-015](ADR-015-normative-layer-in-knowledge-packages.md) ·
[ADR-018](ADR-018-isabella-reasons-live-over-the-graph.md)

---

## Context

Trust knowledge is more sensitive than project knowledge: it enumerates our
control gaps, our accepted risks, our exceptions and our findings. It is
precisely the material an attacker or a hostile counterparty would want.

The retrieval corpus is how Isabella finds relevant knowledge. A domain absent
from it is a domain she cannot reason about.

## Problem

Does trust knowledge enter the retrieval corpus, given what it exposes? And if
so, what prevents a member from asking Isabella to enumerate our weaknesses?

## Decision drivers

| # | Driver |
|---|---|
| D1 | Charter P12 — a separate corpus is a second source of truth |
| D2 | Trust knowledge is materially more sensitive than project knowledge |
| D3 | Sensitivity is not uniform: a policy is shareable, a finding is not |
| D4 | Isabella must answer trust questions or the domain is inert |
| D5 | Charter P7 — a denial is evidence of a working control |

## Considered options

**Option 1 — Excluded.** Trust knowledge stays out of the corpus.
**Option 2 — Separate corpus** with its own retrieval path and access rules.
**Option 3 — One corpus, purpose-bound authorization** at retrieval time.

## Decision

**Option 3. One corpus, with authorization applied at retrieval, before
generation.**

Four rules define it:

1. **Trust knowledge is indexed in the existing corpus.** No parallel index.

2. **Each object carries a sensitivity classification**, and the classification
   is not uniform across the domain:

   | Class | Contains | Audience |
   |---|---|---|
   | `public` | Posture commitments, certification status | Anyone, including customers |
   | `internal` | Policies, standards, control assertions | Organization members |
   | `restricted` | Findings, risk ratings, exceptions, gaps | Governance roles, purpose-bound |

3. **Retrieval filters by entitlement before the model sees anything.**
   Unentitled content is never retrieved, so it can never leak through
   summarisation, paraphrase or an unusually phrased question. This is the
   decisive property: filtering after generation is not filtering.

4. **Every trust-domain retrieval is an evidence record**, including denials
   (D5).

## Detailed rationale

**Why not exclusion.** It would make the trust domain inert. An assistant that
cannot reason about governance cannot answer the questions the programme exists
to answer — *what would an auditor ask that we cannot answer?* is precisely a
retrieval-and-traversal question, and it is the most valuable one.

**Why not a separate corpus.** Charter P12, and a specific failure: trust
knowledge and project knowledge genuinely overlap. A control operates over
project execution; a finding concerns a project. A separate corpus would need
cross-corpus retrieval to answer real questions — which is one corpus with extra
steps and two sets of access rules to keep aligned.

**Why filtering must precede generation.** A model given restricted passages will
use them. Not because it is disobedient, but because they are relevant — the
retrieval was correct, the entitlement was not. Post-generation filtering
attempts to detect leakage in prose, which is unreliable in a way that
pre-retrieval filtering is not. **The only content that cannot leak is content
that was never retrieved.**

**Why sensitivity is per object rather than per domain.** Treating all trust
knowledge as restricted would hide our policies from the people who must follow
them. Treating it all as internal would expose findings to everyone. The
classification is the mechanism that lets one corpus serve a customer-facing
Trust Centre and an internal gap review.

**Why denials are recorded.** A recorded refusal demonstrates the control
operates. An access-control system that logs only successes cannot show that it
refuses anything — Charter P7, and the property an auditor tests by attempting
what should be denied.

## Consequences

### Positive

- One corpus, one retrieval path, one grounding gate (D1)
- Isabella can reason across governance and delivery in one retrieval (D4)
- Sensitivity is explicit and per object, so the customer-facing projection is a
  filter rather than a separate publication (D3)
- Retrieval denials become evidence for CC6.1 (D5)

### Negative

- Retrieval acquires an entitlement filter, adding a step to a hot path
- Sensitivity must be assigned to every object, and a wrong assignment is either
  a leak or an obstruction
- The customer-facing projection must be re-verified whenever the classification
  vocabulary changes

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| An object is misclassified as `internal` when it should be `restricted` | **High** | Classification defaults to the most restrictive for governance kinds. Finding, Risk and Exception are `restricted` by kind, not by choice |
| The entitlement filter is bypassed by a code path that queries the corpus directly | **High** | Retrieval is a single service. A direct query is an architectural violation, testable by inspection |
| Denial logging is verbose enough that it is disabled | Medium | Denials are recorded as evidence, not as debug logging, and are subject to retention rather than volume management |

## Security implications

This is the highest-sensitivity decision in the EKI set.

The controlling property: **entitlement is evaluated before retrieval, not after
generation.** Everything else follows. A secondary property: `restricted`
classification is assigned **by object kind** for Finding, Risk and Exception, so
it cannot be forgotten on an individual object.

## RLS and tenant-isolation implications

Tenant isolation is unchanged and remains the outer boundary — trust content
carries a non-null `organization_id` (ADR-013).

Entitlement is a **second, inner** boundary based on role and purpose. The two
are independent: RLS answers *is this your organization's*, entitlement answers
*are you permitted this within it*. Collapsing them would weaken both.

## Evidence implications

- Every trust retrieval, granted or denied, is an evidence record
- Denials evidence access control (CC6.1)
- Grants evidence appropriate access and support purpose-limitation claims

## AI-governance implications

- Isabella never sees unentitled content, so she cannot leak it
- She may state that content exists but is not available to this user — **the
  existence of a finding is `internal`; its content is `restricted`.** Concealing
  existence would let a user conclude no findings exist, which is a worse
  disclosure than acknowledging one they cannot read
- Her answers cite sources, and the citations are already entitlement-filtered

## Migration implications

Conceptual. Classification is an attribute; kind-based defaults require no
per-object decision for the sensitive kinds. Retrieval gains an entitlement
filter.

## Compatibility

| Component | Impact |
|---|---|
| Retrieval service | Gains an entitlement filter — the only functional change |
| Grounding gate | None |
| RRF fusion | None |
| Bilingual retrieval | None |
| Existing corpus | None |

## Alternatives rejected

| Option | Rejected because |
|---|---|
| Exclusion | Makes the domain inert and forecloses the most valuable question class |
| Separate corpus | Charter P12; the domains overlap, so cross-corpus retrieval reappears |
| Post-generation filtering | Attempts to detect leakage in prose. The only content that cannot leak is content never retrieved |
| Uniform restriction | Hides policies from the people who must follow them |

## Validation criteria

1. One corpus, one retrieval service
2. Unentitled content is absent from the model's input, verifiable by inspecting
   what was passed
3. Finding, Risk and Exception default to `restricted` **by kind**
4. A `restricted` object is never retrieved for an unentitled principal
5. Every trust retrieval produces an evidence record
6. Denials are recorded with reason codes
7. The customer-facing projection returns only `public`
8. A member can learn that a finding exists without learning its content

## Implementation guardrails

- Entitlement is evaluated **before** retrieval. A design filtering afterwards is
  rejected
- Retrieval is a single service; direct corpus queries elsewhere are a violation
- Sensitivity defaults are by kind and cannot be lowered without an audit record
- Denials are evidence, never debug logging

## Rollback

Reversible: trust content can be de-indexed. Reversal removes a capability
without creating a risk.

## Open follow-up questions (non-blocking)

1. Should sensitivity be inheritable — does a finding about a `public` control
   remain `restricted`? *Non-blocking: the kind default is restrictive, so
   inheritance can only loosen, and loosening requires a decision anyway.*
2. Does the customer-facing projection warrant its own denial recording, given
   volume? *Non-blocking: an operational retention question.*
