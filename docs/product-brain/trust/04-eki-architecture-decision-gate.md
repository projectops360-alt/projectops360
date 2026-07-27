# EKI Architecture Decision Gate

**Phase 2 · Decision Gate · v1.0**
**Date:** 2026-07-26 · **Status of this document:** Complete
**Governed by:** [Enterprise Trust Charter](02-enterprise-trust-charter.md)
**Resolves:** the seven open decisions recorded in
[EKI §11](03-enterprise-knowledge-intelligence.md)

---

# ⬛ GATE STATUS: **READY FOR IMPLEMENTATION DESIGN**

All seven blocking decisions are resolved by accepted ADRs. Remaining questions
are documented below and are individually justified as non-blocking.

**Readiness means:** an implementation team can proceed to schema and interface
design without inventing architecture. It does **not** mean implementation may
begin — see [Exit Criteria](#exit-criteria) for the two prerequisites that remain
outside architecture.

---

## 1. Decision Register

| ID | Decision | ADR | Status | Blocks | Risk if deferred |
|---|---|---|---|---|---|
| **DR-1** | Scope of governance knowledge | [ADR-013](../adrs/ADR-013-governance-knowledge-scope.md) | **Accepted** | All persistence | Total. No EKI object can be stored |
| **DR-2** | Governance objects: shared or separate family | [ADR-014](../adrs/ADR-014-governance-objects-are-knowledge-objects.md) | **Accepted** | Object model | Two divergent lifecycle implementations |
| **DR-3** | Where the normative layer lives | [ADR-015](../adrs/ADR-015-normative-layer-in-knowledge-packages.md) | **Accepted** | Framework loading | Framework text duplicated per tenant; interpretation history destroyed |
| **DR-4** | Trust views: lenses or a separate graph | [ADR-016](../adrs/ADR-016-trust-views-are-living-graph-lenses.md) | **Accepted** | Graph design | Eight sources of truth; cross-cutting questions unanswerable |
| **DR-5** | Trust knowledge in the retrieval corpus | [ADR-017](../adrs/ADR-017-trust-knowledge-in-retrieval-corpus.md) | **Accepted** | Isabella + security | Either an inert domain or an uncontrolled disclosure path |
| **DR-6** | Live traversal or projection | [ADR-018](../adrs/ADR-018-isabella-reasons-live-over-the-graph.md) | **Accepted** | Reasoning | Confidently stale compliance answers |
| **DR-7** | Origin of automatic findings | [ADR-019](../adrs/ADR-019-automatic-findings-originate-in-the-evidence-layer.md) | **Accepted** | Monitoring | Findings that are not reproducible or challengeable |

**No new blocking decisions were discovered.** Two questions surfaced during
resolution and are recorded in §7 as non-blocking.

### DR-1 in detail — the organization-scope resolution

The highest-priority decision. Three options were evaluated against seven
drivers.

| Option | Verdict |
|---|---|
| **A — Organization Governance Project** | **Rejected.** A project that is not a project. It inherits project RLS (a project member would read the control inventory) and project lifecycle (**an ordinary user could archive the control inventory, and it would look like a normal action**). Every consumer of `projects` acquires an invisible exception |
| **B — Nullable `project_id`** | **Rejected.** NULL is the absence of a value, not the presence of a scope. Makes "organization-scoped" indistinguishable from "defective write", puts a branch in the tenant-isolation predicate, and trades an enforced invariant for a convention |
| **C — Explicit knowledge scope** | **Accepted** |

**Selected model.** `scope_type` as a closed vocabulary — `organization` and
`project` at v1 — with:

- **`organization_id` NOT NULL at every scope.** Tenant isolation is untouched and
  **no RLS policy changes**
- `project_id` nullability **governed by a constraint tied to `scope_type`**, so
  a NULL is only reachable when the scope says so. Any other combination is
  rejected by the database
- No polymorphic `scope_id`. Both scope levels already have real, constrained
  foreign keys; `scope_type` selects which is authoritative
- `portfolio` and `platform` deferred with stated reasons: platform-scope content
  lives in knowledge packages (DR-3), and portfolio has no referent that can own
  knowledge

**Why now rather than later.** Shipping B and migrating to C afterwards would
require *interpreting* existing NULLs — deciding per row whether each was
organization-scoped or defective. Today the interpretation is free and certain,
because every row has a project. **The window in which this migration is trivial
closes the moment the first nullable row is written.**

---

## 2. Canonical Object Vocabulary

Fifteen kinds, carried by the existing knowledge-object machinery (ADR-014).
**No object type encodes a framework name.** SOC 2, ISO 27001, NIST, CIS, GDPR
and HIPAA are Obligation instances and ControlMapping instances — data, never
architecture.

### 2.1 Objects evaluated and rejected

| Candidate | Rejected because |
|---|---|
| **Framework** | A *set* of obligations, not an object with a lifecycle, evidence or an owner. Making it an object invites framework-shaped structure — the thing §5 exists to prevent |
| **FrameworkVersion** | An attribute of an Obligation (the authority version it transcribes). A separate object would version a container that holds nothing |
| **Certification** | An Assessment with an external assessor and an expiry. A separate kind duplicates a lifecycle |
| **Audit** | A time-boxed Assessment. Same reasoning |
| **Decision** | Already a first-class platform entity with rationale and approval. Reusing it is required by Charter P12; a governance-specific decision type would fork it |
| **EvidenceRequirement** | The requirement *is* the EvidenceBinding's specification (source, method, strength, freshness tolerance). Splitting requirement from binding creates two objects that must agree, and no query needs them apart |
| **OwnerAssignment** | Ownership is an attribute with an audit trail, not an object. Modelling it separately adds a join to every ownership question and a lifecycle to a fact |

The boundary test applied throughout: **does it have a lifecycle, evidence and an
owner? Three yeses means object.**

### 2.2 The accepted vocabulary

Common to every object and therefore not repeated per kind: title, summary, body,
`structured_content`, confidence with a **mandatory** reason, provenance, content
hash, timestamps, scope (DR-1), and immutable versions.

Legend — **AI draft**: may Isabella create it in `proposed`? · **AI modify**: may
she change an existing one? · **Approver**: which human role must transition it.

---

#### Principle · *normative* · scope: organization
**Purpose** The permanent constraints on every decision (the Charter).
**Required** statement · **what it forbids** · **what it costs** · rationale.
The second and third are required: the Charter's own rule is that a principle
which cannot be violated is a description, and one with no cost is a preference.
**An object missing either is invalid.**
**Optional** examples, adjudicated conflicts.
**Lifecycle** `proposed → ratified → superseded`. No deprecation.
**Ownership** Executive Sponsor. **Versioning** Major on any change.
**Evidence** None — principles are not evidenced, they are ratified.
**Relationships** `constrains →` Policy, Standard, Control.
**AI draft** No · **AI modify** No · **Approver** Executive Sponsor.

#### Obligation · *normative* · **stored as a knowledge package (DR-3)**
**Purpose** What an external authority requires.
**Required** authority · reference · authority version · **verbatim text** ·
applicability.
**Optional** category, related obligations.
**Lifecycle** `active → superseded → withdrawn`. Never "complete".
**Ownership** Compliance — of the *transcription*, never the requirement.
**Versioning** New version when the authority revises. **Evidence** None.
**Relationships** `satisfied_by →` Control *via* ControlMapping.
**AI draft** Yes (transcription proposal) · **AI modify** No · **Approver** Compliance.
**Note** Interpretation is **not** an attribute here — it belongs to the mapping.

#### Policy · *normative* · scope: organization
**Purpose** What we commit to.
**Required** commitment statement · scope · approval authority · effective date ·
review date.
**Lifecycle** `draft → approved → active → under_review → superseded`.
**Ownership** Governance. **Evidence** Approval record.
**Dependencies** At least one Principle. *A policy tracing to no principle is a
preference with formatting.*
**AI draft** Yes · **AI modify** Draft only · **Approver** Executive Sponsor.

#### Standard · *normative* · scope: organization
**Purpose** The specific rule satisfying a policy.
**Required** rule statement · rationale · applicability · verification method ·
exceptions permitted (boolean).
**Lifecycle** `draft → active → superseded`.
**Ownership** Architecture. **Dependencies** Exactly one Policy.
**AI draft** Yes · **AI modify** Draft only · **Approver** Architecture Review.

#### Control · *instance* · scope: organization (project by exception)
**Purpose** A testable assertion we make about ourselves.
**Required** **assertion** (a testable claim — *"privileged access requires MFA"*,
never *"we manage access"*) · operating frequency · automation status ·
implementation state.
**Derived, never writable** effectiveness · last verified · evidence freshness.
**Lifecycle** `proposed → designed → implemented → operating → degraded → ineffective → retired` (§4).
**Ownership** The function that operates it. **Never Compliance.**
**Versioning** New version on assertion change; owner change is an attribute
change with an audit record. **This distinction matters: evidence binds to an
assertion, and evidence collected against the old assertion does not prove the
new one.**
**Evidence** Through EvidenceBinding. **Dependencies** ≥1 EvidenceBinding to reach
`operating`.
**AI draft** Yes · **AI modify** Draft only · **Approver** Control owner + Architecture Review.

#### ControlMapping · *instance* · scope: organization
**Purpose** The claim that a control satisfies an obligation, and how completely.
**Required** coverage strength (`full | partial | compensating`) · rationale ·
**our interpretation of the obligation** (DR-3) · assessor · assessment date.
**Conditionally required** gap description when strength ≠ `full`.
**Lifecycle** `asserted → reviewed → confirmed → disputed → withdrawn`.
**Ownership** Compliance. **Evidence** The assessment supporting the claim.
**AI draft** Yes · **AI modify** No · **Approver** Compliance.
**Why an object and not an edge attribute** A mapping is a claim with a
lifecycle — asserted, reviewed, disputed by an auditor, withdrawn. It carries its
own evidence and confidence. **It is precisely what an auditor challenges.**

#### EvidenceBinding · *instance* · scope: organization
**Purpose** How a control is proven.
**Required** evidence source · collection method · **strength**
(`automated_continuous | automated_periodic | artefact | attestation`) ·
expected frequency · **freshness tolerance** · locator.
**Derived** last observed · current freshness state.
**Lifecycle** `defined → active → stale → broken → retired`. **`stale` and
`broken` are computed by the passage of time, never declared.**
**Ownership** Evidence. **Dependencies** One Control, one source.
**AI draft** Yes · **AI modify** No · **Approver** Evidence owner.

#### Risk · *instance* · scope: organization (project permitted)
**Purpose** What could go wrong.
**Required** description · category · inherent likelihood · inherent impact ·
treatment (`accept | mitigate | transfer | avoid`) · review date.
**Conditionally required** named accepting executive **and expiry** when treatment
is `accept`.
**Derived** residual rating.
**Lifecycle** `identified → assessed → treated → accepted → closed → realised`.
**`realised` is terminal and distinct from `closed`** — a risk that materialised
is not one that was resolved, and collapsing them destroys the only calibration
data a risk register produces.
**Ownership** Risk. **AI draft** Yes · **AI modify** No · **Approver** Risk owner;
Executive Sponsor to accept.

#### Exception · *instance* · scope: organization
**Purpose** A knowing deviation.
**Required** justification · scope · **expiry (mandatory)** · approver.
**Optional** compensating control — *or an explicit statement that none exists.*
**Lifecycle** `requested → approved → active → expired → renewed → closed`.
**`expired` is reached by time, not action, and produces a Finding automatically.**
**Ownership** Risk. **AI draft** Yes · **AI modify** No · **Approver** Per authority threshold.
**Constraint** An Exception without an expiry is **unrepresentable**.

#### Asset · *instance* · scope: organization
**Purpose** What we protect.
**Required** classification · data categories · criticality.
**Optional** residency, external exposure.
**Lifecycle** `inventoried → classified → protected → decommissioned`.
**Dependencies** Classification before `protected`. *Encrypting without
classifying produces cost without a defensible statement about coverage.*
**Ownership** Architecture. **AI draft** Yes · **AI modify** No · **Approver** Architecture Review.

#### Vendor · *instance* · scope: organization
**Purpose** Who else processes this data.
**Required** service · data categories · region · contractual status · review date.
**Optional** their attestation status, criticality.
**Lifecycle** `identified → assessed → approved → under_review → terminated`.
**Ownership** Governance. **Dependencies** ≥1 Asset.
**AI draft** Yes · **AI modify** No · **Approver** Governance.

#### TrustBoundary · *instance* · scope: organization
**Purpose** Where authority changes hands.
**Required** description · what crosses it · authority on each side.
**Optional** threat model reference.
**Lifecycle** `identified → modelled → guarded → obsolete`.
**Dependencies** A threat model to leave `identified`.
**Ownership** Architecture. **AI draft** Yes · **AI modify** No · **Approver** Architecture Review.

#### EvidenceRecord · *observed* · scope: inherits its source
**Purpose** What actually happened.
**Required** occurrence time · record time · source · subject · actor · outcome.
**Lifecycle** **None. Immutable and terminal.**
**Ownership** Evidence, for availability and integrity. **Nobody owns the
content**, because nobody may change it.
**AI draft** No · **AI modify** **Never** · **Approver** N/A.
**Constraint** A **projection**, not a store. The record lives in the canonical
event log. **A copy is not tamper-evident because its original was.**

#### Assessment · *observed* · scope: organization
**Purpose** What we concluded, when.
**Required** scope · method · assessor · **assessor independence** · period
covered · conclusion.
**Conditionally required** expiry when the assessor is external (this is what
makes a certification a certification).
**Lifecycle** `planned → in_progress → complete → expired`.
**Ownership** Compliance. **AI draft** Yes (self-assessment) · **AI modify** No ·
**Approver** Compliance; external assessor for attestations.

#### Finding · *observed* · scope: organization or project
**Purpose** What is broken, who owns it, when it is due.
**Required** description · severity · **source** (`self | assessment | incident |
deterministic | ai_proposed`) · identified date · **owner** · due date.
**Conditionally required** the satisfying condition and state, when source is
`deterministic` (ADR-019).
**Lifecycle** `open → accepted → in_remediation → resolved → verified`.
**`resolved` is the owner's claim; `verified` requires independent confirmation.
Collapsing them is how findings get closed without being fixed.**
**Dependencies** An owner. *A finding with no owner is a complaint.*
**AI draft** **Proposal only**, in `proposed`, visibly attributed, expiring ·
**AI modify** No · **Approver** The remediating function.

---

## 3. Canonical Relationship Vocabulary

Closed, directed, typed. Every relationship states its inverse — an ontology
whose relationships cannot be traversed backward answers *"what does this control
satisfy?"* but not *"what satisfies this obligation?"*, and the second is the
auditor's question.

**Version-sensitive** means the relationship binds to a specific version, so a
new version requires re-assertion.
**Inferable** means a rule or model may propose it.
**Affects status** means an inferred instance may change a compliance state —
**never true**, per Charter P10.

| Relationship | Source → Target | Cardinality | Version-sensitive | Human approval | AI may propose | Inferable | Affects status if inferred | Evidence required |
|---|---|---|---|---|---|---|---|---|
| `derived_from` | Policy → Principle | n:m | No | Yes | Yes | No | — | No |
| `implements` | Standard → Policy | n:1 | No | Yes | Yes | No | — | No |
| `governed_by` | Control → Standard | n:m | No | Yes | Yes | No | — | No |
| `satisfies` | Control → Obligation | via mapping | **Yes** | **Yes** | Yes | Yes | **No** | **Yes** |
| `maps_to` | ControlMapping → Obligation | n:1 | **Yes** | Yes | Yes | Yes | **No** | Yes |
| `applies_to` | Obligation → Asset/Scope | n:m | No | No | Yes | Yes | No | No |
| `provides_evidence_for` | EvidenceRecord → Control | n:m | **Yes** | No | No | **No** | — | is evidence |
| `tested_by` | Control → Assessment | n:m | **Yes** | Yes | No | No | — | Yes |
| `failed_by` | Control → Finding | n:m | **Yes** | Yes | **Proposal only** | Deterministic only | **No** | Yes |
| `mitigates` | Control → Risk | n:m | No | Yes | Yes | Yes | **No** | Yes |
| `threatens` | Risk → Asset | n:m | No | Yes | Yes | Yes | No | No |
| `accepted_as_exception_by` | Control/Standard → Exception | n:m | **Yes** | **Yes** | Yes | **No** | — | Yes |
| `owned_by` | Any → Person | n:1 | No | Yes | **Recommend only** | No | — | No |
| `approved_by` | Any → Person | n:1 | **Yes** | **Yes** | **No** | **No** | — | is evidence |
| `generated_by` | Any → Actor | n:1 | No | No | N/A | No | — | is evidence |
| `observed_by` | EvidenceRecord → Source | n:1 | No | No | No | No | — | is evidence |
| `depends_on` | Control → Control | n:m | No | Yes | Yes | Yes | No | No |
| `supports` | Evidence → Object | n:m | **Yes** | No | Yes | Yes | No | is evidence |
| `contradicts` | Any → Any | n:m | **Yes** | **Review required** | Yes | Yes | **No — but blocks** | Yes |
| `supersedes` | Any → same kind | 1:1 | **Yes** | Yes | No | No | — | No |

### 3.1 Rules that govern the whole vocabulary

**No inferred relationship may change a compliance status.** The rightmost column
is `No` throughout, by design. An inference may propose, highlight or rank; the
transition remains human (Charter P10). This single rule is what keeps AI
assistance from becoming AI authority.

**`contradicts` is the exception that proves it.** An unresolved contradiction
cannot *promote* a status, but it **blocks** one: a control with an unresolved
blocking contradiction may not reach `operating` (§4). Blocking is safe in a way
that promoting is not — the failure mode of a false contradiction is delay; the
failure mode of a false confirmation is a wrong compliance claim.

**Contradiction behaviour.** A contradiction is `unresolved`, `accepted` (with
rationale) or `resolved` (with rationale). It is never deleted. **Most compliance
systems cannot represent an inconsistency, so they resolve it by deleting one
side, and the knowledge survives as neither a record nor a decision.**

**Version sensitivity is not optional where marked.** `satisfies`, `maps_to`,
`provides_evidence_for` and `approved_by` bind to a version. A control's new
assertion does not inherit the old assertion's evidence or approval.

### 3.2 Prohibited relationships

| Prohibited | Why |
|---|---|
| Evidence → Obligation directly | Evidence proves controls; controls satisfy obligations. **Short-circuiting removes the assertion the auditor exists to test** |
| Control → Control `satisfies` | Only obligations are satisfied. Controls `depend_on` |
| Policy → Obligation `satisfies` | Policies are commitments, not compliance claims |
| Any → Framework | Frameworks are metadata, not nodes |
| Unlabelled inferred edge | Every model-created edge is visibly `INFERRED` |

---

## 4. Control Completion Semantics

Formalises the Charter rule:

> **A control is complete when a query returns its evidence.** Not when the
> mechanism exists. Not when the tests pass. **When the rows are there.**

### 4.1 States

| State | Meaning |
|---|---|
| `proposed` | Someone believes this control should exist |
| `designed` | The assertion is defined and an evidence approach is specified |
| `implemented` | The mechanism exists. **The assertion is not yet demonstrated** |
| `operating` | Evidence is arriving within tolerance |
| `degraded` | Evidence is late, partial, or partly contradicted |
| `ineffective` | Evidence shows the assertion does not hold |
| `retired` | Deliberately withdrawn |

`implemented` and `operating` are the load-bearing distinction. **The platform's
governance audit trail — immutable, hash-chained, zero rows — is `implemented`.**

### 4.2 Transition conditions

| From → To | Conditions (all required) |
|---|---|
| `proposed → designed` | Assertion is testable · owner assigned · ≥1 obligation or standard referenced |
| `designed → implemented` | Mechanism exists · EvidenceBinding **defined** |
| **`implemented → operating`** | **All six** below |
| `operating → degraded` | Evidence stale, partial, or a non-blocking contradiction |
| `degraded → operating` | Cause resolved · evidence within tolerance for **one full expected interval** |
| `operating/degraded → ineffective` | Evidence contradicts the assertion, confirmed by a human |
| any → `retired` | Explicit decision with rationale; supersession recorded |

**The six conditions for `operating`:**

1. The implementation exists
2. An EvidenceBinding exists and is `active`
3. **The binding has produced valid evidence** — at least one record
4. Evidence freshness is within the binding's tolerance
5. Required approvals exist (owner, and Architecture Review where the control
   crosses a trust boundary)
6. No unresolved **blocking** contradiction

### 4.3 What is explicitly insufficient

A control **must not** reach `operating` because:

- code exists · a table exists · tests pass · a policy exists · a design was
  approved · **an owner says it is complete**

Every one of these describes the mechanism. None demonstrates the assertion. The
last is named explicitly because it is the one that will be argued for.

### 4.4 Evidence conditions

| Condition | Definition | Effect |
|---|---|---|
| **Fresh** | Latest record within tolerance | Supports `operating` |
| **Stale** | Tolerance exceeded | → `degraded`; **automatic Finding** |
| **Missing** | Binding active, no records | Cannot reach `operating`; **automatic Finding** |
| **Contradictory** | A `contradicts` relationship on evidence | Blocking → prevents `operating`; non-blocking → `degraded` |
| **Failed collection** | The source could not be reached | Binding → `broken`; **automatic Finding**. Distinct from stale: **failure is a system fault, staleness is a control fault**, and conflating them misattributes the problem |

**Freshness tolerance is a property of the binding, not of the platform.** A
daily control and an annual one are not comparable, and a global threshold would
be wrong for both.

### 4.5 Restoration

A degraded control returns to `operating` only after evidence has been within
tolerance **for one full expected interval** — not on the first arriving record.
One record proves the source worked once; an interval proves the control operates.

### 4.6 Human override limits

A human **may**: mark a control `ineffective` despite passing evidence (judgement
overriding measurement is legitimate in the conservative direction); accept a
degraded state via an Exception with an expiry; retire a control.

A human **may not**: mark a control `operating` without the six conditions;
suppress an automatic finding; extend a freshness tolerance retroactively to make
stale evidence fresh.

**The asymmetry is deliberate.** A human may always make the assessment *more*
conservative. Making it less conservative requires evidence, not authority —
because the entire value of the state is that it cannot be asserted.

### 4.7 Exceptions

An Exception may permit operation in a degraded state. It **cannot** manufacture
`operating`. It requires an expiry; on expiry the control returns to its
evidence-determined state and a Finding is raised.

---

## 5. AI Authorization Boundaries

### 5.1 Permitted

Traverse the graph · summarise · compare frameworks · identify missing
relationships · detect stale evidence · propose controls, policies, mappings ·
recommend owners · generate remediation proposals · explain findings · highlight
contradictions · draft objects in `proposed`.

### 5.2 Prohibited

Assert that the organization is compliant · transition a control to `operating` ·
approve a policy · accept a risk · close a finding · approve an exception ·
certify evidence · override a human decision · delete or suppress contradictory
evidence · alter immutable history · change a freshness tolerance · assign
ownership.

### 5.3 How the boundary is enforced

**Not by prompt instruction.** A boundary held only in a prompt is a suggestion —
it survives until an unusual phrasing, a longer context or a model upgrade.

Four enforcement layers, each independently sufficient:

| Layer | Mechanism |
|---|---|
| **Identity** | The AI acts as a distinct actor type, never impersonating a user. Every write carries `generated_by` naming the AI actor and model version |
| **Authorization** | The AI actor holds no capability for prohibited operations. The refusal happens where every other authorization refusal happens |
| **Domain rules** | A transition to `operating` evaluates six conditions regardless of who requests it. **The state machine does not care who is asking** |
| **Evidence** | Every AI action, permitted or refused, is an evidence record. **A recorded refusal is evidence of a working control** |

The third layer is the strongest: even a compromised or misconfigured AI actor
cannot produce `operating` without the evidence conditions being met, because the
conditions are properties of the data.

### 5.4 Decision provenance

Every governance object records: creating actor and type · approving human ·
whether an AI draft preceded approval · the model and persona version if so ·
the human's rationale, which the schema already requires to be non-empty.

**A human approving an AI draft is accountable for the content, not for having
reviewed it.** This is stated because the opposite reading — that review is a
procedural step — is how rubber-stamping is rationalised.

### 5.5 Draft status and expiry

AI drafts enter as `proposed`, are visibly attributed, and **expire**. An
unreviewed proposal is not a finding, is not a control, and **must not be counted
in any coverage or gap metric** — otherwise the AI could improve the compliance
score by generating proposals.

### 5.6 Override logging

Where a human overrides an AI recommendation, both the recommendation and the
override are recorded with rationale. Over time this is the only dataset that
shows whether the AI's governance recommendations are worth following.

---

## 6. Consistency Review

Checked across the ETCF Architecture, Strategy, Charter, EKI Specification and
the seven new ADRs.

| Check | Result |
|---|---|
| Multiple sources of truth | **Pass.** ADR-014 and ADR-016 forbid separate stores and graphs |
| Framework-specific object types | **Pass.** None. Frameworks are Obligation + ControlMapping instances |
| Duplicate graph concepts | **Pass.** One graph, eight lenses (ADR-016) |
| Conflicting lifecycle definitions | **Pass.** §4 is the single Control lifecycle; EKI §2.3 is consistent with it |
| AI authority exceeding the Charter | **Pass.** §5 is narrower than Charter P10 and enforced in four layers |
| Organization/project scope ambiguity | **Resolved** by ADR-013 |
| Evidence completion inconsistencies | **Pass.** §4 formalises the Charter rule; ADR-019 makes it self-enforcing |
| RLS / tenant-isolation ambiguity | **Pass.** `organization_id` NOT NULL at every scope; no policy changes |
| Contradictory terminology | **One issue found and fixed** — see below |

### Issues found

**C-1 — ADR naming convention (resolved here).** The ETCF Architecture
Specification §11 proposes `ADR-T001…` in a `trust/adr/` subdirectory. The
repository convention is `docs/product-brain/adrs/ADR-NNN` with a single index
(`07-adr-index.md`). **A separate ADR registry would itself be a second source of
truth**, which is the thing this entire phase refuses.

The repository convention wins. ADRs are numbered 013–019 in the existing
directory and registered in the existing index.

**The frozen document was not modified.** The proposal in ETCF §11 is superseded
by this gate document and is recorded in C-3 as a candidate correction for a
future baseline revision.

**C-2 — `EvidenceRequirement` (resolved by omission).** Requested for evaluation
in the vocabulary. Rejected: the requirement *is* the binding's specification.
Splitting them creates two objects that must agree, with no query needing them
apart. Recorded in §2.1.

**C-3 — Frozen baseline observation (recorded, not fixed).** Two items in the
frozen ETCF Architecture Specification are superseded by decisions taken here:

1. §11 proposes a `trust/adr/` directory with `ADR-T00x` numbering (C-1)
2. §11's folder listing does not include this gate document or the EKI
   specification, having been written before either existed

**Neither was edited.** Both are recorded as candidate corrections for a future
formal baseline revision, per the instruction not to silently edit a frozen
document. Neither affects a decision — they are structural listings, and this
document is authoritative where they differ.

---

## 7. Remaining Non-Blocking Questions

Each is justified as non-blocking: implementation can proceed and the answer can
change without rework.

| # | Question | Why non-blocking |
|---|---|---|
| 1 | Separate enum for governance kinds, or one vocabulary with a namespace? | Both satisfy ADR-014. A schema-detail choice |
| 2 | Are organization-scoped objects visible in project graph views by default? | A presentation default |
| 3 | Initial freshness threshold values | Tuning. The architecture requires only that they are per binding |
| 4 | Should recurring findings auto-escalate in severity? | A treatment policy, decidable once findings exist |
| 5 | Are obligation packages seeded by migration or administrative import? | Both pipelines exist |
| 6 | Model-driven or rule-driven question classification? | Either, provided it is inspectable (ADR-018) |
| 7 | What happens to project findings when a project is deleted? | A retention policy under M6 |
| 8 | Does the coverage matrix warrant a non-graph surface? | A presentation decision after the lens exists |
| 9 | Latency budget for live status traversal | Measurable once inventory exists; the timestamp rule already governs the fallback |

---

## 8. Implementation Prerequisites

**Architecture is complete. Two prerequisites remain outside it.**

| # | Prerequisite | Status | Source |
|---|---|---|---|
| **P1** | **A named executive owner for Enterprise Trust** | ✗ **Unassigned** | Strategy Rec. 1; Charter §Ownership |
| **P2** | **Executive ratification of the Charter**, converting principles from proposal to constraint | ✗ Pending | Charter §Review Cycle |
| P3 | Seven ADRs accepted | ✓ **Complete** | This document |
| P4 | Object and relationship vocabulary defined | ✓ **Complete** | §2, §3 |
| P5 | Control completion semantics defined | ✓ **Complete** | §4 |
| P6 | AI authorization boundaries defined | ✓ **Complete** | §5 |
| P7 | Attestation scope confirmed (elect Processing Integrity, exclude Privacy) | ✗ Pending executive decision | Strategy Rec. 7 |

---

## Exit Criteria

**Implementation design may begin** when P3–P6 hold. **They hold.**

**Implementation may begin** when P1, P2 and P7 also hold. **They do not.**

The distinction is deliberate. Schema and interface design can proceed against a
complete architecture. Building controls before an owner exists produces controls
nobody is accountable for — which is the failure the Charter's ownership model
exists to prevent, and which this programme has already demonstrated once at
smaller scale in a governance audit trail with zero rows.

### The rule that carries into implementation

> **A control is complete when a query returns its evidence.**
> Not when the mechanism exists. Not when the tests pass.
> **When the rows are there.**

§4 makes it a state machine. ADR-019 makes it self-enforcing. Neither makes it
optional.
