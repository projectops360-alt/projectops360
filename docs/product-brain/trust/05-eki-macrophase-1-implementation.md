# EKI Macrophase 1 — Implementation Notes

**Phase 2 · Macrophase 1 · Foundational platform**
**Date:** 2026-07-26 · **Status:** Implemented, migration **not applied**
**Implements:** [ADR-013](../adrs/ADR-013-governance-knowledge-scope.md) ·
[ADR-014](../adrs/ADR-014-governance-objects-are-knowledge-objects.md) ·
[ADR-015](../adrs/ADR-015-normative-layer-in-knowledge-packages.md)
**Gate:** [EKI Architecture Decision Gate](04-eki-architecture-decision-gate.md)

This document records **what was built and why it looks the way it does**. The
architecture is in the approved documents; nothing here re-decides it.

---

## What was implemented

| # | Scope item | Delivered |
|---|---|---|
| 1 | Knowledge scope model | `scope_type` on the four knowledge tables, governed by constraint |
| 2 | Knowledge object infrastructure | Governance vocabulary extended on the existing model. No second model |
| 3 | Canonical relationships | `project_knowledge_relations`, 15 relation types, semantics enforced in the database |
| 4 | Persistence | One migration: constraints, indexes, foreign keys, integrity rules |
| 5 | RLS | New table secured on the existing pattern. **No existing policy changed** |
| 6 | Repository layer | Scope-aware listing, relation create/resolve/list |
| 7 | Internal APIs | Four server entry points. No UI |
| 8 | Product Brain integration | Trust namespace is a first-class navigation section; ADRs bundled |
| 9 | Tests | 30 new assertions across scope, vocabulary, relations, RLS and navigation |
| 10 | Documentation | This file |

Out of scope and **not** built: evidence engine, findings, control lifecycle,
staleness, Isabella reasoning, Living Graph lenses, dashboards, background jobs,
certifications, SOC 2 logic.

---

## The three decisions that shaped the code

### 1. A composite foreign key would have silently stopped enforcing anything

The child tables reference their parent through
`(knowledge_object_id, organization_id, project_id)`.

Postgres foreign keys default to **MATCH SIMPLE**, under which a composite key is
**skipped entirely when any column is NULL**. Relaxing `project_id` — which
ADR-013 requires — would therefore have removed referential integrity from every
organization-scoped version, evidence row and transition. Nothing would have
failed; orphans would simply have become possible.

Each child gained a second foreign key on
`(knowledge_object_id, organization_id, scope_type)`. Every column is NOT NULL,
so it is always enforced, and including `scope_type` also guarantees a child
cannot disagree with its parent about scope.

The original key is **retained**: for project-scoped rows it still binds the child
to the same project.

### 2. Idempotency would have disappeared at organization scope

`unique (project_id, idempotency_key)` stops enforcing anything once
`project_id` is NULL, because NULLs are distinct. The create RPC's idempotency
guarantee — which prevents a retried proposal becoming two objects — would have
silently applied only to project scope.

A partial unique index on `(organization_id, idempotency_key) where scope_type =
'organization'` restores it.

### 3. Order of operations in the migration

Constraints are added **before** `NOT NULL` is relaxed. The reverse order opens a
window in which the semantics ADR-013 rejected are representable, and rows
written in that window would later need interpretation. A guard test asserts the
ordering, because it is invisible on reading and consequential.

---

## Vocabulary decisions

The governance vocabulary is narrower than the gate document's fifteen kinds, and
each omission follows from an approved ADR rather than from scope-cutting:

| Not persisted as an object | Why |
|---|---|
| Principle, Policy, Standard, Obligation | **ADR-015.** Normative content lives in knowledge packages. It has no lifecycle, no evidence and no owner; storing it as an object would attach three empty properties to every requirement |
| EvidenceRecord | A **projection** over the canonical event log. Persisting it would create the copy Charter P5 forbids — a copy is not tamper-evident because its original was |

`finding` is **reused**, not duplicated as a governance type. A finding is a
finding; scope and relationships distinguish governance from delivery. A second
type would be the first step of the divergence ADR-014 exists to prevent.

Nine kinds were added: `control`, `control_mapping`, `evidence_binding`, `risk`,
`exception`, `asset`, `vendor`, `trust_boundary`, `assessment`.

---

## Relations

Fifteen types, closed vocabulary, enforced by a trigger that validates endpoint
kinds, version sensitivity, version existence and package tenancy.

**No relation targets a person.** `owned_by` is the `owner_user_id` column,
`approved_by` is the actor on a transition, `generated_by` is provenance.
Modelling ownership as an edge would add a join to every ownership question and a
lifecycle to a fact.

**Endpoints are objects or packages**, so a Control object can `satisfy` an
Obligation package — the traversal ADR-015's split makes necessary.

**Contradictions are never deleted.** `resolution_status` moves to `accepted` or
`resolved` and requires a rationale; there is no path back to `unresolved`.
Reopening is a new relation.

**The basis is recorded** (`declared | derived | observed | inferred`). The rule
that an inferred relation may never change a compliance status belongs to the
consuming engines, which are later phases — this layer makes the rule
*enforceable* by ensuring the basis is never unknown.

---

## Duplication that is deliberate

`KNOWLEDGE_RELATION_SPECS` in TypeScript mirrors
`project_knowledge_assert_relation` in SQL. This is intentional: TypeScript
validates early so a caller gets a usable error, the database enforces so nothing
can bypass it.

**Duplication nobody checks is drift.** A guard test parses the migration's CASE
arms and compares them against the TypeScript table, so the two cannot diverge
without failing the build.

---

## Compatibility

`KnowledgeObjectReadModel.projectId` became `string | null` and the model gained
`scope` and `ownerUserId`. The compiler surfaced every consumer, which is the
benefit ADR-013 claimed over a nullable column:

| Consumer | Handling |
|---|---|
| `canonical-graph-projection` | **Filters to project scope explicitly.** The canonical graph emits nodes that carry a project; organization-scoped knowledge belongs to organization-rooted lenses. Filtering keeps the omission visible rather than coercing a null |
| `knowledge-graph-loader` | Reads `scope_type`, defaults to `project` |
| `mpf-proposal`, `process-discovery-backfill` | Declare `scope: "project"` — both concern one project's execution |

**No existing RLS policy was modified.** `organization_id` remains NOT NULL at
every scope, so the tenant predicate is unchanged. That was the point of
preferring an explicit scope over a nullable project.

---

## Known state

**The migration is authored but NOT applied to any environment.** Applying DDL to
shared infrastructure was outside what this phase authorised, and the request was
explicit that nothing be deployed. It must be applied to stage and verified
against a live engine before the schema is relied upon.

Consequently the following are verified **statically** — by contract tests that
parse the migration — and not yet against a running database:

- Constraint rejection of an incoherent scope/project pair
- Foreign-key enforcement for organization-scoped children
- Trigger rejection of an invalid relation endpoint or a cross-tenant package
- RLS behaviour of the new table

Integration verification against a live engine is the first item of the next
macrophase, and should precede any dependent work.
