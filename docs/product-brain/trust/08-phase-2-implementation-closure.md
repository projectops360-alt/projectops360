# Enterprise Trust — Phase 2 Implementation Closure

**Phase 2 · Enterprise Knowledge Intelligence**
**Date:** 2026-07-27
**Status:** **PHASE 2 COMPLETE — CONTROLLED INTERNAL PRODUCTION ACTIVATION**

Companion to the baseline and deployment record in
[08-phase-2-production-activation-baseline.md](08-phase-2-production-activation-baseline.md).

---

## Macrophase status

| | Scope | Status |
|---|---|---|
| **1** | Knowledge scope, governance vocabulary, canonical relations | complete · PR #215 merged |
| **2** | Evidence engine, control lifecycle, governance findings | complete · PR #216 merged |
| **3** | Automated evaluation, second resolver, Trust context, Isabella, Living Graph lens | complete · PR #217 merged |
| **4** | Production migration, verification, hardening | complete · PR #218 merged (`4920f36`) |
| **4b** | Rollout scoping and controlled internal activation | complete · PR #219 merged (`fe06e96`) |

---

## Production migrations applied

Ten migrations, applied byte-for-byte from the repository via
`supabase db push --linked` (never `--include-all`), CLI 2.109.1, linked to
`ocopmlnkvidvmxgiwvxw` and verified before any DDL.

```
20260860000000 … 20260868000000    the nine reviewed files
20260869000000                     REG-037 hardening, applied after a failing probe
```

Getting there required reconciling a migration history that had drifted for
months: 64 Studio-applied versions with no file in the repository, 50 repository
files with no history entry, and three pairs of files sharing a version number.
That work is recorded in §5–§7 of the baseline document. **No production data was
modified by any of it.**

---

## Data integrity

Every pre-migration count preserved exactly.

| Measure | Before | After |
|---|---|---|
| Knowledge objects · versions · evidence · transitions | 5 · 5 · 210 · 5 | **5 · 5 · 210 · 5** |
| Organizations · active projects | 76 · 132 | **76 · 132** |
| Read-model view rows | 5 | 5 |
| Orphan versions · orphan evidence | — | 0 · 0 |
| `scope_type = 'project'` | — | **5** |
| `scope_type = 'organization'` · `project_id is null` | — | **0 · 0** |

The scope backfill required **no interpretation**: every existing object was
project-scoped and became `scope_type = 'project'`. No organization scope was
created accidentally, and no invalid scope combination exists.

Nothing started on its own: 0 evaluation runs, 0 evaluations, 0 findings, 0
controls, 0 bindings, 0 governance audit rows.

---

## Security verification

Eight probes, run against production after `20260869000000`. **8 of 8 pass.**

| Probe | Result |
|---|---|
| No API role can execute any EKI function | pass |
| `service_role` retains execute on every EKI function | pass |
| Every EKI `SECURITY DEFINER` function fixes `search_path` | pass |
| Every EKI table has RLS enabled | pass (7/7) |
| Every EKI table has member-read and service-role policies | pass (7/7) |
| **No API role holds any write privilege on an EKI table** | pass (0) |
| `authenticated` retains `SELECT` where intended | pass (8/8) |
| Read-model view enforces the caller's RLS | pass — `security_invoker = true` |

Platform posture held: **169/169 tables with RLS**, 0 without, 600 policies, and
**0** `SECURITY DEFINER` functions without a fixed `search_path`.

One probe failed on the first run and produced **REG-037** — see below.

---

## Feature-flag state

State **immediately after the Macrophase 4 migration**, before the controlled
activation recorded at the end of this document. Kept for the record; the final
state is in "Final production flag state" below.

| Capability | State |
|---|---|
| Backend EKI persistence | **active** — tables, functions, policies live |
| Governance audit writes | **active** — the write path exists and is service-role only |
| `EKI_AUTOMATED_EVALUATION_ENABLED` | **OFF** — `/api/eki/evaluate` answers 404; the daily cron is deployed but inert |
| `EKI_TRUST_REASONING_ENABLED` | **OFF** — Isabella routes exactly as before |
| `LIVING_GRAPH_TRUST_LENS_ENABLED` | **OFF** — the lens is not offered |
| Customer-wide exposure | **OFF** |

