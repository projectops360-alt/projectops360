# EKI Macrophase 3 — Implementation Notes

**Phase 2 · Macrophase 3 · Automated Evidence Intelligence**
**Date:** 2026-07-27 · **Status:** Implemented and **validated in stage**
**Implements:**
[ADR-016 — Trust views are Living Graph lenses](../adrs/ADR-016-trust-views-are-living-graph-lenses.md) ·
[ADR-017 — Trust knowledge in the retrieval corpus](../adrs/ADR-017-trust-knowledge-in-retrieval-corpus.md) ·
[ADR-018 — Isabella reasons live over the graph](../adrs/ADR-018-isabella-reasons-live-over-the-graph.md) ·
[ADR-019 — Automatic findings originate in the evidence layer](../adrs/ADR-019-automatic-findings-originate-in-the-evidence-layer.md)
**Builds on:** [Macrophase 1](05-eki-macrophase-1-implementation.md) ·
[Macrophase 2](06-eki-macrophase-2-implementation.md)

Macrophase 2 built an engine that answers correctly whenever something asks it.
**Nothing asked it.** This macrophase is the thing that asks — on a cadence,
exactly once per due execution — plus the surfaces that make the answer readable:
canonical context, Isabella, and one Living Graph lens.

---

## The sentence this macrophase exists to make false

> *A governance engine evaluated only when a person remembers to invoke it cannot
> detect the lapse it exists to detect.*

Everything below follows from that.

---

## What was implemented

| # | Scope item | Delivered |
|---|---|---|
| 1 | Automated evaluation | Vercel Cron → `GET /api/eki/evaluate` → `EkiEvaluator.sweep()` |
| 2 | Concurrency and idempotency | `for update … skip locked` claiming, claim tokens, sequence guard, unique run key |
| 3 | Second resolver | `privileged_access_activity` over `public.audit_logs` |
| 4 | Observability | `eki_evaluation_runs` + `eki_evaluation_run_items` |
| 5 | Product Brain context | `src/lib/eki-trust-context/` — three truth layers, kept apart |
| 6 | Isabella | `src/lib/isabella/enterprise-trust/` — live traversal, labelled claims |
| 7 | Authorization boundary | Allow-list in the domain layer, not in a prompt |
| 8 | Living Graph lens | `trust-lens-projection.ts` — read-only, no second graph |
| 9 | Internal APIs | 5 new entry points on the existing evidence server module |
| 10 | Tests | 100 new vitest assertions + a 31-check real-database acceptance script |
| 11 | Regressions | REG-034, REG-035, REG-036 |
| 12 | Documentation | This file |

Migrations: `20260866000000_eki_automated_evaluation.sql`,
`20260867000000_governance_audit_actor_role_none.sql`,
`20260868000000_eki_revoke_public_execute.sql`. **Stage only.**

Not built, deliberately: dashboard, trust score, readiness percentage, framework
package, policy authoring, audit management, a third resolver.

---

## Scheduling

**Vercel Cron**, declared in `vercel.json`. It is the smallest reliable recurring
mechanism the deployment already has — the app runs on Vercel and the repo has no
other scheduler. Nothing generic was built: one path, one endpoint, one job.

The **sweep interval is not the evaluation cadence**. Each binding carries its own
`evaluation_interval` and is claimed only once `next_due_at` has passed, so a
weekly control is measured weekly however often the sweep runs. The sweep needs to
run at least as often as the shortest cadence.

### The schedule is daily, and that is a plan constraint

The first attempt used `0 * * * *`. **Vercel rejected the deployment**: the
account's plan allows cron jobs at daily granularity only, and the failure
redirects to the cron pricing page rather than producing a build error, so it is
easy to misread as an unrelated deployment problem.

The schedule is therefore `0 3 * * *`. The consequence is real and worth stating
rather than hiding: **with a daily sweep, the effective minimum cadence is one
day**, whatever a binding's `evaluation_interval` says. A binding configured for
an hourly cadence will still only be evaluated once a day, because nothing asks it
in between — which is the exact failure mode this macrophase exists to remove,
merely at a coarser resolution.

Two things mitigate it and neither replaces it:

- The manual and post-mutation paths (`eki_request_evaluation`) are unaffected and
  may evaluate a binding that is not due, so anything needing a faster answer can
  ask for one.
- `missed_intervals` records how many cadences elapsed before a binding was picked
  up, so under-measurement is visible in the run record instead of silent.

The fix is a plan that permits a finer cron, or an external trigger calling the
same endpoint with the same secret. Both are outside this macrophase.

