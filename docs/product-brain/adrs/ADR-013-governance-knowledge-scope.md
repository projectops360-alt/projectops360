# ADR-013 — Governance knowledge is scoped explicitly, not by a nullable project

**Status:** Accepted
**Date:** 2026-07-26
**Pillars:** All · **Supersedes:** the open decision recorded as EKI §11 #1
**Related:** [EKI Specification](../trust/03-enterprise-knowledge-intelligence.md) ·
[Enterprise Trust Charter](../trust/02-enterprise-trust-charter.md) ·
[ADR-004 Knowledge OS substrate](ADR-004-knowledge-os-substrate.md) ·
[ADR-007 Product Brain is source of truth](ADR-007-product-brain-is-source-of-truth.md)

---

## Context

The Enterprise Knowledge Intelligence design requires governance knowledge —
controls, policies, risks, exceptions, findings — to be represented using the
platform's existing knowledge-object model rather than a separate compliance
store. That constraint comes from the Charter:

> **Principle 12.** *Any design that requires a separate system of record for
> compliance is rejected on that basis.*

The existing model (`project_knowledge_objects` and its version, evidence and
transition tables) provides almost everything EKI needs: typed objects, an
enforced lifecycle, immutable versions carrying a mandatory confidence reason,
typed evidence with `supports | contradicts | context` roles, and status
transitions that cannot be written without a rationale.

It carries one structural assumption that EKI cannot satisfy: **every knowledge
object belongs to a project**, enforced by `project_id NOT NULL`.

## Problem

Governance knowledge is predominantly organization-scoped. A control is owned by
the organization and operates across every project; a policy commits the
organization; a subprocessor is a fact about the organization. Some governance
knowledge is genuinely project-scoped — a finding raised against one project's
execution — but the inventory is not.

There is no correct value for `project_id` on an organization-scoped control.
Until this is resolved, no EKI object can be persisted, which blocks the entire
implementation phase.

## Decision drivers

| # | Driver | Source |
|---|---|---|
| D1 | One canonical knowledge model. No compliance-specific store | Charter P12 |
| D2 | Invariants must be **enforced**, not conventional | Charter P2 (evidence over assumptions) |
| D3 | Tenant isolation must not become conditional or special-cased | Charter P3, P4 |
| D4 | Closed vocabularies; no implicit meanings | EKI R1 |
| D5 | No semantic fiction a future developer will misread | Charter P7 (no hidden decisions) |
| D6 | Future scopes must not require schema redesign | EKI §10 |
| D7 | Existing consumers of the knowledge model must not silently change behaviour | Compatibility |

## Considered options

### Option A — Organization Governance Project

A system-managed project row per organization, holding all governance knowledge.
No schema change.

| Dimension | Assessment |
|---|---|
| Compatibility | Perfect. Nothing changes |
| Genuine project or fiction? | **Fiction.** It has no execution, no milestones, no schedule, no team. It is a project only so that a NOT NULL constraint is satisfied |
| RLS | Inherits **project** RLS. Governance authorization is organization-level and role-sensitive; the two do not coincide. A project member would gain read access to the control inventory |
| Lifecycle | A project can be archived, completed or soft-deleted by a user with ordinary project permissions. **The control inventory would vanish**, and it would look like a normal action |
| Visibility | Appears in project lists, portfolio rollups, the Living Graph, PMO metrics, exports and counts. Every one of those must special-case it — and each omission is a defect |
| Cross-project reasoning | A project-scoped finding cannot be related to an organization control without traversing a fake project |
| Evidence provenance | Evidence would appear to concern a project that does not exist operationally |
| Hidden coupling | **High.** Every consumer of `projects` acquires an invisible exception |

**Rejected.** This option satisfies the constraint by lying about the data. D2,
D3, D5 all fail, and the deletion risk alone is disqualifying: a governance
inventory that an ordinary user can archive by accident is not a governance
inventory.

### Option B — Nullable `project_id`

Allow `project_id` to be NULL, meaning organization scope.

