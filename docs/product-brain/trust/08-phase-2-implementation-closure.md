# Enterprise Trust — Phase 2 Implementation Closure

**Phase 2 · Enterprise Knowledge Intelligence**
**Date:** 2026-07-27
**Status:** **PHASE 2 COMPLETE — DATABASE ACTIVATED, APPLICATION EXPOSURE OFF**

Companion to the baseline and deployment record in
[08-phase-2-production-activation-baseline.md](08-phase-2-production-activation-baseline.md).

---

## Macrophase status

| | Scope | Status |
|---|---|---|
| **1** | Knowledge scope, governance vocabulary, canonical relations | complete · PR #215 merged |
| **2** | Evidence engine, control lifecycle, governance findings | complete · PR #216 merged |
| **3** | Automated evaluation, second resolver, Trust context, Isabella, Living Graph lens | complete · PR #217 merged |
| **4** | Production migration, verification, hardening | **complete for the database layer; application exposure deliberately not activated** — see Limitations |

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

**All application exposure is OFF.** Verified in `vercel env ls production`: none
of the three variables is set, so each reads as its default, which is disabled.

| Capability | State |
|---|---|
| Backend EKI persistence | **active** — tables, functions, policies live |
| Governance audit writes | **active** — the write path exists and is service-role only |
| `EKI_AUTOMATED_EVALUATION_ENABLED` | **OFF** — `/api/eki/evaluate` answers 404; the daily cron is deployed but inert |
| `EKI_TRUST_REASONING_ENABLED` | **OFF** — Isabella routes exactly as before |
| `LIVING_GRAPH_TRUST_LENS_ENABLED` | **OFF** — the lens is not offered |
| Customer-wide exposure | **OFF** |

This is the conservative final state the macrophase brief specifies as the
default. Nothing was enabled beyond it, because no rollout scope was authorized
and inventing one is not available to this work.

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

- **The application layer is not activated.** Stages B–F of the macrophase brief
  — evaluator, second resolver, Trust context, Isabella, Living Graph lens —
  require enabling feature flags for an approved rollout scope. No such scope was
  authorized, so none was invented. The database is ready; the surfaces are dark.
- **No production acceptance flow was run end to end**, because it depends on
  those flags. The equivalent flow passed 31/31 against stage, which carries the
  same schema.
- **Performance and load were not measured in production**, for the same reason:
  with the evaluator disabled there is no production workload to measure. Stage
  timings are not restated here as production numbers.
- **Observability is structural, not alerting.** `eki_evaluation_runs` and
  `eki_evaluation_run_items` record every run, outcome, state transition and safe
  error, and are queryable now. No alert rules were created — that would be a new
  monitoring surface, which is out of scope.
- **The effective cadence is one day**, set by the Vercel plan's cron
  granularity, not by the engine. Any binding configured for a shorter cadence
  will be measured late, and `missed_intervals` records it rather than hiding it.
- **`project_rythm_meetings` is absent in production** while its three sibling
  tables exist. Pre-existing drift in an unrelated module, recorded during the
  history reconciliation and deliberately not fixed here.
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