This was the state before activation. See the controlled internal activation
section for what is live now.

---

## Regressions

| ID | Discovered | Guard |
|---|---|---|
| REG-027 | Macrophase 2 | view recreate must restore grants |
| REG-028 | Macrophase 2 | `array_append`, not `\|\|` with a literal |
| REG-029 | Macrophase 2 | `clock_timestamp()` and sequence ordering |
| REG-030 | Macrophase 2 | table-specific columns only inside their branch |
| REG-031 | Macrophase 2 | denials returned, never raised |
| REG-034 | Macrophase 3 | `actor_role` admits `none`; `none` denied everything |
| REG-035 | Macrophase 3 | trust routing matches plural and Spanish inflections |
| REG-036 | Macrophase 3 review | every EKI function revoked from the API roles |
| **REG-037** | **Macrophase 4 production probe** | **`revoke all` + explicit re-grant; no API write privilege** |

All nine carry an executable guard. The register and the map are current.

---

## What Macrophase 4 found that review had not

**REG-037.** TRUNCATE remained granted to `anon` and `authenticated` on all seven
EKI tables. TRUNCATE bypasses RLS *and* row-level triggers, so the `BEFORE
DELETE` append-only guards on `eki_evidence_evaluations` and
`eki_control_state_transitions` would never have fired. A publishable-key holder
could have erased the immutable evidence history.

Every earlier check asked *can this role read another tenant's data?* and the
answer was correctly no. Nobody had asked *can this role destroy the evidence?*
RLS does not answer that, and neither did the triggers.

The fix revokes ALL and re-grants only `select`, because enumerating privileges
to remove is what produced the gap.

---

## Known limitations

Superseded by the limitations recorded at the end of this document, after the
controlled internal activation. One item stands on its own:

- **The migration tracker is now accurate**, for the first time in this project.
  It was not before, and the placeholder files record honestly which versions
  have no reproducible source.

---

## Rollback and disable

- **Disable any user-facing capability**: unset the corresponding variable in
  Vercel. Immediate, no migration, and **no evidence is deleted** — the history
  remains for audit while the surface disappears.
- **Stop all automated evaluation**: unset `EKI_AUTOMATED_EVALUATION_ENABLED`.
  The endpoint returns 404 and the cron becomes inert.
- **Database rollback** is possible while no organization-scoped knowledge object
  exists (currently 0). After that, reversing `20260863000000` requires an
  explicit decision about those rows, which ADR-013 anticipated.

---

## Operational ownership

The evaluator runs as the service role with no human actor. Findings are raised
by the engine and can only be closed by an `owner` or `admin`, with a mandatory
rationale, recorded immutably. Isabella may explain and propose; it cannot
resolve a finding, change a control state or approve anything, and that boundary
lives in the domain layer and the database rather than in a prompt.

---

## Phase 2 status

**PHASE 2 COMPLETE — DATABASE ACTIVATED, APPLICATION EXPOSURE OFF.**

The status `PHASE 2 COMPLETE — CONTROLLED PRODUCTION ACTIVATION` is **not**
claimed: controlled activation requires the staged flag rollout, and that did not
happen.

No compliance claim is made. ProjectOps360 is not SOC 2 compliant, not certified,
and not audit-ready; no external auditor has reviewed anything here. What exists
is a mechanism that measures evidence, computes control state from what it finds,
raises findings when evidence lapses, and refuses to assert anything it cannot
support. Whether that mechanism satisfies any framework is a question for an
auditor, not for this document.

---

# Controlled internal activation (2026-07-27)

## What had to be built first

The three capability flags were booleans. Setting one to `true` would have
exposed Enterprise Trust to **all 76 production organizations** — a controlled
internal rollout was not expressible with what existed.