Two gates guard the endpoint:

- `EKI_AUTOMATED_EVALUATION_ENABLED` — default **OFF**. Unset, the endpoint
  answers **404**, not 403: an endpoint that is not enabled should not confirm
  that it exists. With the flag off the system degrades to exactly Macrophase 2
  behaviour, not to a broken one.
- `EKI_EVALUATOR_SECRET` (or `CRON_SECRET`) — unset, the endpoint answers **503**
  and refuses. An evaluation endpoint open to the internet is a way to make
  somebody else's controls flap, and the honest answer to "no secret configured"
  is a refusal, never a silent accept.

The sweep never accepts an organization from the request. A platform-wide sweep
covers every tenant, and letting a caller name one would hand an unauthenticated
request a way to single out somebody else's controls.

---

## Concurrency: three failures that look like success

### 1. Two schedulers claiming the same binding

```sql
select … from eki_evidence_binding_runtime b
 where b.next_due_at <= clock_timestamp() …
 order by b.next_due_at asc, b.binding_object_id asc
 limit p_limit
 for update of b skip locked
```

`SKIP LOCKED` means a second worker steps **over** rows the first has taken
rather than blocking behind them, so concurrent sweeps divide the work instead of
serialising or duplicating it. The order is deterministic, so two workers scanning
the same instant take disjoint slices.

Duplicate evaluations are not merely wasteful: they produce two competing
"latest" results and the control state starts flapping.

### 2. A worker that hangs, loses its claim, and comes back

The claim carries a **token**, not just a timestamp. `claim_token` identifies
*which* claim — a worker returning after its claim lapsed and was reissued must
be distinguishable from the worker holding it now, and a timestamp cannot tell
those two apart.

`eki_evaluate_claimed_binding` compares the token **before reading any evidence**
and returns `claim_superseded`. Nothing is recorded, so the older reading can
never become the newest row.

Behind that, a second line of defence: `eki_control_runtime.last_evaluation_sequence`.
`eki_recalculate_control_state` refuses any evaluation whose `sequence_no` is not
strictly newer. The claim stops a stale worker from starting; the sequence stops
it from winning if it somehow does. The old two-argument signature was **dropped**
so no caller can keep the unguarded behaviour by accident.

### 3. A batch that aborts halfway

Each binding is evaluated inside its own exception block. A failure is recorded
against the run item, the binding backs off, and the sweep continues.

A batch that aborts on the first failure leaves every later tenant unevaluated,
and **that silence is indistinguishable from health** — which is the exact
confusion this system exists to remove.

### Duplicate job delivery

Every at-least-once scheduler eventually delivers the same tick twice.
`eki_evaluation_runs.run_key` is unique, and the scheduled key is truncated to the
minute (`scheduledRunKey`), so the duplicate joins the run already in flight and
claims nothing.

### Retry and missed runs

- **Backoff:** `interval '1 minute' * 2^min(execution_failures, 6)`, capped by the
  binding's own cadence. A source that is down stays down; retrying every minute
  produces noise, not evidence.
- **Missed runs:** a binding due three cadences ago is simply due. `next_due_at`
  then advances from **now**, not from the missed due time — advancing by interval
  from a date days in the past would queue one catch-up run per missed cadence and
  flood the next sweep with measurements of the same instant. `missed_intervals`
  records the gap, because a run that silently absorbs three days looks identical
  to one that ran on time.
- **Two failure counters, deliberately:** `consecutive_failures` counts failing
  *evaluations* (a control problem); `execution_failures` counts failing
  *executions* (a system problem). Conflating them would let an unreachable source
  look like a failing control.

---

## The second resolver

`privileged_access_activity`, over **`public.audit_logs`** — a real table the
application already writes on every membership, team and stakeholder-access
change. 31 rows in the tenant used for acceptance. Nothing was synthesised.

Chosen from the preference order as *authentication / privileged-access evidence*.
The control it measures: **every privileged access change is recorded with an
accountable actor.**

Freshness alone would be a weak control here, so the resolver also states a
**contradiction**: a privileged-access change attributed to an actor who is not a
member of that organization. That is a fact the source can answer, and an
attribution that cannot be true is precisely what a privileged-access control
exists to surface.

| Property | How |
|---|---|
| Closed identity | Added to the `resolver_key` check constraint — widened by exactly one, still closed |
| Deterministic query | Count + max over four named `entity_type` values |
| Organization isolation | `a.organization_id = p_organization_id`; verified against a second tenant |
| Provenance | `detail.source`, `detail.entity_types`, `detail.resolver` travel with the measurement |
| Timestamp | `max(created_at)`; age measured against `clock_timestamp()`, never `now()` (REG-029) |
| Failure | Unreadable source → `unavailable`, never absent evidence, never a pass |
| Invalid | Null organization → `invalid` |
| Contradiction | Non-member attribution → `contradictory`, with a count |

