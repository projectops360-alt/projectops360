# EKI Macrophase 2 — Implementation Notes

**Phase 2 · Macrophase 2 · Evidence engine and governance findings**
**Date:** 2026-07-26 · **Status:** Implemented and **validated in stage**
**Implements:**
[ADR-019 — Automatic findings originate in the evidence layer, never in the AI](../adrs/ADR-019-automatic-findings-originate-in-the-evidence-layer.md) ·
[ADR-014 — Governance objects are knowledge objects](../adrs/ADR-014-governance-objects-are-knowledge-objects.md)
**Gate:** [EKI Architecture Decision Gate](04-eki-architecture-decision-gate.md)
— §2.2 binding lifecycle, §4 control lifecycle and completion semantics,
§5 AI authorization boundaries, and the evidence-as-projection constraint
**Builds on:** [Macrophase 1](05-eki-macrophase-1-implementation.md)

This document records **what was built, what it refuses to do, and the five
defects a real database found that reading the code did not**. The architecture
is settled in the approved documents; nothing here re-decides it.

---

## The one capability

**Governance Audit Evidence Activation.** One control — *"every governance action
writes an immutable, hash-chained record"* — is measured by one binding against
one real source, `platform_governance_audit`, and its state is computed from what
that measurement finds.

One capability, end to end, is the point. A framework that can express a hundred
controls and has never proved one is a claim, not a capability.

The finding that motivated the programme: at the start of this macrophase
`platform_governance_audit` held **zero rows**. The table existed, the schema was
correct, and nothing wrote to it. That is precisely the failure the engine now
detects instead of assuming.

---

## What was implemented

| # | Scope item | Delivered |
|---|---|---|
| 1 | Governance audit writes | `eki_record_governance_event` — the only write path; wired to real knowledge mutations and control transitions by trigger |
| 2 | Evidence binding runtime | `eki_evidence_binding_runtime` with a closed resolver vocabulary and per-binding freshness policy |
| 3 | Evidence evaluation | `eki_evidence_evaluations`, append-only, six outcomes, `sequence_no` identity ordering |
| 4 | Control lifecycle | `eki_control_runtime` + `eki_control_state_transitions`; state **computed**, six operating conditions gated by `eki_control_can_operate` |
| 5 | Automatic findings | `eki_upsert_finding` — idempotent per (organization, target, condition); recurrence counted, never duplicated |
| 6 | Human-authorized resolution | `eki_resolve_finding` / `eki_assign_owner` — owner/admin only, rationale mandatory, denial audited |
| 7 | Repository layer | `src/lib/eki-evidence/repository.ts` — reads via the caller's client (RLS applies), writes via the service-role client |
| 8 | Domain services | `src/lib/eki-evidence/service.ts` — fail-closed authorization and validation |
| 9 | Internal APIs | `src/lib/eki-evidence/server.ts` — 13 entry points. **No UI** |
| 10 | Tests | 63 vitest assertions + a 27-check real-database acceptance script |
| 11 | Regression register | REG-027 … REG-031 |
| 12 | Documentation | This file |

Migrations: `20260864000000_eki_evidence_engine.sql`,
`20260865000000_eki_governance_audit_and_findings.sql`.

Out of scope and **not** built: UI, dashboards, Isabella reasoning over
governance, background schedulers, certification logic, a second resolver.

---

## The rules the code enforces

### A control state is computed, never asserted

`eki_control_can_operate` returns a decision **and its reasons**. Six conditions
must all hold:

1. the control specification is active,
2. at least one binding exists,
3. every binding is healthy,
4. evidence is fresh within the binding's own tolerance,
5. an owner is named,
6. no blocking contradiction is open.

A state string that says `degraded` and a state that says *`degraded` because its
owner is unassigned* demand different work, and one string cannot say which. The
gate is returned alongside the state, never folded into it.

**Freshness is per binding, never global.** A daily control and an annual one are
not comparable and one threshold would be wrong for both.

### The engine fails closed

Six outcomes, and only two of them pass:

| Outcome | Passing | Meaning |
|---|---|---|
| `current` | ✅ | evidence within tolerance |
| `approaching_stale` | ✅ | inside the warning window — visible, still passing |
| `stale` | ❌ | evidence lapsed. A **control** fault |
| `unavailable` | ❌ | the source could not be read. A **system** fault |
| `invalid` | ❌ | the source answered something unusable |
| `contradictory` | ❌ | the evidence disagrees with itself |