| Dimension | Assessment |
|---|---|
| Schema semantics | NULL carries meaning by convention. **NULL is the absence of a value, not the presence of a scope** |
| Ambiguity | "Organization-scoped" and "project not set / write defect" become indistinguishable. There is no query that separates them |
| Backward compatibility | Every existing consumer must now handle NULL. Those that do not will silently include or exclude governance objects |
| RLS | The isolation predicate must branch on NULL. **A branch in an isolation predicate is where cross-tenant leaks come from** |
| Query behaviour | `WHERE project_id = $1` silently excludes organization knowledge; joins drop rows |
| Graph traversal | Project-rooted traversals lose organization objects with no signal |
| Migration | Trivial — drop NOT NULL |
| Future scopes | Portfolio or platform scope would require this decision again, differently |
| Invariant | **Removes an enforced invariant and replaces it with a convention** |

**Rejected.** It is the cheapest option and the one that fails D2, D4 and D6.
Dropping a NOT NULL constraint does not add a capability; it removes a guarantee
that roughly a hundred call sites currently rely on without knowing it.

### Option C — Explicit knowledge scope

Introduce `scope_type` as a closed vocabulary, with the scope's identity carried
by the columns that already exist.

| Dimension | Assessment |
|---|---|
| Long-term correctness | Scope becomes a stated property rather than an inference |
| Complexity | One column plus a constraint |
| Migration | Existing rows take `scope_type = 'project'`. **No data interpretation required** — the value is derivable with certainty from the existing NOT NULL |
| Authorization | The isolation predicate reads an explicit value rather than testing for absence |
| Referential integrity | **Preserved.** Both `organization_id` and `project_id` remain real foreign keys — see the note on polymorphism below |
| Graph traversal | Traversals declare their scope; a project-rooted query can explicitly include or exclude organization objects |
| Scope inheritance | Expressible: a project-scoped object may be governed by an organization-scoped one |
| Justified now? | Yes — see below |

**Accepted.**

## Decision

**Governance and project knowledge share one model, distinguished by an explicit
scope.**

1. Knowledge objects carry **`scope_type`**, a closed vocabulary. At v1 the
   accepted values are exactly **`organization`** and **`project`**.

2. **`organization_id` remains NOT NULL for every scope.** Every knowledge
   object belongs to exactly one tenant. This is the property that makes the
   decision safe: **tenant isolation is not affected by this change at all.**

3. `project_id` becomes nullable, but its nullability is **governed by a
   constraint tied to `scope_type`**, not left to convention:

   - `scope_type = 'project'` → `project_id` must be present
   - `scope_type = 'organization'` → `project_id` must be absent

   This is the decisive difference from Option B. The physical schema is
   similar; the invariant is not. Under B, a NULL means whatever the reader
   assumes. Here, a NULL is only reachable when the scope explicitly says so, and
   any other combination is rejected by the database.

4. **`portfolio` and `platform` are deferred**, and the reasons are recorded
   rather than left as an implied "later":

   - **Platform scope is not needed.** Normative content that must be visible to
     every tenant — framework obligations, standards — lives in
     `knowledge_packages`, which already supports a global scope
     (`organization_id` NULL). See [ADR-015](ADR-015-normative-layer-in-knowledge-packages.md).
     ProjectOps360's own governance programme is organization-scoped, using our
     own organization. Adding platform scope here would require relaxing
     `organization_id`, which is the one thing this decision refuses to do.
   - **Portfolio scope has no consumer.** Portfolio is currently a *view* over
     projects, not an entity that can own knowledge. Adding a scope with no
     referent would violate D4.

   Adding either later is an additive change: a new vocabulary value plus a
   constraint branch. The abstraction is in place; the values are not invented
   before they are needed.

## Detailed rationale

**Why an explicit scope rather than a nullable column, when the physical result
is similar.**

The difference is where the meaning lives. A nullable `project_id` puts the
meaning in the *reader* — every query author must know that NULL means
organization. An explicit `scope_type` puts the meaning in the *row*, and the
database enforces that the row is coherent.