It proves extensibility without framework-specific architecture: the engine gained
a second source by adding one function and one vocabulary entry.

---

## Observability

`eki_evaluation_runs` records run identity, trigger type, organization, start and
completion, status and counts. `eki_evaluation_run_items` records, per binding:
outcome, evaluation id **and sequence**, control state **before and after**,
finding action, failure category, safe error, retry count and missed intervals.

Before *and* after, because a change recorded only by its result cannot be
reviewed — "degraded" alone does not say whether anything moved.

`eki_safe_error` strips anything resembling a credential and truncates to 500
characters before storage. Postgres error text can carry a row's contents, and a
run record is read by more people than the row was. Nothing else is logged: no
secrets, no tokens, no prompts, no transcripts, no evidence payloads, no
client-supplied identities.

Run items are deliberately **not** append-only, unlike evaluations and audit
records. They are telemetry about the automation, not the evidence; the immutable
history lives in `eki_evidence_evaluations`, `eki_control_state_transitions` and
`platform_governance_audit`. Blocking deletion here would make tenant offboarding
impossible — the cascade from `organizations` would hit the trigger and fail —
which is a high price for protecting a log that proves nothing on its own.

---

## Product Brain context

`src/lib/eki-trust-context/` assembles the canonical model into three layers that
**stay apart**:

| Layer | Answers | Source |
|---|---|---|
| **normative** | What a framework or policy *requires* | Knowledge packages / obligation objects (ADR-015) |
| **instantiated** | What ProjectOps360 has *decided* | Knowledge objects with a lifecycle |
| **observed** | What the running system has *measured* | Evaluations, control runtime, findings |

"SOC 2 requires access reviews", "we decided ours runs quarterly" and "the last
one ran in March" are three different statements. An answer that merges them
produces the single most dangerous output a trust system can emit: **a requirement
that sounds satisfied because a decision exists to satisfy it.**

A layer that could not be read is **named** in `unavailableLayers`. Silence about
a layer reads as "there is nothing there", which is a different and much worse
answer.

There is no compliance corpus and no second store. Every field is derived from
`project_knowledge_objects`, its relations, the EKI runtime and
`platform_governance_audit`. Reads go through the **caller's** client, so RLS
decides visibility; a context assembled with the service role would happily cross
tenants.

The summary is **counts only**. No score, no percentage, no readiness figure — a
test asserts the summary object contains no such key.

---

## Isabella

**Hybrid, as approved:** live traversal for current state, retrieval for
definitions and normative explanation. A definition is stable and can be
retrieved; "is this control operating right now" has exactly one correct source
and it is the running system. Answering that from a corpus produces a confidently
stale compliance answer.

Every claim carries its kind, and the kind is **printed, not implied**:

`verified_current` · `historical` · `normative` · `inferred` · `recommendation`

A reader who cannot tell "the system measured this" from "we decided this should
be true" has been given the impression of assurance without the substance.

Every material claim carries references to the control, binding, evaluation,
finding or audit event behind it. A branch that can establish nothing records the
question in `unsupported` rather than producing a plausible sentence — there is no
path that returns a confident statement with nothing behind it.

### Authorization

Enforced in `authorization.ts` and in the database, **not in a system prompt**. A
prompt is a request; this is a boundary, and a boundary that lives only in wording
is one paraphrase away from not existing.

**Deny by default.** An action not on the allow-list is refused, so every
capability added later is *not* granted to the AI automatically — the alternative
is exactly backwards.

May: read authorized context · explain state · compare evidence · identify missing
or stale evidence · explain findings · rank remediation · draft proposals · propose
relationships and owner assignments · identify contradictions · describe changes.

May not: activate or deactivate a binding · change a control state · declare a
control operating · resolve or close a finding · accept risk · approve an exception
or evidence · delete contradictory evidence · modify immutable history · act as a
human identity.

Proposals carry `status: "draft"`, `requiresHumanApproval: true` and
`countsTowardCoverage: false`. A draft that loses its authorship becomes
indistinguishable from a human decision the moment somebody reads it a week later.

### Prohibited assurances

`containsProhibitedAssurance` blocks "is SOC 2 compliant", "is certified", "the
audit will pass", "fully compliant", "audit-ready" and the Spanish equivalents.

