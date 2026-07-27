# ADR-015 — The normative layer lives in knowledge packages, not in knowledge objects

**Status:** Accepted
**Date:** 2026-07-26
**Pillars:** All · **Supersedes:** the open decision recorded as EKI §11 #3
**Related:** [ADR-013](ADR-013-governance-knowledge-scope.md) ·
[ADR-014](ADR-014-governance-objects-are-knowledge-objects.md) ·
[ADR-004](ADR-004-knowledge-os-substrate.md)

---

## Context

EKI separates governance knowledge into three layers by what makes a statement
true: **normative** (an authority defined it), **instance** (we decided it) and
**observed** (the system recorded it).

The platform has two knowledge substrates. `knowledge_packages` holds curated,
versioned, confidence-tiered, bilingual content that is indexed for retrieval and
supports a **global scope** (`organization_id` NULL). `project_knowledge_objects`
holds typed objects with lifecycle, evidence and transitions.

## Problem

Where does the normative layer live? A framework obligation — the verbatim text
of SOC 2 CC6.2 — is knowledge, but it is not *our* knowledge. We did not decide
it, we cannot change it, and it is identical for every tenant.

## Decision drivers

| # | Driver |
|---|---|
| D1 | Framework text is authored by an external authority and is tenant-independent |
| D2 | Obligations must be retrievable semantically, in both languages |
| D3 | Normative content must not acquire a lifecycle it does not have |
| D4 | Our *interpretation* of an obligation is ours and does change |
| D5 | No duplication of framework text per tenant |

## Considered options

**Option 1 — Obligations as knowledge objects.** One object per requirement.

**Option 2 — Obligations as knowledge packages.** Global-scope packages, versioned
and indexed like other curated content.

**Option 3 — Split.** Verbatim text as a package; our interpretation as an object.

## Decision

**Option 2, with the interpretation boundary from Option 3.**

- **Verbatim obligation text lives in `knowledge_packages` at global scope**
  (`organization_id` NULL), versioned, confidence-tiered `verified`, and indexed
  for bilingual retrieval
- **Our interpretation is an attribute of the ControlMapping**, not of the
  obligation. The mapping is where we assert what a requirement means for us, and
  it already has the lifecycle (`asserted → reviewed → confirmed → disputed`)
  that an interpretation needs
- Policies, Standards and Principles — our own normative content — are **also
  packages**, at organization scope rather than global

The normative layer is therefore entirely package-resident. The instance layer
(Control, ControlMapping, EvidenceBinding, Risk, Exception, Asset, Vendor,
TrustBoundary) and the observed layer (EvidenceRecord, Assessment, Finding) are
knowledge objects per ADR-014.

## Detailed rationale

**Why obligations are not objects.** An object's value is its lifecycle,
evidence and ownership. An obligation has none of the three. It is not proposed,
validated or activated by us — it simply is, until the authority revises it. It
carries no evidence, because it asserts nothing about our systems. And we do not
own it. Modelling it as an object would attach three empty properties to every
requirement in every framework, and would invite the error of "approving" an
obligation, which is meaningless.

**Why the split matters more than the storage.** The genuinely valuable decision
here is not *packages versus objects* — it is that **the verbatim text and our
interpretation are different things with different truth conditions**. The text
changes when the authority revises it. The interpretation changes when we learn
something, an auditor disagrees, or our architecture changes.

Storing them together means a change in interpretation looks like a change in the
requirement, and the version history stops being able to answer *did the rule
change, or did we?* That question is asked in every audit where a control's
coverage is disputed.

**Why interpretation belongs to the mapping rather than to the obligation.** The
same requirement can be interpreted differently against different controls — a
partial mapping and a compensating mapping interpret the same text differently and
legitimately. Attaching interpretation to the obligation would force one
interpretation per requirement.

**Why global scope is available and correct.** `knowledge_packages` already
supports `organization_id` NULL for content shared across tenants. Framework text
is exactly that. This also settles the platform-scope question raised in ADR-013:
the normative layer never needed a platform scope on knowledge objects, because it
was never going to be an object.

