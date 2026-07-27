# Enterprise Knowledge Intelligence (EKI)

**Knowledge Architecture Specification · v1.0 · Phase 2**
**Status:** Reviewed — all seven open decisions resolved by ADR-013…019.
See the [Architecture Decision Gate](04-eki-architecture-decision-gate.md), which
is authoritative where the two differ · **Date:** 2026-07-26
**Scope:** Ontology and knowledge design only. No code, no schema, no API, no UI.
**Governed by:** [Enterprise Trust Charter](02-enterprise-trust-charter.md) — where this
document conflicts with the Charter, the Charter prevails.
**Companions:** [Architecture Specification](00-etcf-architecture-specification.md) ·
[Strategy](01-enterprise-trust-strategy.md) · [Programme entry point](README.md)

---

## Prior art, and why it decides the design

This specification was written **after** auditing the knowledge substrate that
already exists. That order matters, because the obvious design — a governance
ontology with its own objects, its own graph and its own storage — is forbidden
by the Charter:

> **Principle 12, Compliance as a Product Capability.** *Any design that requires
> a separate system of record for compliance is rejected on that basis. Two
> systems describing the same events will diverge, and the divergence will be
> discovered at the worst possible moment.*

The audit found that the platform already has, in production:

| Existing capability | What it provides |
|---|---|
| `knowledge_packages` / `_versions` / `_localizations` / `_chunks` | Curated, versioned, confidence-tiered, bilingual knowledge with append-only versions and rebuildable embeddings |
| `project_knowledge_objects` / `_versions` / `_evidence` / `_transitions` | **A complete knowledge-object model**: typed objects, lifecycle status, immutable versions with confidence *and a mandatory confidence reason*, typed evidence with supports/contradicts/context roles, and status transitions that require a non-empty rationale |
| `process_nodes` / `process_edges` | A typed graph with closed node and edge vocabularies |
| `project_event_log` | Append-only, hash-chained, retention-classified canonical events |
| `traceability_links` | Polymorphic typed relationships between entities |
| RRF-fused retrieval | Vector + lexical search with reciprocal rank fusion, multilingual by design |
| Grounding gate | An answer is grounded only when the model signals it *and* its citations resolve to retrieved passages |

**EKI therefore introduces no new knowledge machinery.** It introduces an
*ontology* — a governance vocabulary — that the existing machinery carries.

The eight attributes this specification requires of every object (identity,
attributes, relationships, lifecycle, ownership, versioning, evidence,
dependencies) are not a new requirement. Seven of them are already structural
properties of `project_knowledge_objects`. EKI's contribution is to say **what
the governance objects are**, not how objects work.

---

# 1. Enterprise Ontology

## 1.1 The three layers of knowledge

Governance knowledge is not one kind of thing, and conflating the kinds is the
most common failure in compliance tooling. EKI separates three layers by **what
makes a statement in that layer true**.

| Layer | Contains | True because | Changes when | Existing home |
|---|---|---|---|---|
| **Normative** | What a control *is*. Framework requirements, our control definitions, policy statements, standards | An authority defined it | The authority revises it | `knowledge_packages` (global scope) |
| **Instance** | Our actual inventory. This control, owned by this person, mapped to these requirements, with this evidence binding | We decided it | We decide otherwise | **Gap — see §1.4** |
| **Observed** | What actually happened. This control operated on this date. This access was denied. This risk was accepted | The system recorded it | Never — history is append-only | `project_event_log`, `project_knowledge_objects` |

**Every question an auditor asks crosses these layers.** *"Show me that access is
restricted"* requires the normative layer (what does restricted mean?), the
instance layer (which control implements it, who owns it), and the observed layer
(here are the decisions it made). A system that stores only documents can answer
the first. A system that stores only logs can answer the third. **EKI exists to
make the traversal possible.**

## 1.2 Ontology design rules

Five rules, each of which forecloses a failure mode.

**R1 — Closed vocabularies.** Every type, role, status and relationship comes
from an enumerated set. Free-text types cannot be reasoned over, cannot be
validated, and drift into synonyms within a year. This mirrors the event registry
and the graph's existing node and edge vocabularies.

**R2 — One object, many projections.** A control is one object. Its appearance in
the Compliance view, the Evidence view and the Audit view are *lenses*, not
copies. See §5 — this is the most important structural decision in the document.

**R3 — Frameworks are metadata, never structure.** No object type is named after
a framework. A control is a control; SOC 2 CC6.1 and ISO A.5.15 are *mappings*
to it. This is what makes §16 possible.

**R4 — Assertions carry their basis.** Every claim records how it is known:
declared by a person, derived deterministically, observed from an event, or
inferred by a model. The existing corpus already enforces this — a knowledge
object version cannot be written without a non-empty `confidence_reason`.

**R5 — Absence is a first-class state.** "No evidence collected" is a valid,
representable, queryable state distinct from "evidence shows failure" and from
"we have not modelled this". A system that cannot express *not yet* will express
*fine*.

## 1.3 Ontology namespace

Governance objects occupy a reserved namespace so they are distinguishable from
project-execution knowledge at a glance and in a query:

```
trust:<object-kind>:<identifier>
```

Examples: `trust:control:access-mfa-privileged`,
`trust:obligation:soc2:cc6.2`, `trust:policy:access-control`.

Namespacing rather than separate storage is what lets one retrieval path serve
both domains while keeping them addressable independently.

## 1.4 The honest structural gap

`project_knowledge_objects` is **project-scoped** (`project_id` is NOT NULL).
Governance knowledge is **organization-scoped**: a control belongs to the
organization, not to a project.

This is a real gap and this document does not paper over it. Three resolutions
are possible; the choice is a Phase 2 architecture decision requiring an ADR:

**(a) Extend scope.** Allow knowledge objects to be organization-scoped with a
null project. Smallest change, widest blast radius — every consumer of the table
must handle the null.

**(b) Parallel family at organization scope.** A structurally identical
organization-level family. No blast radius, but two structures to keep in step —
which R2 and Charter Principle 12 both argue against.

**(c) Model the organization as a governing scope object.** Governance objects
attach to a scope entity rather than to a project directly.

**Recommendation: (a), with an ADR.** It is the only option that keeps one
knowledge-object model, and the cost is a nullable column rather than a second
system of record.