The **whole answer is refused**, not redacted. Removing the offending sentence
would leave an answer that reads as if it had said something; refusing is the
honest failure, and the caller learns the system could not answer safely.

Compliance is asserted by an auditor, not by the software under audit.

---

## Living Graph lens

One lens inside the existing graph. `LivingGraphViewLevel` gains `"trust"`; the
projection is built on every read from knowledge objects, the EKI runtime and open
findings.

**No second graph and no separate persistence.** A test asserts the projection
module contains no database access at all — no `from(`, no `insert`, no client
import. A stored copy would start disagreeing with the canonical model the first
time an evaluation ran while nobody was looking at the screen.

Three decisions worth stating:

- **`never_measured` is not `stale`.** A control that has never produced evidence
  and one whose evidence lapsed need different work; one "not fresh" badge would
  send both to the same place.
- **A control's freshness is the worst of its bindings.** One fresh and one lapsed
  binding is not fresh, and showing the better of the two would be the reassuring
  lie.
- **Contradiction edges are shown.** An unresolved contradiction is one of the six
  conditions that blocks operating; hiding the edge would show a degraded control
  with no visible cause.

Filters apply to **controls**, and the bindings, findings, owners and obligations
attached to a hidden control go with it — filtering nodes independently would
leave orphan findings floating with nothing to explain them.

Ownership is drawn as an edge here even though the canonical model stores it as a
column (Macrophase 1 refused `owned_by` as a relation). The lens is a *view*:
showing who is accountable is the point, and nothing is written back.

Every node carries its organization and `assertSingleTenant` runs on load — the
loader scopes its reads, but a projection that mixed tenants would render a
cross-tenant graph that looks entirely normal.

Gated by `LIVING_GRAPH_TRUST_LENS_ENABLED`, default OFF.

---

## Two regressions

### REG-034 — a refusal by an actor with no role could not be recorded

`platform_governance_audit.actor_role` admitted owner / admin / member / viewer /
service. The denial paths write `coalesce(role, 'none')`, so the insert violated
the check constraint, the exception propagated, and **both the audit record and
the caller's answer were lost**.

The vocabulary could not express "no role" — and an actor with no standing is the
most important denial there is.

Macrophase 2 missed it because its acceptance test used a *member without
authority*: the role was `member`, the constraint was satisfied, and the `none`
branch never executed. **The third time this programme has hit that shape** —
Macrophase 1 probe 11 fell back to a global package and passed for the wrong
reason; Macrophase 2 step 17 skipped and reported `passed`. A test adjacent to the
case that matters is not a test of that case.

Fixed by widening the constraint and denying `none` **every** operation, reads
included. Widening grants nothing.

### REG-035 — the trust classifier declined its own vocabulary

`\bcontrol\b` does not match "controls" or "controles"; `\bfinding\b` does not
match "findings". Nearly every real question failed the subject gate and fell
through to RAG, which answered a live-state governance question from a document
corpus — producing a *plausible* answer rather than an error, so nothing surfaced.

---

## Stage validation (2026-07-27)

Applied to **stage only** (`gcxcljfzleasrleyyyda`). Production untouched.

`supabase/tests/eki_macrophase3_acceptance.sql` — **31 of 31 checks passing**,
residue verified **zero** across runs, run items, bindings, evaluations, controls,
findings, governance audit and acceptance objects.

| Step | Property | Result |
|---|---|---|
| 1–2 | An active binding becomes due; the scheduler claims it exactly once | ✅ |
| 3 | A concurrent run claims nothing; a stale token is refused; duplicate delivery joins the same run | ✅ |
| 4–6 | The resolver queries `audit_logs`, the evaluation persists, the control reaches `operating` | ✅ |
| 7 | A stale result raises **one** finding; re-evaluation recurs rather than duplicates; the control degrades | ✅ |
| 8 | The run is observable, `operating→degraded` is recorded, missed cadences are visible | ✅ |
| 9 | Control, binding and finding are related canonical objects | ✅ |
| 10–12 | An actor with no standing is refused, the refusal is recorded with role `none`, a finding cannot be closed without authority | ✅ |
| 13 | Binding, finding and owner are all present for the lens | ✅ |
| 14–17 | New evidence arrives, the next evaluation detects it, the control returns to `operating`, the finding is **not** auto-closed | ✅ |
| 18 | Every state change is recorded and names the evaluation that caused it | ✅ |
| 19 | The resolver sees only its own tenant (own > 0, foreign ≠ own); a foreign-scoped sweep claims nothing of ours | ✅ |
| 20 | The whole run is transactional | ✅ |

