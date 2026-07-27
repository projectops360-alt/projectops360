# Enterprise Trust Program

**Enterprise Trust Baseline v1.0** · **Status: APPROVED**
**Phase 1: CLOSED** (2026-07-26) · **Phase 2: in design**

| Document | Status |
|---|---|
| Architecture Specification | **FROZEN** — baseline v1.0 |
| Strategy | **FROZEN** — baseline v1.0 |
| Charter | **FROZEN** — baseline v1.0 |
| Enterprise Knowledge Intelligence | Reviewed — decisions resolved · **not part of the frozen baseline** |
| EKI Architecture Decision Gate | **READY FOR IMPLEMENTATION DESIGN** · not part of the frozen baseline |

> Future modifications require an ADR or a formal version update.
> See [Governance Rules](#governance-rules).

---

## Purpose

This folder is the authoritative source for how ProjectOps360 governs security,
compliance and enterprise trust.

It exists because the platform's trust posture must be **answerable** — a
customer, auditor, partner or board member should be able to reach a current,
authoritative answer without asking an individual. Institutional knowledge held
in people is a liability; these documents are the alternative.

The Product Brain is the governing source of truth for this repository and
overrides chat and prompts (ADR-007). The Enterprise Trust Program inherits that
authority rather than creating a parallel one.

---

## Current status

**Phase 1 is complete and closed.** Phase 1 produced the framework: what we are
building, why, and the principles that constrain every future decision. It
produced **no code, no schema, no API and no product change**, by design.

The three documents are frozen at Baseline v1.0. They were reviewed for internal
consistency at closure; the review corrected cross-references, status metadata
and one stale structural listing, and changed no architectural decision, no
strategic position and no principle.

**Nothing here has been implemented.** The findings in the Architecture
Specification describe the platform as measured on 2026-07-26. They are not a
record of work done — they are the starting position for Phase 2.

---

## Document order

Numbering reflects **dependency**, not importance. Each document assumes the one
before it.

| # | Document | Answers | Audience |
|---|---|---|---|
| **00** | [Architecture Specification](00-etcf-architecture-specification.md) | *Where do we actually stand, and what must be built?* | Architects, security engineers, auditors |
| **01** | [Strategy](01-enterprise-trust-strategy.md) | *Why invest, what is it worth, and in what order?* | Board, executives, investors, enterprise customers |
| **02** | [Charter](02-enterprise-trust-charter.md) | *What rules constrain every future decision?* | Everyone. Permanent |
| **03** | [Enterprise Knowledge Intelligence](03-enterprise-knowledge-intelligence.md) | *How does the platform represent and reason over trust as knowledge?* | Architects, knowledge engineers |
| **04** | [EKI Architecture Decision Gate](04-eki-architecture-decision-gate.md) | *Are the architectural decisions settled enough to start building?* | Architects, executive sponsor |
| — | [CHANGELOG](CHANGELOG.md) | *What changed, when, and under what authority?* | Everyone |

**00–02 are the frozen baseline. 03 and 04 are Phase 2** and are not part of it.
Both are governed by the Charter and may not contradict it. Where 03 and 04
differ, **04 is authoritative** — it records the decisions taken after 03 was
written, one of which superseded a recommendation in 03.

The seven architectural decisions are ADRs **013–019** in the repository's single
[ADR index](../07-adr-index.md), not in a trust-specific register: a second ADR
registry would itself be a second source of truth.

The Charter is numbered last and **ranks first**. Where any document, policy,
standard or decision conflicts with it, the Charter prevails.

---

## Reading order

Different readers need different paths. Each document is self-contained; none
requires the others to be understood.

**Board member or investor** — 01 (Executive Summary, Business Value, Risk
Analysis, Executive Recommendations), then 02 (Purpose, Long-Term Commitments,
Closing Statement). Roughly 40 minutes.

**Enterprise customer or their security team** — 02 in full, then 00 §2 (current
assessment) and §4–6 (security, governance, operations). The Charter first is
deliberate: it states what we commit to before what we have built.

**Auditor** — 00 in full, paying attention to the *reading note on evidence* at
the top, which states the assessment method and documents one finding the method
corrected. Then 02 §Governance Model and §Ownership.

**Engineer or architect joining the programme** — 02 first, without exception.
The principles decide design arguments; the specification only describes the
current state. Then 00 §7–8 (compliance engine, evidence framework).

**Executive sponsor** — 00 through 02, in order, then 04 §7–8 for the
implementation prerequisites. 00 §12 and 01 §Executive Recommendations converge;
where they differ in emphasis, 02 resolves it.

---

## Scope

### What is included

- Assessment of the platform's security and compliance posture, **measured
  against production and the source tree** rather than inferred from design
  documents
- Readiness assessment against the SOC 2 Trust Services Criteria, with priority,
  complexity and risk per criterion
- Target architecture for security, governance, evidence collection and
  operational security
- A framework-neutral compliance engine design supporting multiple frameworks
  without re-architecture
- Business case, certification sequencing, timeline and investment shape
- The permanent principles governing future decisions
- Proposed documentation structure for Phase 2 onward

### What is intentionally excluded

Each exclusion is a decision, not an omission.

| Excluded | Why |
|---|---|
| **All implementation** | Phase 1 is architecture and governance. Building before the principles are ratified is how a programme acquires decisions nobody chose |
| **Database schemas, APIs, UI** | Same reason. The evidence model is specified conceptually; its schema is Phase 2 |
| **Privacy in the first attestation scope** | Requires operational processes that do not exist. Including it would delay attestation by roughly two quarters for limited current return (00 §3.5, 01 §Certification Roadmap) |
| **Specific monetary figures** | Audit and tooling costs are market-rate and should be quoted, not estimated. Investment is expressed as effort distribution (01 §Estimated Investment) |
| **Provider-inherited controls** | Hosting, database and authentication providers operate their own controls, evidenced by their own reports. These are collected as vendor evidence, not re-assessed by us (00 Appendix A) |
| **Network and physical security** | Inherited from the hosting provider |
| **Personnel controls** | Requires HR processes outside this repository's scope |
| **Named vendors and tooling choices** | Deliberately absent so the documents remain valid as the market changes |
| **The Enterprise Trust Platform product direction** | Described as strategic optionality only. No product commitment (01 §Long-Term Strategy) |

---

## Governance rules

### The baseline is frozen

Baseline v1.0 comprises the three documents at the commit that closed Phase 1.
Frozen means the content is stable and citable — not that it is permanent.

### How the baseline changes

| Change | Requires | Result |
|---|---|---|
| Typographical, formatting, broken link | Ordinary commit | No version change |
| New finding, updated measurement, new section | ADR recording what changed and why | Minor version (v1.1) |
| Architectural decision reversed or superseded | ADR + Architecture Review | Minor or major, per impact |
| **Change to a principle in the Charter** | **ADR + Executive Sponsor approval** | **Major version (v2.0)** |
| Change to decision principles, governance model, ownership or success criteria | Executive Sponsor approval | Major version |

The asymmetry is deliberate and is stated in the Charter: procedures must be
changeable by the people who operate them; principles must not be changeable by
the people they constrain.

### Superseding, not deleting

Documents are superseded, never deleted. A reader in five years must be able to
see what we believed, when, and what changed our minds. The CHANGELOG carries
that history.

### Review cadence

Annually at minimum, and on the triggers defined in the Charter — including a
significant security incident, a material change in regulatory or market
context, and **repeated circumvention of a principle**, which is treated as
evidence that the principle is wrong or unenforceable as written rather than as
a discipline problem.

### Ownership

Every domain in the Charter's ownership model requires exactly one accountable
name. **All are currently unassigned.** Naming an executive owner is
Recommendation 1 of the Strategy and the precondition for Phase 2 — nothing in
this programme advances without it.

---

## Baseline definition

**Enterprise Trust Baseline v1.0** is the reference point against which all
future trust work is measured.

It comprises:

1. **The three frozen documents** at the Phase 1 closure commit
2. **The measured posture** recorded in 00 §2 — reproducible, and the benchmark
   for whether the programme improves anything
3. **The findings and gaps** in 00 §2.3, §2.4 and §3 — the Phase 2 work list
4. **The principles** in 02 — the constraints on how that work may be done

### What the baseline asserts

- The platform's posture **as measured on 2026-07-26**, not as intended
- The gaps we know about, including the ones that are unflattering
- The principles we commit to

### What the baseline does not assert

- That any gap has been closed
- That any control operates
- That any evidence is being collected
- That any certification has been pursued

**A baseline is a starting line.** Its value is that a later measurement can be
compared to it honestly. Any future claim of progress must reference it.

### The completion rule

The Charter's rule applies to every control built in Phase 2 and beyond, and
overrides every other definition of done:

> **A control is complete when a query returns its evidence.**
> Not when the mechanism exists. Not when the tests pass.
> **When the rows are there.**

This rule exists because the assessment found the platform's best-designed
control surface — a governance audit trail with enforced immutability and a
cryptographic hash chain — containing zero records.

---

## Version history

| Version | Date | Status | Summary |
|---|---|---|---|
| **1.0** | 2026-07-26 | APPROVED · Frozen | Phase 1 baseline. Architecture, Strategy and Charter complete. No implementation |

Full detail in [CHANGELOG.md](CHANGELOG.md).

---

## Phase 2 readiness

Phase 1 delivered the framework. Phase 2 delivers the capability.

**Preconditions for Phase 2**, in order:

1. **An executive owner is named.** Not a team — a person. This is the binding
   constraint on everything that follows
2. Executive ratification of the Charter, which converts the principles from
   proposal to constraint
3. Confirmation of the attestation scope decision — electing Processing
   Integrity, excluding Privacy from the first window
4. Agreement that the first milestone is **governance foundation followed by
   evidence instrumentation**, in that order

Phase 2 begins with the governance foundation (00 §10, M1) and proceeds to the
evidence spine (M2). The sequencing is not arbitrary: evidence cannot be
collected against controls that do not yet exist, and **evidence cannot be
created retroactively** — every day without instrumentation is a day permanently
absent from the record.

---

*Questions about this programme should reach its executive owner. Until one is
named, that absence is the programme's first finding.*