This distinction is not stylistic. It determines what a mistake looks like. Under
Option B, a write that forgets to set `project_id` produces a valid
organization-scoped object. Under this decision, the same write is rejected,
because `scope_type` defaults to nothing and the constraint requires the pair to
agree.

**Why this is not polymorphism.**

A common objection to explicit scope models is that they require polymorphic
foreign keys — a `scope_id` that points at different tables and therefore cannot
be a real foreign key. **This decision avoids that entirely.** There is no
`scope_id`. Both scope levels already have their own real, constrained foreign
key column on the table. `scope_type` selects which one is authoritative; it does
not replace either. Referential integrity is unchanged.

**Why the additional abstraction is justified now, and not later.**

Deferring it means shipping Option B and migrating to Option C afterwards. That
migration would have to *interpret* existing NULLs — deciding for each row
whether it was organization-scoped or defective. Today the interpretation is free
and certain: every row is project-scoped, because the constraint has always
required it. **The window in which this migration is trivial is the window before
the first nullable row is written.**

**Why the vocabulary is closed at two values.**

EKI R1. A vocabulary with speculative values invites speculative code. Two values
cover every object kind the EKI ontology defines. The mechanism for adding a
third is documented above and is additive.

## Consequences

### Positive

- One knowledge model, one lifecycle, one evidence model, one versioning model
  for both project learning and governance knowledge (D1)
- Scope is queryable, so "all organization controls" and "all project findings"
  are both expressible without inference
- **Tenant isolation is untouched.** `organization_id` remains NOT NULL and every
  existing RLS policy continues to work unchanged (D3)
- The invariant is stronger than today's, not weaker: today the model says
  *belongs to a project*; afterwards it says *belongs to a project, or explicitly
  to the organization, and never ambiguously* (D2)
- Future scopes are additive (D6)

### Negative

- Every consumer that assumes `project_id` is present must be reviewed. This is
  work, and it is the same work Option B would require **except that here the
  compiler and the constraint help**, because the scope is explicit and typed
- One additional column and one constraint to maintain
- Queries that legitimately span both scopes must say so, which is slightly more
  verbose than a query that accidentally spans both

### Risks

| Risk | Severity | Mitigation |
|---|---|---|
| A consumer written before this change silently includes organization objects in a project view | Medium | Scope is explicit, so the audit is mechanical: find every query on the knowledge tables and confirm it declares scope |
| A future scope is added carelessly, relaxing `organization_id` | **High** | This ADR states that relaxing `organization_id` is out of scope for any future value. A change that does so supersedes this ADR and requires its own |
| The constraint is written permissively (allowing both null and non-null) | High | The validation criteria below make the constraint's behaviour a testable requirement in both directions |

## Security implications

**Positive, and this is the strongest argument for the decision.**

Option B would place a NULL test inside the tenant-isolation path. Isolation
predicates must be unconditional; a branch is where a leak hides, and it is the
kind of defect that passes review because the common case works.

This decision keeps `organization_id` NOT NULL for every row at every scope, so
the isolation predicate is identical for governance and project knowledge and
**no existing RLS policy requires modification**.

Scope is an *authorization* concern layered above isolation, not a substitute for
it: a member may be entitled to project knowledge but not to the organization's
control inventory. That is a role check on top of an unchanged tenant boundary —
two independent layers, which is the pattern the platform already uses for route
gates and action gates.

## RLS and tenant-isolation implications

- **No change to the tenant boundary.** `is_org_member(organization_id)` remains
  the predicate for every knowledge row
- Governance objects require an **additional** authorization check by role and
  purpose. That check belongs in the authorization layer, not in RLS, because it
  is role- and purpose-sensitive rather than tenant-sensitive
- No policy gains a NULL branch
- Cross-tenant leakage is structurally unaffected: there is no scope value at v1
  for which `organization_id` is absent

## Evidence implications

- Evidence attaches to a knowledge object, not to a project, so the existing
  evidence table works for both scopes with no change
- Organization-scoped evidence may reference project-scoped events. This is
  correct and necessary: a control operating across projects is evidenced by
  events that occurred within them