Ageing is always done by narrowing the binding's own tolerance, never by touching
evidence. The evidence table is append-only and the test must not be able to do
what the product forbids.

### Two assertions that were wrong before they were right

- Step 8 first asserted `operating→degraded` on the **second** stale run, which
  reads `degraded→degraded`. The engine was correct; the expectation was pointed
  at the wrong run.
- Step 19 first passed with `0 = 0` — two empty tenants agreeing, which
  demonstrates nothing about isolation. It now requires the pinned tenant's count
  to be non-zero **and** different from the foreign tenant's.

---

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | green |
| `npm run test:run` | green |
| `npm run build` | green |
| `npx eslint` (new modules) | clean |
| New vitest assertions | 100 |
| Real database (stage) | 31 / 31 |

---

## Known limitations, strictly within this scope

- **One second resolver, by instruction.** The engine now measures two controls'
  worth of source; a broad resolver library is not in this macrophase.
- **The lens is read-only.** Nothing can be changed from it — by design, but it
  means remediation still happens elsewhere.
- **The normative layer is thin.** It reads `obligation` objects and their
  `satisfies` relations; with none present the layer is reported as unavailable
  rather than empty, which is honest but not yet useful.
- **The sweep is daily and platform-wide**, because the Vercel plan permits no
  finer cron. Any binding with a cadence shorter than a day is measured late, and
  the run record shows it via `missed_intervals` rather than hiding it. Per-tenant
  sweep scheduling is not built.
- **`auth.role()` is NULL on a direct database connection**, so the service-role
  guard does not fire there. Classified during final review as **DEFECT FIXED** —
  see below. After REG-036 the only callers left are `service_role` and the
  function owner, so a NULL role now requires owner-level credentials, which
  already confer more than the guard protects. It is what lets the acceptance
  script and any future scheduled job run.
- **Both flags default OFF.** Nothing evaluates automatically and no lens appears
  until they are set. Production is untouched and nothing is deployed.

---

## Final review — the `auth.role() IS NULL` path

**Classification: DEFECT FIXED.**

The question was which caller reaches a state where `auth.role()` is NULL, given
that every privileged function guards with `auth.role() <> 'service_role'` and
`NULL <> 'service_role'` evaluates to NULL, so the guard does not fire.

Answering it required enumerating who can execute these functions at all, and
that surfaced a defect with nothing to do with NULL roles.

### What the path actually is

| Question | Answer |
|---|---|
| Which callers reach NULL? | Only a **direct database connection** — psql, the pooler, a migration runner. Through PostgREST `auth.role()` is always populated: `anon`, `authenticated` or `service_role`. |
| Does it use service-role credentials? | No — it uses **database** credentials, which are strictly broader. |
| Can a browser user reach it? | No. A client cannot execute arbitrary SQL and cannot set `request.jwt.claims`. |
| Is tenant context still enforced? | The functions take an explicit `organization_id`; RLS is bypassed by `SECURITY DEFINER` **by design**, because a resolver must read across it. |
| Can actor identity be spoofed? | Not through the API. `p_actor_id` is stamped server-side from `getOrgContext()`. |
| Do RLS policies behave differently at NULL? | `is_org_member(NULL)` is not true, so a NULL-role session sees no rows through RLS. The exposure was never RLS — it was `SECURITY DEFINER` reachability. |

### What the review found instead — REG-036

Macrophase 3 never revoked the default `PUBLIC` grant. All eight functions were
callable through PostgREST. The write paths were contained by the service-role
guard; **the resolver was not**, because a resolver called from inside the engine
had no guard.

Verified in stage against a real tenant, as `authenticated` and again as `anon`:
RLS showed **0 rows** of another organization's `audit_logs`, and
`eki_resolve_privileged_access_activity` returned **31** with an exact timestamp
for the same organization. A publishable key and no session were enough.

Fixed in `20260868000000_eki_revoke_public_execute.sql`: revoke from
`public, anon, authenticated`, plus a service-role guard on the resolver so a
grant restored by a later migration cannot silently reopen it. Re-verified in
stage — all three paths now refused, the engine itself unaffected. Guarded by an
automated test that discovers EKI migrations from disk and was negative-controlled.

### Why the NULL question was worth asking

It was the right question for the wrong reason. NULL turned out to be a narrow
operator path; the enumeration it forced found a cross-tenant disclosure reachable
by an unauthenticated key. "It did not fail during testing" would have missed
both, because nothing failed — the resolver answered, correctly, to the wrong
person.