`unavailable` and `invalid` are deliberately not `stale`. An unreachable source
and a lapsed control need different owners and different remediation; conflating
them sends the work to the wrong person. Neither is ever read as passing — an
exception handler that returned a pass would be indistinguishable from a source
that was read and said yes, which is the failure mode a trust system exists to
prevent.

`evidence_missing` and `evidence_stale` are likewise separated by whether any
evidence exists at all: never-evidenced and lapsed are different problems.

### A human may only become more conservative

A human may always lower a control. Raising one requires evidence. Closing a
finding does **not** by itself restore `operating` — the control is recalculated
from evidence afterwards, and if the evidence still fails the state stays where
it is. Acceptance step 21 pins this against a real database.

The whole value of `operating` is that it cannot be asserted.

### A finding is idempotent, and its recurrence is counted

`primary key (organization_id, target_object_id, condition_code)`. The same
condition holding on the tenth evaluation raises no tenth finding; it increments
`occurrence_count`. A backlog that grows by one row per evaluation is noise, and
noise is how a real finding gets missed.

### Evidence is a projection, not a copy

Nothing copies rows out of `platform_governance_audit`. The resolver counts and
takes a maximum; the evaluation records *what it found*, not the evidence itself.
A copy is not tamper-evident because its original was (Charter P5; the gate's
evidence constraint, §"A projection, not a store").

### Nothing sensitive reaches the audit record

`eki_safe_metadata` strips `access_token`, `authorization`, `body`, `content`,
`password`, `payload`, `raw_payload`, `secret` and `transcript` before any
metadata is persisted. Verified by acceptance steps 23 and 24: a forbidden key is
absent, a safe key survives.

---

## The five defects a real database found

None of these was visible in review. All five are now guarded by tests that fail
if the defect returns.

### REG-027 — a replaced view kept its definition and lost its grants

`create or replace view` cannot reorder columns, so the Macrophase 1 migration
drops and recreates. **Dropping a view discards its grants.** The recreated view
was correct and unreadable. The failure surfaces as an empty screen, not an
error. The guard enumerates every `drop view` in the migration and requires a
matching regrant, so a new drop cannot be added without one.

### REG-028 — `||` on a text[] is not append

```sql
failures := failures || 'no_fresh_evidence';   -- 22P02: malformed array literal
```

The right-hand side parses as an array *literal*, not an element. It occurred in
five places, all inside the control gate — the code path that runs when a control
is **already failing**. `array_append` throughout.

### REG-029 — `now()` is transaction time

The most consequential of the five, and it manifested twice.

Two evaluations written in one transaction received an identical `evaluated_at`.
`order by evaluated_at desc limit 1` became non-deterministic, the engine read a
stale evaluation as the latest one, and **a control could never reach
`operating`** — the single state the programme exists to establish.

Separately, freshness measured as `now() - latest_evidence` compared against an
increasingly wrong "now" inside a long transaction, so evidence that aged during
the transaction was reported as current.

Fixed with `evaluated_at timestamptz not null default clock_timestamp()`, a
`sequence_no bigint generated always as identity` for ordering, and
`clock_timestamp() - v_latest` for age. The repository orders by `sequence_no`
too, and a test pins that — reintroducing the timestamp ordering on the read side
would restore the defect with the migration untouched.

### REG-030 — a shared trigger read a column that not every table has

One audit trigger serves three knowledge tables. PL/pgSQL resolves
`new.<column>` when the statement executes, not when the branch is taken, so
resolving the actor type with a shared expression over `new.knowledge_type`
raised `42703` on the two tables that lack it. The column is now read only inside
its own `TG_TABLE_NAME` branch, with a `v_actor_type text := 'human'` default.

### REG-031 — the denial rolled back the proof that it happened

`eki_resolve_finding` wrote an `access_denied` audit record and then `RAISE`d.
The exception rolled back the audit insert made in the same transaction. The
refusal left no trace.

A system that logs only its successes cannot demonstrate that it refuses
anything — which is exactly the claim an auditor tests (Charter P7).

Denials are now **returned** as `{authorized: false, reason}`. Nothing is mutated
on the denied path. The service layer converts the denial into an error for the
caller, *after* the record exists.

Found by the acceptance run reporting `denegacion_auditada = false` while every
functional step passed. The engine worked; its evidence of working did not exist.

---

## Duplication that is deliberate