- **Evidence remains a projection.** This decision does not copy events into the
  governance layer — see EKI §2.3 (EvidenceRecord) and Charter P5

## AI-governance implications

- Isabella's traversals must declare scope. A question about "our controls"
  resolves to organization scope; "this project's findings" to project scope.
  **An answer that silently mixes scopes is a defect**, because it would present
  a project-local finding as an organizational fact
- The AI may propose objects at either scope; it may not set scope on an approved
  object, because scope determines authorization
- Scope must appear in Isabella's answer when it is not obvious from the question

## Migration implications

Conceptual only — no migration is written by this ADR.

1. Add `scope_type` with a default of `'project'` — correct for every existing row
2. Backfill is a no-op; the default is the truth
3. Add the constraint. **It passes on existing data by construction**, because
   every current row has a project
4. Relax `project_id` NOT NULL **only after** the constraint exists, so no
   ungoverned NULL can ever be written

Order matters. Relaxing the column before adding the constraint opens a window in
which Option B's ambiguity is representable, and rows written in that window
would need interpretation later.

**Reversible.** Reversal requires deleting organization-scoped rows or assigning
them a project. That is a deliberate, visible operation — not a silent one.

## Compatibility with existing architecture

| Component | Impact |
|---|---|
| Knowledge OS retrieval | None. Retrieval reads packages, not objects |
| Living Graph | Additive: organization-scoped nodes become available to org-rooted lenses |
| Product Brain | None |
| Existing knowledge objects | Behaviour unchanged; every row keeps its scope |
| RLS | **No policy changes** |
| Event log | None. Evidence is projected, not copied |

## Alternatives rejected

| Option | Rejected because |
|---|---|
| **A — Governance project** | A project that is not a project. Inherits project RLS and project lifecycle, so an ordinary user could archive the control inventory. Every consumer of `projects` acquires an invisible exception. Fails D2, D3, D5 |
| **B — Nullable `project_id`** | NULL is the absence of a value, not the presence of a scope. Makes "organization-scoped" and "defective write" indistinguishable, puts a branch in the isolation path, and removes an enforced invariant in exchange for a convention. Fails D2, D4, D6 |
| **C′ — Polymorphic `scope_id`** | A generic scope identifier cannot be a real foreign key, trading an enforced invariant for a lookup convention. Rejected in favour of using the existing constrained columns |
| **Separate governance tables** | Charter P12. Two systems describing the same knowledge diverge, and the divergence surfaces during an audit |

## Validation criteria

The decision is correctly implemented when all of the following hold. Each is
executable.

1. A row with `scope_type='project'` and no project is **rejected by the database**
2. A row with `scope_type='organization'` and a project is **rejected by the database**
3. No row of any scope has a null `organization_id`
4. Every pre-existing knowledge object reports `scope_type='project'`
5. No RLS policy on the knowledge tables contains a null test on `project_id`
6. A query for a project's knowledge returns no organization-scoped object unless
   it declares that it wants both
7. Organization-scoped evidence may reference project-scoped events, and does not
   copy them

## Implementation guardrails

- **The constraint is added before the NOT NULL is relaxed.** Not the reverse
- `scope_type` has no default other than `'project'`, and that default exists only
  to make the migration a no-op. New writes state their scope explicitly
- No consumer may infer scope from the presence or absence of a project
- Adding a scope value requires a new ADR, and **relaxing `organization_id` is
  out of scope for any such ADR** — that would be a different decision about
  tenancy, not about knowledge scope

## Rollback

Additive and reversible while no organization-scoped rows exist. Once they do,
rollback requires an explicit decision about their disposition. The cost of
reversal rises with adoption, which is expected and is why the decision is made
before implementation rather than during it.

## Open follow-up questions (non-blocking)

1. Should organization-scoped knowledge objects be visible in project-level
   Living Graph views by default? *Non-blocking: a presentation default, changeable
   without schema impact.*
2. When a project is deleted, what becomes of project-scoped governance findings
   that informed an organization-scoped control? *Non-blocking: the evidence
   reference persists; the retention rule is a policy decision under M6.*
