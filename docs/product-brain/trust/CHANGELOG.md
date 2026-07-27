# Enterprise Trust Program — Changelog

All notable changes to the Enterprise Trust baseline are recorded here.

Documents are **superseded, never deleted**. A reader in five years must be able
to see what we believed, when, and what changed our minds.

Versioning follows the rules in [README.md](README.md#how-the-baseline-changes):
a change to a Charter principle is a major version; a new finding or updated
measurement is a minor version; typography and broken links change nothing.

---

## [1.0] — 2026-07-26

**Enterprise Trust Baseline v1.0 · APPROVED · Phase 1 CLOSED**

The first baseline. Establishes the framework, the business case and the
permanent principles for the Enterprise Trust Program.

### Added

**[00-etcf-architecture-specification.md](00-etcf-architecture-specification.md) — Architecture & Governance Specification**

Twelve sections: current architecture assessment, SOC 2 readiness by criterion,
security architecture, governance architecture, operational security, a
framework-neutral compliance engine, the evidence collection framework, trust
dashboard capabilities, a nine-milestone roadmap, the proposed documentation
structure, and final recommendations.

The assessment was **measured against the live production database and the
committed source tree**, not inferred from design documents. The method is stated
at the top of the document because it changed a headline finding: a static
reading of the migration history produced *"58 tenant-scoped tables have no
RLS"*, while production returns **155 of 155 with RLS enabled and 0 without**.
The static reading had not correlated later hardening migrations with the tables
they retro-fitted.

Principal findings recorded at baseline:

- Complete tenant-isolation coverage across multi-tenant tables
- Complete hardening of privileged database functions against the standard
  privilege-escalation vector
- Immutable, hash-chained audit structures enforced by the database rather than
  by convention
- **The platform's best-designed control surface contains zero records.** The
  governance audit trail has a constrained vocabulary, actor typing, decision
  recording, a cryptographic chain, immutability triggers and a constraint that
  makes writing a secret into it physically impossible — and nothing writes to it
- Organizational controls are absent where technical controls are strong: no
  policy set, no risk register, no incident response capability, no subprocessor
  inventory, no MFA, no supply-chain scanning

**[01-enterprise-trust-strategy.md](01-enterprise-trust-strategy.md) — Enterprise Trust Strategy**

Board-level strategic reference. Executive summary, vision, strategic objectives,
business value, competitive analysis, certification roadmap, timeline, investment
shape, risk analysis, enterprise differentiators, AI governance, long-term
strategy and ten executive recommendations.

Figures are labelled **measured**, **benchmark** or **assumption**. Where data is
absent the document says so rather than supplying a plausible number — including
the finding that we instrument none of the commercial measures the objectives
depend on, and therefore cannot currently distinguish a deal lost to a competitor
from one lost to compliance posture.

Positions recorded at baseline:

- Elect **Processing Integrity** in the attestation scope; exclude **Privacy**
  from the first observation window
- **NIST CSF alignment before ISO 27001**, on cost and sequencing grounds
- **SOC 2 Type I before Type II**, to surface design flaws before the observation
  clock starts
- Preserve **framework-neutral control authoring** as an architectural commitment
- Hold the Enterprise Trust Platform direction as **optionality only**; no product
  commitment

**[02-enterprise-trust-charter.md](02-enterprise-trust-charter.md) — Enterprise Trust Charter**

The programme's constitution. Purpose, mission, vision, thirteen core principles,
decision principles, governance model, success criteria, ownership, review cycle,
long-term commitments and closing statement.

Every principle is written to be violable and states what it forbids and what it
costs — a principle that cannot be broken is a description, and a principle with
no cost is a preference.

Adopts a completion rule that overrides every other definition of done in the
programme:

> **A control is complete when a query returns its evidence.**
> Not when the mechanism exists. Not when the tests pass. **When the rows are there.**

This rule is drawn from an observed failure pattern in this organization —
capability built correctly and never connected — recorded twice already in the
product regression log at smaller scale, and found again in the governance audit
trail with zero rows.

**[README.md](README.md) — Programme entry point**

Purpose, current status, document order, reading order by audience, scope,
intentional exclusions, governance rules, version history, baseline definition
and Phase 2 preconditions.

**CHANGELOG.md** — this file.

### Changed at closure

Consistency review across the three documents. **No architectural decision, no
strategic position and no principle was altered.** Corrections were limited to:

- Status metadata aligned across all three documents to reflect the approved,
  frozen baseline
- Cross-links added between the three documents and the entry point; previously
  only one such link existed
- The proposed documentation structure in §11 of the specification updated to
  list the documents that now exist. It had been written before the Strategy and
  Charter existed and no longer described the folder it appeared in
- Baseline documents marked in that structure to distinguish what exists from
  what is proposed for Phase 2

Spelling and terminology were reviewed and found internally consistent — British
English prose with `organization` retained as the platform's own domain term,
matching the schema. No changes were made on that basis.

### Not included

Recorded explicitly, because absence is a decision:

- **No implementation.** No code, no database schema, no migration, no API, no
  user interface
- **No production change.** Nothing was deployed, enabled or configured
- **No product change.** No behaviour of the platform was altered
- **No control was implemented, wired or tested.** The findings describe the
  starting position, not work performed
- **No evidence collection was started.** Every day without instrumentation
  remains permanently absent from the record

### Known state at baseline

- **All ownership domains are unassigned.** Naming an executive owner is the
  precondition for Phase 2 and the programme's first finding
- The Charter is approved and frozen; **executive ratification is pending**, and
  converts the principles from proposal to constraint
- Two permissive row-level security policies on the global plan catalogue appear
  correct but have no recorded decision. They are the first entries for the
  exception register

---

## Unreleased

### Added — Phase 2 design

**[03-enterprise-knowledge-intelligence.md](03-enterprise-knowledge-intelligence.md) — Enterprise Knowledge Intelligence (EKI)**

Ontology and knowledge design. **Not part of the frozen baseline**; a design
document under architecture review. No code, no schema, no API, no UI.

Written after auditing the platform's existing knowledge substrate, because the
obvious design — a governance ontology with its own objects, graph and storage —
is forbidden by Charter Principle 12. The audit found the platform already has a
complete knowledge-object model in production: typed objects with lifecycle,
immutable versions carrying a **mandatory** confidence reason, typed evidence with
supports/contradicts/context roles, and status transitions that require a
non-empty rationale. Seven of the eight attributes this phase requires of every
object were already structural properties of that model.

EKI therefore introduces no new knowledge machinery — only a governance
vocabulary that the existing machinery carries.

Principal design positions:

- **One graph, eight lenses.** The phase requested eight graphs. Eight graphs
  means eight sources of truth and eight answers to the same question. The eight
  are lens definitions over one typed graph — the pattern the Living Graph
  already uses
- **Three knowledge layers** separated by what makes a statement true: normative
  (an authority defined it), instance (we decided it), observed (the system
  recorded it). Every audit question crosses all three
- **Frameworks are metadata, never structure.** No object kind is named after a
  framework, which is what allows ISO 27001, NIST, CIS, GDPR and HIPAA to be
  added as Obligation and ControlMapping objects with no architectural change
- **Fifteen object kinds**, with five deliberately excluded and the exclusions
  justified — an ontology's failure mode is proliferation
- **Contradiction is a first-class relationship.** Most compliance systems cannot
  represent an inconsistency, so they resolve it by deleting one side
- **The AI may traverse and report; it may not assert compliance, change status,
  approve, or close a finding.** Enforced at the authorization layer, not by
  prompt instruction

Records seven open architecture decisions that must be settled by ADR before
implementation, including one honest structural gap: knowledge objects are
project-scoped, and governance knowledge is organization-scoped.

Makes the Charter's completion rule computable: a Control cannot reach
`operating` without an evidence binding producing records, a binding whose
records stop arriving becomes stale by the passage of time, and a stale binding
becomes a Finding without anyone noticing it should.

### Changed

- README document order and status table updated to list 03 and to state
  explicitly that it is not part of the frozen baseline

### Not changed

**The frozen baseline documents (00, 01, 02) were not modified.**

---

## Version numbering

| Change | Version effect |
|---|---|
| Typography, formatting, broken link | None |
| New finding, updated measurement, new section | Minor (1.x) |
| Architectural decision reversed or superseded | Minor or major, per impact |
| **Change to a Charter principle** | **Major (2.0)** |
| Change to decision principles, governance model, ownership or success criteria | Major |