`EKI_TRUST_ORGANIZATION_IDS` (PR #219, merged `fe06e96`) follows the staged-
rollout pattern the repository already uses. **Deny by default:** an empty or
unset allowlist enables the capability for nobody, even when the boolean flag is
`true`. Treating empty as "everyone" would mean one missing variable silently
exposes every tenant.

Three gates, each behaving as if the capability simply did not exist:

| Surface | Outside the approved scope |
|---|---|
| Isabella | returns `not_a_trust_question` → falls through to retrieval, behaviour unchanged |
| Living Graph lens | reports `disabled`, identical to the flag being off; runs no query |
| Scheduled sweep | covers only allowlisted organizations, one scoped run each with its own idempotency key |

Isabella deliberately does **not** answer "there is no Enterprise Trust context"
outside the scope. That would be a visible degradation for a tenant never meant
to see the capability.

## Rollout scope

One internal, founder-controlled organization: **`dc8205c1-c4a2-4f3c-83b9-0e1589590c13`**
(slug `xxx-demo`), 10 members, 35 privileged-access evidence rows. No new
organization was created — an existing verified internal one was used.

**No external customer organization is enabled.**

## Final production flag state

| Setting | Value |
|---|---|
| EKI database infrastructure | **ON** |
| Governance audit writes | **ON** (service-role only) |
| `EKI_TRUST_ORGANIZATION_IDS` | the one internal organization |
| `EKI_AUTOMATED_EVALUATION_ENABLED` | **true**, scoped by the allowlist |
| `EKI_TRUST_REASONING_ENABLED` | **true**, scoped by the allowlist |
| `LIVING_GRAPH_TRUST_LENS_ENABLED` | **true**, scoped by the allowlist |
| `EKI_EVALUATOR_SECRET` | generated (32 random bytes) and stored; never printed |
| External customer exposure | **OFF** |
| Global rollout | **OFF** |

## Production acceptance flow — 15 of 15

Run against the internal organization inside a transaction that was **rolled
back**, so production carries no acceptance residue.

| Step | Result |
|---|---|
| Control and active EvidenceBinding exist | ✅ |
| The binding becomes due | ✅ |
| The evaluator claims it exactly once | ✅ |
| Stale evidence raises **one** idempotent Finding | ✅ |
| Exactly one open finding | ✅ |
| Control state follows the evidence | ✅ |
| Canonical context relates control ↔ binding | ✅ |
| The Finding is a canonical knowledge object | ✅ |
| An unauthorized actor **cannot** resolve the Finding | ✅ |
| A real governance action creates audit evidence | ✅ |
| The next evaluation detects it | ✅ |
| The control reaches **`operating`** | ✅ |
| Governance audit contains the events | ✅ |
| Audit rows are immutable | ✅ |
| **No external organization has any binding or run** | ✅ |

## Failure and isolation behaviour

Verified in production: an unreadable source returns `unavailable`; a null
organization returns `invalid`; neither is ever read as passing. A superseded
worker is fenced before it reads evidence. An evaluation older by sequence cannot
overturn a newer one. A denial is recorded before it is returned. Eight of eight
privilege probes pass.

## Observability

Operators can query, today, without new tooling: `eki_evaluation_runs` (identity,
trigger, organization, status, counts, failure category, safe error) and
`eki_evaluation_run_items` (per binding: outcome, evaluation sequence, control
state **before and after**, finding action, retry count, missed intervals).
Authorization denials are in `platform_governance_audit`.

**Operational limitation:** these are queryable surfaces, not alerts. No alert
rules were created — that would be a new monitoring surface and is out of scope.
Nobody is paged if the daily sweep stops.

## Limitations that remain

- **The effective cadence is one day**, set by the Vercel plan's cron
  granularity. A binding with a shorter cadence is measured late, and
  `missed_intervals` records it rather than hiding it.
- **No production load measurement.** The internal rollout has one control and
  one binding; timing that and calling it a performance result would be a scale
  claim the evidence does not support.
- **UI verification of the lens and of Isabella's answers was not performed in a
  browser.** Both are covered by unit tests and by the database-level acceptance
  flow above; visual confirmation in production is outstanding.
- `project_rythm_meetings` remains absent — pre-existing drift in an unrelated
  module, recorded during history reconciliation and deliberately not fixed.

## Phase 2 status

**PHASE 2 COMPLETE — CONTROLLED INTERNAL PRODUCTION ACTIVATION.**

No compliance claim is made. ProjectOps360 is not SOC 2 compliant, not certified,
and not audit-ready; no external auditor has reviewed anything here.