> **⚠ Superseded — [ADR-013](../adrs/ADR-013-governance-knowledge-scope.md).**
> The recommendation above was **not** accepted. Resolution introduced an
> explicit `scope_type` vocabulary rather than a nullable project, on the
> grounds that a NULL is the absence of a value rather than the presence of a
> scope: it makes "organization-scoped" indistinguishable from a defective
> write, and puts a branch in the tenant-isolation predicate. A fourth option —
> a system-managed "governance project" — was also evaluated and rejected. The
> paragraph above is retained so the reasoning that preceded the decision stays
> visible.

---

# 2. Knowledge Objects

## 2.1 The universal object contract

Every EKI object satisfies the eight-attribute contract below. Where the platform
already provides a property, the source is named — the point of this table is
that **most of the contract is already met**.

| Attribute | Meaning | Existing provision |
|---|---|---|
| **Identity** | Stable, human-readable, namespaced. Survives renaming and re-scoping | `id` + idempotency key |
| **Attributes** | Typed properties defined per object kind | `structured_content` (JSONB) |
| **Relationships** | Typed, directed edges to other objects (§4) | `process_edges` vocabulary, `traceability_links` |
| **Lifecycle** | Enumerated states, with legal transitions, each recording actor and **rationale** | `_transitions` — rationale is already mandatory and non-empty |
| **Ownership** | Exactly one accountable person. Never a team | Charter §Ownership. **New requirement on the object** |
| **Versioning** | Append-only immutable versions with content hash | `_versions` with `content_hash` |
| **Evidence** | Typed references with a role: supports, contradicts, context | `_evidence` — the role vocabulary already exists |
| **Dependencies** | What this object requires to be meaningful (§2.4) | **New. Derived from relationships** |

**Two properties in the existing model are worth naming explicitly**, because
they are unusual and EKI depends on both:

- **A version cannot exist without a confidence reason.** The database refuses an
  empty one. Confidence is never a bare number.
- **A status transition cannot exist without a rationale.** Lifecycle movement is
  never silent.

These are exactly the properties a governance ontology needs, and they were built
for project learning. This is the composition dividend.

## 2.2 The governance object kinds

Fifteen kinds. Each is *either* normative, instance or observed — never two,
because an object that is both a definition and a record of its own operation
cannot be versioned coherently.

| Kind | Layer | Answers | Owner |
|---|---|---|---|
| **Obligation** | Normative | *What does an external authority require?* | Compliance |
| **Policy** | Normative | *What do we commit to?* | Governance |
| **Standard** | Normative | *What specific rule satisfies the policy?* | Architecture |
| **Principle** | Normative | *What constrains every decision?* (the Charter) | Executive Sponsor |
| **Control** | Instance | *What testable assertion do we make?* | The operating function |
| **ControlMapping** | Instance | *Which obligation does this control satisfy, and how completely?* | Compliance |
| **EvidenceBinding** | Instance | *How is this control proven, and how strongly?* | Evidence |
| **Risk** | Instance | *What could go wrong, at what likelihood and impact?* | Risk |
| **Exception** | Instance | *Where do we knowingly deviate, why, and until when?* | Risk |
| **Asset** | Instance | *What are we protecting?* | Architecture |
| **Vendor** | Instance | *Who else processes this data?* | Governance |
| **TrustBoundary** | Instance | *Where does authority change hands?* | Architecture |
| **EvidenceRecord** | Observed | *What actually happened?* | Evidence |
| **Assessment** | Observed | *What did we conclude, when?* | Compliance |
| **Finding** | Observed | *What is broken, who owns it, when is it due?* | The remediating function |

### Kinds deliberately NOT introduced

| Not a kind | Why |
|---|---|
| **Framework** | A framework is a *set of obligations*, not an object with a lifecycle. Making it an object invites framework-shaped structure (R3) |
| **Certification** | An Assessment with an external assessor and an expiry. A separate kind would duplicate Assessment's lifecycle |
| **Audit** | A time-boxed Assessment. Same reasoning |
| **Incident** | An event sequence in the canonical log, not a knowledge object. It *produces* Findings |
| **Procedure** | Operational documentation. It has no independent lifecycle beyond its Standard, and modelling it adds a layer nobody queries |

Restraint here is deliberate. **An ontology's failure mode is proliferation.**
Every kind must earn its existence by answering a question no other kind can.

## 2.3 Object definitions

Each definition gives identity form, distinguishing attributes, principal
relationships, lifecycle, and the dependency that makes it meaningful. Attributes
common to all objects (title, summary, body, provenance, confidence, timestamps)
are not repeated.

---

### Obligation — *normative*

**Identity** `trust:obligation:<authority>:<reference>` — e.g.
`trust:obligation:soc2:cc6.2`

**Attributes** authority, reference, authority version, obligation text (verbatim
— never paraphrased; a paraphrase is an interpretation and belongs in a separate
attribute), interpretation, applicability condition, category.

**Relationships** `satisfied_by →` Control · `belongs_to →` Framework set ·
`supersedes →` Obligation

**Lifecycle** `active → superseded → withdrawn`. Obligations never move to
"complete"; authorities revise, they do not finish.

**Ownership** Compliance. We do not own the text — we own its interpretation.

**Dependencies** None. Obligations are the roots of the compliance graph.

**Note** An obligation's verbatim text and our interpretation are separate
attributes so a change in interpretation is versioned without implying the
authority changed its requirement.

---

### Policy — *normative*

**Identity** `trust:policy:<domain>`

**Attributes** commitment statement, scope, applicability, approval authority,
effective date, review date.

**Relationships** `implemented_by →` Standard · `derived_from →` Principle ·
`referenced_by →` Control

**Lifecycle** `draft → approved → active → under_review → superseded`

**Ownership** Governance, with executive approval to move to `approved`.

**Dependencies** At least one Principle. **A policy that traces to no principle is
a preference with formatting.**

---

### Standard — *normative*

**Identity** `trust:standard:<domain>:<topic>`

**Attributes** rule statement, rationale, applicability, exceptions permitted
(boolean), verification method.

**Relationships** `implements →` Policy · `enforced_by →` Control ·
`excepted_by →` Exception