## Consequences

### Positive

- Framework text is stored once, not per tenant (D5)
- Obligations are semantically retrievable in both languages with no new
  machinery (D2)
- Version history distinguishes "the authority changed" from "we reconsidered" (D4)
- No empty lifecycle, evidence or ownership on normative content (D3)
- ADR-013 does not need a platform scope

### Negative

- Governance knowledge spans two substrates. A traversal from obligation to
  evidence crosses from packages to objects
- Package content is text-first; obligation metadata (authority, reference,
  applicability) must live in package attributes rather than in typed columns

### Risks

| Risk | Mitigation |
|---|---|
| The package/object boundary is misapplied — someone stores a control as a package | The boundary rule is stated as a test: *does it have a lifecycle, evidence and an owner?* Three yeses means object |
| A traversal crossing substrates is inconsistent | The crossing happens at exactly one relationship (`satisfies`, via ControlMapping) and is therefore auditable |

## Security implications

Global-scope packages are readable across tenants **by design** — framework text
is public. No tenant-specific content may be stored at global scope, and that is
the invariant to protect. Our own policies and standards are organization-scoped
packages, not global ones.

## RLS and tenant-isolation implications

Unchanged. `knowledge_packages` already implements global and tenant scope with
existing policies. **This decision adds no new isolation surface** — it uses one
that exists and is already exercised in production by the Product Brain corpus.

## Evidence implications

Obligations carry no evidence. Evidence attaches to controls, which satisfy
obligations through mappings. **This is the prohibited shortcut in EKI §4.3**:
binding evidence directly to a requirement would remove the assertion an auditor
exists to test.

## AI-governance implications

- Isabella retrieves obligations semantically — the correct use of retrieval:
  finding the right node, not the answer
- She must never present an obligation's verbatim text as our position, nor our
  interpretation as the authority's words. **The two are separately sourced and
  must be separately attributed**
- Framework comparison ("what does ISO require that SOC 2 does not?") is a
  retrieval-plus-mapping question, well served by this split

## Migration implications

Conceptual. Framework obligations are authored as global packages through the
existing curation and seeding pipeline. No schema change. No data migration.

## Compatibility

| Component | Impact |
|---|---|
| Knowledge OS retrieval | None. Obligations are ordinary packages |
| Seeding pipeline | Reused unchanged |
| Bilingual localisation | Inherited |
| Knowledge objects | None |

## Alternatives rejected

| Option | Rejected because |
|---|---|
| Obligations as objects | Attaches lifecycle, evidence and ownership that an obligation does not have, and invites "approving" a requirement |
| Text and interpretation stored together | Destroys the ability to distinguish an authority's revision from our reconsideration — a question asked in every coverage dispute |
| Interpretation on the obligation | Forces one interpretation per requirement, which partial and compensating mappings contradict |
| Framework text duplicated per tenant | Storage waste, and every tenant's copy drifts on revision |

## Validation criteria

1. No framework text is stored per tenant
2. Obligations are retrievable in both languages through the existing path
3. An obligation has no lifecycle state, no evidence rows and no owner
4. Interpretation is an attribute of a ControlMapping
5. A framework revision produces a new package version without altering any mapping
6. A mapping's interpretation can change without producing a new obligation version
7. No global-scope package contains tenant-specific content

## Implementation guardrails

- The boundary test — *lifecycle, evidence, owner: three yeses means object* —
  is the rule, and it is applied at authoring time
- Global scope is reserved for authored-elsewhere content. Our own commitments
  are organization-scoped
- Obligation packages record the authority version they transcribe

## Rollback

Reversible. Obligations could be re-authored as objects. The interpretation split
would survive that change and should, regardless of storage.

## Open follow-up questions (non-blocking)

1. Should obligation packages be seeded through the committed migration pipeline
   or an administrative import? *Non-blocking: both exist; a pipeline choice.*
2. How are framework revisions detected — subscription, periodic review, or
   customer notification? *Non-blocking: an operational process under M1.*