The TypeScript vocabularies in `src/lib/eki-evidence/types.ts` mirror the check
constraints in the migrations. TypeScript validates early so a caller gets a
usable error; the database enforces so nothing can bypass it.

**Duplication nobody checks is drift.** A guard test parses each `check (… in (…))`
out of the migration and compares it, sorted, against the TypeScript tuple. A
value added to one side and not the other fails the build.

The same applies to the authorization matrix: `authorizeEvidenceAction` exists to
fail before the round trip, **not instead of it**. `eki_resolve_finding` and
`eki_assign_owner` check the actor's role independently. Removing the TypeScript
check must not grant anything.

---

## Actor identity

`server.ts` takes the organization, user and role from `getOrgContext()` and never
from an argument. A caller that could name its own organization would be able to
evaluate, close findings and reassign ownership in a tenant it has no access to —
and the audit trail would faithfully record the forged identity as fact.

Reads go through the caller's client so RLS applies. Writes go through the
service-role client, because every mutation is a database function that refuses
any other role. Same split as the knowledge layer; no parallel data-access
pattern was introduced.

### A stated boundary

The service-role guard is written `auth.role() <> 'service_role'`. For a
PostgREST caller `auth.role()` is always populated — `authenticated`, `anon` or
`service_role` — so every client path is covered. On a **direct database
connection** it is NULL, the comparison yields NULL, and the guard does not fire.
That path requires database credentials, which already confer more authority than
the guard protects, and it is what allows the acceptance script and future
scheduled evaluation to run. It is recorded here as a known boundary rather than
left to be rediscovered.

---

## Stage validation (2026-07-26)

Applied to **stage only** (`gcxcljfzleasrleyyyda`). Production untouched.

The acceptance script (`supabase/tests/eki_macrophase2_acceptance.sql`) runs the
whole lifecycle inside a transaction that is **rolled back**. Result: **27 of 27
checks passing**, residue zero.

| Step | Property | Result |
|---|---|---|
| 0 | A non-privileged actor is available | present |
| 1–2 | Control and binding created at organization scope | ✅ |
| 3–5 | No fresh evidence → not `current`, control not `operating`, one finding | ✅ |
| 6–8 | Re-evaluation reuses the finding; recurrence counted, not duplicated | ✅ |
| 9–10 | A real governance action writes a hash-chained audit record | ✅ |
| 11–12 | Fresh evidence → `current` → control reaches **`operating`** | ✅ |
| 13–15 | Tolerance narrowed → `stale` → control becomes **`degraded`**, finding raised | ✅ |
| 16 | The finding is a canonical knowledge object, not a private row | ✅ |
| 17 | Unauthorized resolution **rejected**, the refusal **recorded**, nothing mutated | ✅ |
| 18–20 | Authorized resolution succeeds, is audited, and cannot be modified | ✅ |
| 21 | Closing a finding does **not** by itself restore `operating` | ✅ |
| 22 | The resolver fails closed on invalid input | ✅ |
| 23–24 | Forbidden metadata stripped, safe metadata preserved | ✅ |

Ageing is done by narrowing the binding's tolerance, never by mutating evidence.
The evidence table is append-only and the test must not be able to do what the
product forbids.

### A skipped check reported as a pass

The first run of step 17 **skipped**: the organization it selected had no
non-privileged member, and the step reported `passed = true` for a path that was
never exercised. That is the same trap as Macrophase 1's probe 11, and it is
worse than a failure, because a green result retires the question.

The script now provisions a non-privileged member inside the transaction and
raises if it cannot. The denial path is exercised or the run fails; it can no
longer be quietly absent.

### Residue

Verified zero after the run: bindings, evaluations, controls, transitions, open
findings, governance audit rows, acceptance knowledge objects and provisioned
memberships all back to 0.

---

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | green |
| `npm run test:run` | green |
| `npm run build` | green |
| `src/lib/eki-evidence/__tests__/**` | 63 assertions, all passing |
| Real database (stage) | 27 / 27 |

---

## What this does not yet do

The engine measures **one** control against **one** source. Nothing surfaces it:
there is no UI, no dashboard, no Isabella integration and no scheduler, so an
evaluation happens only when something calls it. A second resolver, and the
scheduling that makes staleness detectable without a caller, are the next
macrophase.

Stating it plainly matters more than it looks: a governance engine that is only
evaluated when someone remembers to ask cannot detect the lapse it exists to
detect.