**Lifecycle** `draft → active → superseded`

**Ownership** Architecture.

**Dependencies** Exactly one Policy. A standard implementing nothing is an
opinion; a standard implementing two policies indicates the policies overlap and
should be merged.

---

### Principle — *normative, permanent*

**Identity** `trust:principle:<name>`

**Attributes** statement, **what it forbids**, **what it costs**, rationale.

The second and third are not commentary. The Charter's own rule is that a
principle which cannot be violated is a description, and one with no cost is a
preference. **An EKI Principle object missing either attribute is invalid** — the
ontology enforces the Charter's own standard for itself.

**Relationships** `constrains →` Policy, Standard, Control · `resolved_by →`
Decision (when a conflict was adjudicated)

**Lifecycle** `proposed → ratified → superseded`. No deprecation — a principle
is replaced by a better one, never merely retired.

**Ownership** Executive Sponsor. **Only object kind whose change requires
executive approval and a major version.**

**Dependencies** None. Principles are the roots of the trust graph.

---

### Control — *instance*

**Identity** `trust:control:<domain>:<assertion>` — e.g.
`trust:control:access:mfa-privileged-roles`

**Attributes** assertion (a **testable claim**, not an activity — "privileged
access requires MFA", never "we manage access"), operating frequency, automation
status, implementation state, current effectiveness, last verified.

**Relationships** `satisfies →` Obligation *via ControlMapping* ·
`enforces →` Standard · `proven_by →` EvidenceBinding · `mitigates →` Risk ·
`protects →` Asset · `depends_on →` Control · `excepted_by →` Exception ·
`constrained_by →` Principle

**Lifecycle** `proposed → designed → implemented → **operating** → degraded → retired`

The distinction between `implemented` and `operating` is the entire point of this
kind, and it is where the Charter's completion rule binds:

> A control is complete when a query returns its evidence. Not when the mechanism
> exists. **When the rows are there.**

`implemented` means the mechanism exists. `operating` means evidence is arriving.
**The platform's governance audit trail — immutable, hash-chained, zero rows —
is `implemented`, not `operating`.** The ontology must be able to say that, and
say it automatically rather than by someone's honest self-assessment.

**Ownership** The function that operates it. **Never Compliance** — Compliance
owns whether we can *prove* controls operate, not the controls themselves. This
distinction determines whether Compliance is a service or a bottleneck.

**Dependencies** At least one EvidenceBinding. A control with no binding cannot
reach `operating` — the ontology makes that unreachable rather than merely
discouraged.

---

### ControlMapping — *instance*

**Identity** `trust:mapping:<control>:<obligation>`

**Attributes** coverage strength (`full` | `partial` | `compensating`), rationale,
gap description when not full, assessor, assessment date.

**Relationships** `maps →` Control · `to →` Obligation

**Lifecycle** `asserted → reviewed → confirmed → disputed → withdrawn`

**Ownership** Compliance.

**Dependencies** One Control, one Obligation.

**Why this is an object and not an edge attribute.** A mapping is a *claim with a
lifecycle*: it is asserted, reviewed, sometimes disputed by an auditor, and
withdrawn. It carries its own evidence and its own confidence. Modelling it as a
property of an edge would make it unversionable and unownable — and the mapping
is precisely what an auditor challenges.

---

### EvidenceBinding — *instance*

**Identity** `trust:binding:<control>:<method>`

**Attributes** evidence source, collection method, **strength**
(`automated_continuous` | `automated_periodic` | `artefact` | `attestation`),
expected frequency, freshness tolerance, query or locator, **last observed**.

**Relationships** `proves →` Control · `draws_from →` EvidenceSource ·
`produces →` EvidenceRecord

**Lifecycle** `defined → active → stale → broken → retired`

`stale` and `broken` are computed, never declared: a binding whose last
observation exceeds its freshness tolerance becomes `stale` automatically. **This
is how the ontology detects a control that quietly stopped operating** — the
condition that makes a Type II window fail, and the one nobody notices because
nothing errors.

**Ownership** Evidence.

**Dependencies** One Control, one EvidenceSource.

---

### Risk — *instance*

**Identity** `trust:risk:<domain>:<name>`

**Attributes** description, category, inherent likelihood, inherent impact,
residual likelihood, residual impact, treatment (`accept` | `mitigate` |
`transfer` | `avoid`), review date.

**Relationships** `mitigated_by →` Control · `threatens →` Asset ·
`accepted_via →` Exception · `realised_as →` Finding · `arises_from →` TrustBoundary

**Lifecycle** `identified → assessed → treated → accepted → closed → **realised**`

`realised` is terminal and separate from `closed`. A risk that materialised is
not a risk that was resolved, and collapsing them destroys the organization's
ability to learn whether its assessments were any good. **Realised risks are the
only calibration data a risk register ever produces.**

**Ownership** Risk, with a named accepting executive when treatment is `accept`.

**Dependencies** None to be identified; a Control or an Exception to leave
`assessed`.

---

### Exception — *instance*

**Identity** `trust:exception:<control-or-standard>:<sequence>`

**Attributes** justification, scope, compensating control, **expiry date
(mandatory)**, approver, approval date.

**Relationships** `excepts →` Control or Standard · `compensated_by →` Control ·
`approved_by →` Person · `creates →` Risk

**Lifecycle** `requested → approved → active → **expired** → renewed → closed`

`expired` is reached by the passage of time, not by an action. **An exception
whose expiry passes becomes a Finding automatically.** The Charter: *an exception
without an expiry is a decision nobody wanted to make in public.* The ontology
makes an expiry-less Exception unrepresentable.

**Ownership** Risk.

**Dependencies** The Control or Standard it excepts, and a named approver.

---

### Asset — *instance*

**Identity** `trust:asset:<class>:<name>`

**Attributes** classification, data categories, residency, criticality, external
exposure.

**Relationships** `protected_by →` Control · `threatened_by →` Risk ·
`processed_by →` Vendor · `crosses →` TrustBoundary

**Lifecycle** `inventoried → classified → **protected** → decommissioned`

**Ownership** Architecture.

**Dependencies** Classification before `protected`. **Encrypting without
classifying produces cost without a defensible statement about coverage** —
stated in the architecture specification and enforced here as a lifecycle
constraint.

---

### Vendor — *instance*

**Identity** `trust:vendor:<name>`

**Attributes** service, data categories processed, region, contractual status,
their attestation status, review date, criticality.

**Relationships** `processes →` Asset · `assessed_by →` Assessment ·
`introduces →` Risk · `inherits_control →` Control

**Lifecycle** `identified → assessed → approved → under_review → terminated`

**Ownership** Governance.

**Dependencies** At least one Asset — a vendor processing nothing is not a
subprocessor and should not be in the register.

**Note on inherited controls.** A vendor's controls are real controls that we do
not operate. Modelling them as `inherits_control` rather than omitting them is
what allows an honest answer to *"who protects this?"* — and prevents the
opposite error of claiming their controls as ours.

---

### TrustBoundary — *instance*

**Identity** `trust:boundary:<name>` — e.g. `trust:boundary:tenant-isolation`,
`trust:boundary:ai-data-access`

**Attributes** description, what crosses it, authority on each side, threat model
reference.

**Relationships** `crossed_by →` Asset · `guarded_by →` Control ·
`source_of →` Risk

**Lifecycle** `identified → modelled → guarded → obsolete`

**Ownership** Architecture.

**Dependencies** A threat model to leave `identified`.

**Why this kind exists.** Trust boundaries are where controls actually matter,
and they are the most commonly implicit concept in compliance programmes.
Naming them makes *"which boundary does this control guard?"* answerable — and
makes an unguarded boundary visible rather than merely unmentioned.

---

### EvidenceRecord — *observed*

**Identity** Derived from the source event. Never minted independently.

**Attributes** occurrence time, record time, source, subject, actor, decision or
outcome, integrity reference.

**Relationships** `evidences →` Control *via* EvidenceBinding ·
`concerns →` Asset · `produced_by →` EvidenceSource

**Lifecycle** **None. Evidence records are immutable and terminal.**

**Ownership** Evidence, for availability and integrity. **Nobody owns the
content**, because nobody may change it.

**Dependencies** An EvidenceBinding to be interpretable as evidence *of* anything.

**Critical constraint.** EvidenceRecord is a **projection**, not a store. The
underlying record lives in the canonical event log. Copying it would create the
second source of truth Principle 12 forbids, and — worse — a copy is not
tamper-evident merely because its original was.

---

### Assessment — *observed*

**Identity** `trust:assessment:<scope>:<date>`

**Attributes** scope, method, assessor, assessor independence, period covered,
conclusion, expiry.

**Relationships** `assessed →` Control, Framework scope, Vendor ·
`produced →` Finding · `relied_on →` EvidenceRecord

**Lifecycle** `planned → in_progress → complete → **expired**`

**Ownership** Compliance.

**Dependencies** A defined scope and an assessor.

**Certifications are Assessments** with an external independent assessor and an
expiry. No separate kind (§2.2).

---

### Finding — *observed*

**Identity** `trust:finding:<source>:<sequence>`

**Attributes** description, severity, source (self-identified, assessment,
incident, **automatic**), identified date, due date, remediation plan, status.

**Relationships** `concerns →` Control, Asset, Vendor · `arose_from →` Assessment
or Incident · `remediated_by →` Control change · `creates →` Risk

**Lifecycle** `open → accepted → in_remediation → resolved → verified`

`resolved` is a claim by the owner; `verified` requires independent confirmation.
**Collapsing them is how findings get closed without being fixed** — the most
common integrity failure in a remediation programme.

**Ownership** The remediating function.

**Dependencies** A subject and an owner. **A finding with no owner is a complaint.**

**Automatic findings.** Several conditions generate Findings without human
action: an Exception passing expiry, an EvidenceBinding becoming `broken`, a
Control in `implemented` beyond a threshold without reaching `operating`, a
Policy past its review date, an unowned domain. **This is the ontology observing
itself**, and it is what prevents a governance programme from decaying quietly.

## 2.4 Dependencies

Dependency is distinct from relationship. A relationship says *these are
connected*. A dependency says **this object is not meaningful without that one**,
and it is enforced at lifecycle boundaries.

| Object | Cannot reach | Without |
|---|---|---|
| Control | `operating` | An EvidenceBinding producing records |
| ControlMapping | `confirmed` | Both endpoints active |
| EvidenceBinding | `active` | A reachable source |
| Risk | `treated` | A Control or an Exception |
| Exception | `approved` | An expiry and a named approver |
| Asset | `protected` | A classification |
| Policy | `active` | At least one Principle |
| Standard | `active` | Exactly one Policy |
| TrustBoundary | `guarded` | A threat model and a Control |
| Finding | any state | An owner |

Dependencies produce the **coverage question** the Trust Dashboard renders:
which objects are stalled, and on what.

---

# 3. Entity Definitions

## 3.1 Attribute typing

Attributes are typed, not free text, so they can be reasoned over rather than
merely displayed:

| Type | Used for | Constraint |
|---|---|---|
| Enumerated | Status, severity, strength, coverage | Closed vocabulary (R1) |
| Reference | Owner, approver, related object | Must resolve; a dangling reference is a Finding |
| Temporal | Effective, expiry, review, observed | Timezone-explicit |
| Textual | Statement, rationale, justification | **Non-empty where the model requires reasoning** |
| Structured | Object-specific payload | Schema per object kind |
| Derived | Effectiveness, freshness, coverage | **Never writable.** Computed from evidence |

The final row is load-bearing. **Derived attributes are the ones that would
otherwise be optimistically self-reported.** Control effectiveness, evidence
freshness and coverage percentage are computed from records or they do not exist.

## 3.2 Provenance on every assertion

Every attribute value carries how it is known. The vocabulary extends the
platform's existing provenance taxonomy rather than inventing one:

| Basis | Meaning | Trust |
|---|---|---|
| `OBSERVED` | Read from a canonical record | Highest |
| `DERIVED` | Computed deterministically from observed data | High — reproducible |
| `DECLARED` | A person asserted it | Medium — carries an author |
| `INFERRED` | A model produced it | Lowest — **must be labelled at point of use** |
| `UNAVAILABLE` | Not knowable | **A value, not an error** |

A Control's `assertion` is `DECLARED`. Its `effectiveness` must be `DERIVED` or
`UNAVAILABLE` — **never `DECLARED`**, because a self-reported effectiveness is
the thing an audit exists to disbelieve.

## 3.3 Identity rules

Identifiers are **stable, human-readable and namespaced**. They survive renaming,
re-scoping and re-owning, because an identifier that changes when the world
changes cannot anchor a history.

An identifier is never reused. A retired control's identity remains bound to its
history — reuse would silently reattribute past evidence to a different assertion.

---

# 4. Semantic Relationships

## 4.1 The relationship vocabulary

Closed, directed, and typed. Each states its inverse, because an ontology whose
relationships cannot be traversed backward can answer *"what does this control
satisfy?"* but not *"what satisfies this obligation?"* — and the second is the
auditor's question.

| Relationship | From → To | Inverse | Semantics |
|---|---|---|---|
| `satisfies` | Control → Obligation | `satisfied_by` | Claims coverage. Strength on the mapping |
| `implements` | Standard → Policy | `implemented_by` | Makes a commitment specific |
| `derived_from` | Policy → Principle | `constrains` | Traces to first cause |
| `enforces` | Control → Standard | `enforced_by` | Makes a rule operative |
| `proven_by` | Control → EvidenceBinding | `proves` | How the assertion is demonstrated |
| `evidences` | EvidenceRecord → Control | `evidenced_by` | An instance of operation |
| `mitigates` | Control → Risk | `mitigated_by` | Reduces likelihood or impact |
| `excepts` | Exception → Control/Standard | `excepted_by` | Knowing deviation |
| `compensated_by` | Exception → Control | `compensates` | Alternative protection |
| `protects` | Control → Asset | `protected_by` | What is defended |
| `threatens` | Risk → Asset | `threatened_by` | What is at stake |
| `processes` | Vendor → Asset | `processed_by` | Third-party data handling |
| `crosses` | Asset → TrustBoundary | `crossed_by` | Where authority changes |
| `guards` | Control → TrustBoundary | `guarded_by` | Boundary enforcement |
| `depends_on` | Control → Control | `required_by` | Operational dependency |
| `supersedes` | Any → same kind | `superseded_by` | Version succession |
| `contradicts` | Any → Any | `contradicted_by` | **Known inconsistency** |
| `concerns` | Finding → Any | `has_finding` | What is wrong |
| `arose_from` | Finding → Assessment/Incident | `produced` | Origin |
| `assessed` | Assessment → Any | `assessed_by` | Evaluation |

## 4.2 `contradicts` — the relationship most systems omit

Governance knowledge contains genuine contradictions: a standard that conflicts
with a vendor's capability, a control that cannot satisfy two obligations
simultaneously, evidence that undermines a mapping.

**Most compliance systems cannot represent a contradiction, so they resolve it by
deleting one side.** The knowledge survives as neither a record nor a decision.

`contradicts` makes the inconsistency a first-class fact with its own lifecycle:
it can be `unresolved`, `accepted`, or `resolved` with a rationale. **The existing
evidence model already supports this** — the `contradicts` role is in the schema's
evidence vocabulary today. EKI extends it from evidence to objects.

This is also what lets Isabella answer *"is there anything that argues against
this?"* — a question a keyword search structurally cannot ask.

## 4.3 Prohibited relationships

| Prohibited | Why |
|---|---|
| Control → Control `satisfies` | Only obligations are satisfied. Controls depend on each other |
| Evidence → Obligation directly | Evidence proves controls; controls satisfy obligations. **Short-circuiting hides the mapping, which is what an auditor challenges** |
| Policy → Obligation `satisfies` | Policies are our commitments, not compliance claims. Only a control can assert coverage |
| Any → Framework | R3. Frameworks are metadata |
| Inferred relationship without label | Every model-created edge is `INFERRED` and visibly so |

The second is the subtle one. It is tempting to bind evidence straight to a
requirement — it shortens the traversal and produces a satisfying dashboard.
**It also removes the assertion that the auditor is there to test.**

---

# 5. The Graph Model

## 5.1 One graph, eight lenses

Phase 2 asks for a Trust Graph, a Compliance Graph, an Evidence Graph, a Policy
Graph, a Control Graph, a Risk Graph, an Audit Graph and a Certification Graph.

**Designing eight graphs would be the wrong answer.** Eight graphs means eight
sources of truth, eight sets of edges to keep consistent, and — inevitably —
eight answers to the same question. That violates R2 and Charter Principle 12,
and it is the failure mode that makes enterprise GRC tooling unusable.

**There is one graph.** The eight are **lenses**: a node-kind filter, an
edge-type filter, a traversal root and a rendering intent, applied to one typed
graph.

The platform already works this way. The Living Graph has lenses — overview,
process, risk, finance, resources, dependencies, benefits, what-if — over one
projection. EKI adopts the same pattern because it is proven here, and because a
lens costs a definition while a graph costs a subsystem.

## 5.2 The lenses

Each lens is a query specification, not a data structure.

### Trust Graph — *the root lens*
**Root** Principle · **Traverses** `constrains → derived_from → implements → enforces`
**Answers** *Why does this control exist, and what principle would we violate by removing it?*
**Renders** The full chain from a Charter principle to an operating control.
**Unique property** The only lens rooted in principles. Every other lens can
answer *what*; this one answers *why*, and it is the lens that makes the Charter
operative rather than decorative.

### Compliance Graph
**Root** Obligation · **Traverses** `satisfied_by → proven_by → evidenced_by`
**Answers** *Are we compliant, and how do we know?*
**Renders** Requirement → control → binding → evidence, with coverage strength at
the mapping and freshness at the binding.
**Key output** Obligations with **no** satisfying control, and mappings marked
`partial` or `compensating`. **The gaps are the point.** A compliance lens that
renders only satisfied obligations is a liability in an audit.

### Evidence Graph
**Root** EvidenceBinding · **Traverses** `produces → evidences`
**Answers** *Is evidence actually arriving, for what, and how recently?*
**Renders** Binding health across the observation window.
**Key output** `stale` and `broken` bindings — controls that stopped operating
without anyone noticing. **This is the lens that would have shown a zero-row
governance audit trail on day one.**

### Policy Graph
**Root** Policy · **Traverses** `derived_from ← / implemented_by →`
**Answers** *What do we commit to, what makes it specific, and is it current?*
**Key output** Policies past review date, and standards implementing no policy.

### Control Graph
**Root** Control · **Traverses** `depends_on`, `guards`, `protects`, `mitigates`
**Answers** *What do we operate, what does it protect, and what breaks if it fails?*
**Key output** Control dependency chains and single points of failure — controls
on which many others depend.

### Risk Graph
**Root** Risk · **Traverses** `mitigated_by`, `threatens`, `accepted_via`, `realised_as`
**Answers** *What could go wrong, what reduces it, and what did we accept?*
**Key output** Risks with no mitigating control, accepted risks near expiry, and
**realised risks compared to their prior assessment** — the only calibration
signal a risk register produces.

### Audit Graph
**Root** Assessment · **Traverses** `assessed`, `produced`, `relied_on`
**Answers** *What was examined, concluded, and what came of it?*
**Key output** Findings past due, and evidence relied upon by an assessment that
has since become stale — *the finding an auditor makes about a previous audit*.

### Certification Graph
**Root** Assessment where assessor is external
**Answers** *What attestations do we hold, over what scope, expiring when, and
does the scope still describe us?*
**Key output** Expiring attestations, and **scope drift** — controls that have
changed since they were attested. Scope drift is the failure that turns a
renewal into a re-implementation, and it is invisible without this traversal.

## 5.3 Why lenses rather than graphs

| | Eight graphs | One graph, eight lenses |
|---|---|---|
| Sources of truth | Eight | **One** |
| Cost of a new relationship | Update every affected graph | Available to every lens immediately |
| Cost of a new framework | Potentially a new graph | A set of Obligation objects |
| Contradiction between views | Inevitable, discovered late | **Structurally impossible** |
| Cost of a new lens | A subsystem | **A definition** |
| Isabella's reasoning surface | Eight, must choose one | One, traverses freely |

The final row decides it. **An AI reasoning across eight disconnected graphs must
first decide which graph the question belongs to — and the questions worth asking
cross all of them.** *"What is our largest unmitigated exposure, and what
principle does it threaten?"* spans risk, control, evidence and trust.

---

# 6. AI Reasoning Model

## 6.1 What is forbidden

The Phase 2 brief is explicit: never keyword search alone, never document
retrieval alone, always semantic reasoning. The ontology makes the reason
concrete.

**Keyword search fails** because governance vocabulary is synonym-dense. "Access
control", "authorization", "least privilege", "permission management" and
"entitlement review" describe overlapping obligations under five names. Lexical
matching finds the document that used the querier's word.

**Document retrieval alone fails** for a subtler and more important reason:
**the answer to a governance question is usually not in any document.**

*"Are we compliant with CC6.2?"* is answered by a traversal — obligation →
mapping (with its coverage strength) → control (with its lifecycle state) →
binding (with its freshness) → evidence records (with their recency). **No
document contains that answer**, because the answer changes daily and depends on
whether records arrived last week.

A retrieval-only system answers from the document that describes what we
*intended*. That is the most dangerous possible answer: confident, well-sourced,
and describing a state that may no longer hold.

## 6.2 The four-stage reasoning model

### Stage 1 — Question classification
Determine what *kind* of question this is, because the kind determines the
strategy:

| Class | Example | Strategy |
|---|---|---|
| **Definitional** | *What is a compensating control?* | Retrieval over normative layer |
| **Inventory** | *Which controls protect customer data?* | Graph query |
| **Status** | *Are we ready for a Type II?* | **Graph traversal + evidence aggregation** |
| **Causal** | *Why does this control exist?* | Trust lens traversal to principle |
| **Gap** | *What is missing?* | **Absence query over dependencies** |
| **Historical** | *When did this last operate?* | Evidence record query |
| **Hypothetical** | *What breaks if we drop this?* | Dependency traversal |

**Misclassification is the primary failure mode.** A Status question answered as
Definitional produces a fluent description of intent presented as current state.
When classification is ambiguous, the model must ask rather than guess — and the
ontology supports this because the question classes are distinguishable by the
object kinds they touch.

### Stage 2 — Entity resolution
Resolve the question's terms to ontology objects — using retrieval, which is
where semantic search belongs: **finding the right node, not the answer.**

Ambiguity is surfaced, not resolved silently. *"MFA"* may resolve to a control, an
obligation and a finding; the right response names all three.

### Stage 3 — Traversal
Select the lens and traverse. The traversal is **deterministic**: the model
chooses the starting point and the lens; the graph produces the path. This is
Charter Principle 9 — prefer computation that can be reproduced over inference
that can only be believed.

**The traversal itself is the explanation.** Not a narration of one.

### Stage 4 — Grounded synthesis
Compose an answer that cites the objects and evidence traversed. The platform's
existing grounding gate applies unchanged: an answer is grounded only when the
model signals it **and** its citations resolve.

## 6.3 Reasoning constraints

**Absence is answered, not filled.** *"How do we handle data residency?"* with no
Asset carrying residency returns *we have not modelled this* — never a plausible
paragraph. **This is where a retrieval-only system is most dangerous**, because a
generic corpus always contains something relevant-sounding about data residency.

**Every claim states its layer.** Normative (*what we committed to*), instance
(*what we built*), observed (*what happened*) — never blended into one confident
sentence. Blending is how *"we require MFA"* means all three of "the policy says
so", "the control exists" and "it is enforced", which may have three different
truth values.

**Derived figures are recomputed, never recalled.** A coverage percentage in the
corpus is stale by construction.

**Contradictions are surfaced.** If `contradicts` edges touch the traversal, they
appear in the answer. **An answer that hides a known contradiction is worse than
no answer**, because it forecloses the question.

**Confidence is compositional.** An answer is no more confident than its weakest
link. A `DERIVED` figure resting on a `stale` binding is stale, however precise it
looks.

## 6.4 Reasoning boundaries

| The AI may | The AI may not |
|---|---|
| Traverse and report | Assert compliance where the graph shows a gap |
| Compute coverage from records | Change an object's status |
| Surface contradictions | Resolve a contradiction |
| Draft an object for human review | Approve, ratify or accept a risk |
| Propose a mapping | Confirm a mapping |
| Identify a candidate finding | Close a finding |

Every item on the right requires human accountability (Charter Principle 10).
**These are not policy preferences — they are the authorization boundary**, and
they must be enforced where authorization is enforced rather than by prompt
instruction. A boundary held only in a prompt is a suggestion.

---

# 7. Knowledge Versioning and Evolution

## 7.1 Versioning

The existing model already provides what EKI needs: append-only immutable
versions, content hashing, a mandatory confidence reason, and status transitions
requiring a rationale.

Three EKI-specific rules extend it:

**Normative objects version on meaning, not wording.** Reformatting a policy is
not a version. Changing what it commits to is. The distinction is judgement and
belongs in the transition rationale.

**Instance objects version on assertion.** Changing a control's assertion is a new
version; changing its owner is an attribute change with an audit record. **The
distinction matters because evidence binds to an assertion** — evidence collected
against the old assertion does not prove the new one.

**Observed objects never version.** They are immutable. Correction is a
compensating record, mirroring the event log.

## 7.2 Evolution

Governance knowledge changes for four distinct reasons, and conflating them
destroys the organization's ability to learn:

| Driver | Example | Effect |
|---|---|---|
| **Authority change** | A framework revision | New Obligation versions; mappings become `disputed` pending review |
| **Our decision** | We adopt a stricter standard | New Standard version; affected controls to `proposed` |
| **Discovery** | An assessment finds a gap | New Finding; possibly a new Control |
| **Erosion** | A binding goes stale | Automatic Finding; control effectiveness degrades |

**Erosion is the one most systems cannot see**, because nothing changed — that is
precisely the problem. It is detected by the passage of time against a freshness
tolerance. **It is the mechanism by which a compliance programme decays between
audits**, and making it visible is among EKI's highest-value properties.

## 7.3 Learning

The existing knowledge-object model already carries `pattern`, `lesson_learned`
and `root_cause` types with a `proposed → validated → active` lifecycle. EKI
inherits it for governance:

- A Finding recurring across assessments proposes a `pattern`
- A realised Risk whose assessment underestimated it proposes a `lesson_learned`
- A control repeatedly excepted proposes that **the control is wrong** — the
  Charter's own rule that a circumvented control is a defective control

**All arrive as `proposed`.** Promotion to `active` requires a human transition
with a rationale, which the schema already enforces. The system may notice; only
a person may conclude.

---

# 8. Isabella Enterprise Intelligence

## 8.1 Domain, not persona

Isabella gains an **enterprise trust domain**, not a second personality. The
existing expert registry already scopes domains; EKI adds one.

The domain changes three things: the objects she may traverse, the authorization
governing that traversal, and — most importantly — **the standard of honesty**,
which is higher here than anywhere else in the product.

A wrong answer about a project slipping costs a correction. **A wrong answer about
a control operating costs an audit finding, and possibly a customer.**

## 8.2 What she can answer

| Class | Example |
|---|---|
| Posture | *Are we ready for a Type II?* |
| Coverage | *Which obligations have no control?* |
| Traceability | *What principle does this control serve?* |
| Evidence | *When did this last operate, and how do you know?* |
| Impact | *What breaks if this control fails?* |
| History | *What did we accept, when, and by whom?* |
| Preparation | *What would an auditor ask that we cannot answer?* |

The last is the most valuable and only becomes possible with an ontology: it is
a query for objects that **cannot complete a traversal** — obligations with no
control, controls with no binding, bindings with no records.

## 8.3 Non-negotiable behaviours

**She reports gaps as readily as strengths.** An assistant that only surfaces
green has stopped assessing (Charter Success Criterion 7).

**She never asserts compliance.** She reports what the graph shows. *"CC6.2 is
satisfied by a control in `implemented` state with no evidence records"* — never
*"we are compliant with CC6.2."*

**She distinguishes the three layers in every answer**, so *committed*, *built*
and *operating* never blur.

**She refuses outside her authority.** She cannot change status, approve, or
close. The refusal is enforced at the authorization layer and is itself recorded
— **and a recorded refusal is evidence of a working control**, worth more to an
auditor than an approval.

**She says "not yet" without decoration.** Charter Success Criterion 1: an
answer of *not yet* is a finding, not a failure.

## 8.4 Access

Trust knowledge is more sensitive than project knowledge: it enumerates our
weaknesses. Access follows purpose-bound authorization, and **every trust-domain
query is itself an evidence record** — including the denials.

A customer-facing projection exposes posture and commitments, never findings,
risk ratings or exceptions. **That boundary is a TrustBoundary object**, guarded
by a control, like any other.

---

# 9. Integration with Platform Intelligence

EKI is not adjacent to the platform's intelligence layers. Each integration below
is a **composition**, not an interface.

## Living Graph
EKI objects are graph nodes; the eight lenses are lens definitions. The
progressive-disclosure contract (UX-015) applies unchanged: **show objects first,
reveal evidence on selection.** A compliance graph that renders every control,
mapping, binding and record at once is unreadable — the same failure UX-015
already solved for knowledge objects.

## Process Intelligence
Control operation **is** a process. Process Intelligence already derives how work
actually flowed from the event log; applied to control operation it answers the
Type II question — *did this control operate consistently over the window?* —
by measurement rather than by sampling.

**This is the strongest integration in the document.** It converts the most
labour-intensive part of an audit into a query.

## Decision Intelligence
Governance decisions — risk accepted, exception approved, mapping confirmed — are
decisions with rationale and approval, which Decision Intelligence already
models. Approval-as-data rather than approval-as-email is the difference between
sampling and querying.

## Knowledge Evolution Engine
Governance knowledge evolves by the same mechanism as project knowledge:
proposed → validated → active, with evidence and rationale. **No new engine.**

## Risk Engine
The Risk Engine scores project risk. Enterprise risk uses the same likelihood ×
impact structure at a different scope. **The scoring logic is shared; the register
is separate**, because a project risk and an enterprise risk have different owners
and different acceptance authorities. Sharing scoring while separating registers
is the correct boundary — merging them would put project delivery risks in front
of the board.

## PMO Intelligence
Compliance readiness is portfolio state. The PMO Portfolio Living Graph already
composes engines without recomputing them (ADR-012); the trust lens is one more
composition.

## GitHub Intelligence
Change management evidence. Merge, review, CI result and deployment are the
records that prove the change control operates — and they already exist as
ingested facts. **The control is already evidenced; nothing has bound the evidence
to it.**

## Project Intelligence
Two directions. Governance obligations that constrain a project (a regulated
customer's requirements) become project constraints. Project evidence flows back
as control evidence.

---

# 10. Framework Extension

## 10.1 The extension mechanism

Adding a framework creates **Obligation objects and ControlMapping objects.
Nothing else.**

No new object kind, no new relationship, no new lens, no schema change. This
follows from R3 — frameworks are metadata, never structure — which is the single
decision that makes the property hold.

**The procedure**, identical for every framework:

1. Author one Obligation per requirement, with verbatim text and our interpretation
2. Assess each against the existing control inventory
3. Create ControlMappings with honest coverage strength
4. Requirements with no mapping become Findings
5. Remediate: new controls, new bindings
6. The Compliance lens, rooted at the new framework, reports readiness

Step 4 is where the value concentrates. **The gap list is generated, not
compiled** — which is the difference between a two-week exercise and a query.

## 10.2 What each framework adds

| Framework | Obligations | Additional demand |
|---|---|---|
| **SOC 2** | Trust Services Criteria | None — the reference implementation |
| **ISO 27001** | Annex A controls | An ISMS: scope, Statement of Applicability, management review, internal audit. **These are Assessment and Policy objects, not new kinds** |
| **NIST CSF** | Subcategories | A profile: a *selection* of obligations. A saved lens filter |
| **CIS Controls** | Safeguards | Implementation-group selection. Another obligation subset |
| **GDPR** | Articles | Lawful basis and data-subject rights as Asset attributes; DPIAs as Assessments; the subprocessor register as Vendor objects |
| **HIPAA** | Safeguards | PHI as an Asset classification; BAAs as Vendor attributes. Only if healthcare is pursued |

**Every entry resolves to existing kinds.** That is the test the design was built
to pass, and it is worth stating plainly why it passes: because no object was
named after a framework.

## 10.3 The overlap dividend

A single control typically satisfies several frameworks' requirements. Because
mappings are objects rather than structure, one control carries many mappings, and
**the marginal cost of each additional framework falls** as the inventory matures.

The first framework costs the control inventory. The second costs mapping. The
fifth costs mapping against controls that mostly already exist.

**This is the compounding return the Strategy claims**, and §10.1 is the mechanism
by which it is real rather than asserted.

---

# 11. Open Architecture Decisions

**RESOLVED.** All seven were decided by ADR on 2026-07-26. See the
[EKI Architecture Decision Gate](04-eki-architecture-decision-gate.md), which is
authoritative where it differs from the recommendations below.

The recommendations are retained as written so the reasoning that preceded each
decision remains visible. **Decision 1 changed during resolution**: the
recommendation here was to extend knowledge objects to organization scope; the
accepted decision introduces an explicit scope vocabulary instead, because a
nullable project is the absence of a value rather than the presence of a scope.

| # | Decision | Recommendation at time of writing | Resolved by |
|---|---|---|---|
| **1** | Scope of governance knowledge objects (§1.4) | **(a)** Extend knowledge objects to organization scope. Only option preserving one model | [ADR-013](../adrs/ADR-013-governance-knowledge-scope.md) — **superseded the recommendation** |
| **2** | Are EKI objects knowledge objects, or a distinct family sharing the pattern? | **Knowledge objects**, namespaced. Principle 12 | [ADR-014](../adrs/ADR-014-governance-objects-are-knowledge-objects.md) |
| **3** | Does the normative layer live in `knowledge_packages` or as objects? | **Packages** — already versioned, tiered, bilingual and indexed | [ADR-015](../adrs/ADR-015-normative-layer-in-knowledge-packages.md) |
| **4** | Are the eight lenses Living Graph lenses or a separate surface? | **Living Graph lenses.** R2 | [ADR-016](../adrs/ADR-016-trust-views-are-living-graph-lenses.md) |
| **5** | Does trust knowledge enter the retrieval corpus, given it enumerates weaknesses? | **Yes, with purpose-bound authorization** — a separate corpus is a second source of truth | [ADR-017](../adrs/ADR-017-trust-knowledge-in-retrieval-corpus.md) |
| **6** | Does Isabella traverse the graph live, or read a projection? | **Live for status, projection for definitions.** A cached status answer is the failure mode of §6.1 | [ADR-018](../adrs/ADR-018-isabella-reasons-live-over-the-graph.md) |
| **7** | Where do automatic Findings originate? | The evidence layer, as derived observations. **Never the AI** — an automatic finding must be reproducible | [ADR-019](../adrs/ADR-019-automatic-findings-originate-in-the-evidence-layer.md) |

---

# 12. What This Design Refuses

Recorded because a design is defined as much by its refusals.

**No compliance-only data store.** Principle 12.

**No object named after a framework.** R3, and the reason §10 works.

**No AI-authored governance state.** The AI proposes; a person transitions, with a
rationale the schema already requires.

**No self-reported effectiveness.** Effectiveness is `DERIVED` from evidence or
`UNAVAILABLE`.

**No compliance score without decomposition.** A score that cannot be opened to
the specific unmet control is a vanity metric.

**No blending of the three layers.** Committed, built and operating are separate
claims with separate truth values.

**No silent contradiction resolution.** Contradictions are objects.

**No evidence copied out of the canonical log.** A copy is not tamper-evident
because its original was.

**No eight graphs.** One graph, eight lenses.

---

## Closing note

The Architecture Specification found the platform's best-designed control surface
containing zero records — a mechanism built correctly and never connected. The
Charter answered with a completion rule: *a control is complete when a query
returns its evidence.*

**EKI's contribution is to make that rule computable.** A Control cannot reach
`operating` without an EvidenceBinding producing records; a binding whose records
stop arriving becomes `stale` by the passage of time; a stale binding becomes a
Finding without anyone noticing it should.

The ontology's most important property is not that it represents governance
knowledge. It is that **it notices when governance knowledge has stopped being
true** — which is the only failure that matters between audits, and the one no
document can catch.
