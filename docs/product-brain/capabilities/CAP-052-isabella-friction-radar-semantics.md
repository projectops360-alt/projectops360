# CAP-052 — Isabella: Friction Radar evidence semantics

**Status:** Implemented (2026-08-18) — pilot-gated, read-only, not merged
**Depends on:** Friction Radar v1 (PR #257 / #258, commit `44e9102`)
**Surfaces:** Isabella tool `get_friction_radar` · screen help for `/projects/{id}/friction-radar` · Knowledge OS corpus (10 packages)
**Guards:** `ISABELLA-FRICTION-RADAR-READ`
**Flag:** `FRICTION_RADAR_ENABLED` + `FRICTION_RADAR_PROJECT_IDS` (Aurora `a40a7436-c63f-4e3b-94cd-041447ee54d4` only)

Teaches Isabella to talk about friction without turning a missing row into a fact.

---

## 1. The one decision everything else follows from

**Absence of evidence is never converted into a claim.**

A friction radar fails in a specific and expensive way. Not by missing a signal
— by producing a fluent, confident sentence built on a record that was never
written. "This task has been waiting three weeks to start" is devastating in a
steering committee when the truth is that the task was completed, hours were
logged against it, and the only thing missing was a `TaskStarted` row.

Everything below is a consequence of refusing to do that.

### The five ways data can be absent

They look identical on screen and mean completely different things. Isabella
must name which one she is looking at:

| Situation | What it means | May she say work stalled? |
|---|---|---|
| Absence of events | The ledger has no record | **No** — the work may still have happened |
| Absence of activity | Qualified evidence exists and shows nothing moved | **Yes** — this is the only one |
| Insufficient evidence | The input existed but did not qualify (explicit reason code) | **No** |
| Temporal conflict | Timestamps contradict each other | **No** — no duration is trustworthy |
| Late / imported capture | Written well after the fact, or imported | **No** — `recorded_at` is not when work happened |

### OBSERVED_START is derived from any qualifying work evidence

A start is **not** synonymous with `TaskStarted`. Per
`src/lib/friction-radar/event-taxonomy.ts`, a start may be established by
`TaskStarted`, `TaskResumed`, `TaskImplemented`, `TaskTested`,
`SubtaskStarted`, `SubtaskCompleted`, `SubtaskProgressChanged`, a
`TaskStatusChanged` landing on an **active** state, or `TimeLogged` backed by a
**current** time entry with a valid operational work date.

`TaskCreated`, `TaskAssigned`, `TaskDependencyAdded`, `TaskMoved` and
`TimeEntryUpdated` prove nothing about work starting.

---

## 2. No Global Friction Score

`FrictionRadarReadModel.score` and every `FrictionCategoryScore.score` are
`null` **on purpose** — an aggregation policy has not been validated. Each
signal carries its own independent 0–100 rule score, and those are never summed,
averaged or rolled up.

The read view therefore returns `global_score: null` **with**
`global_score_reason` attached, rather than omitting the field. Omission is a
silence a model will fill; a named null with a stated reason is not.

Category views report a **count** and the highest single independent score —
never a total.

---

## 3. How Isabella gets the signals

One engine, one read path. `getFrictionRadarForIsabella`
(`src/lib/isabella/friction-radar/service.ts`) is a projection over
`loadFrictionRadarFromProduction` — the same canonical loader the screen uses —
plus the screen's own pure `filterAndSortFrictionSignals` projection and
`scoreFrictionSignal`. It does not re-derive, re-score, re-promote or re-rank
anything, so the two surfaces cannot disagree.

**Security is inherited, not re-implemented:**

- the pilot flag is checked **before** any read — a non-pilot project performs
  no query at all;
- the canonical loader runs on the authenticated, RLS-scoped SSR client with the
  organization enforced on every query;
- no `createAdminClient`, no service role, no direct table access in this path;
- a foreign-organization project and a non-existent one both return
  `not_authorized`, and the caller cannot tell them apart;
- read-only: no insert/update/delete/upsert/RPC anywhere in the path.

An import-boundary test asserts each of these against the source.

---

## 4. What Isabella may and may not do

**May:** list and rank signals, explain a category or signal type, walk an
evidence contract, explain confidence versus severity, explain an evidence gap,
and link to the Frictions screen using the `screen_href` the tool returns.

**May not:** produce a global or category score, read a missing `TaskStarted` as
waiting, hide `unknown` / `insufficient_evidence`, report an empty category as
"no friction", invent events, dates, owners, expected values, approvals,
decisions, risks, costs, capacity or dependencies, attribute a signal to a named
person, enable the feature, or promote a rejected signal.

---

## 5. Naming

The Spanish entry point is **Fricciones** (the Execution Map tab, after KPIs);
the screen keeps its **Radar de Fricción** name. English is **Frictions** /
**Friction Radar**. No route, module, flag or contract was renamed — the entry
point label and the screen title are presentation only.

---

## 6. Protected false positives

Validated against the Aurora pilot dataset:

| Task | Contract |
|---|---|
| `93dff1de-c356-403e-9701-a1d184d5105e` | No `first_started_at`, but completed with logged hours — must **never** be classified `WAITING_TO_START` |
| `b0ca5ded-efdc-455d-abf7-671eb3fd8670` | `TaskCompleted` → `TaskReopened` (done → blocked) — describe only with the signal type the engine gave |
| `dd29a954-…`, `8f0f1e7e-…`, `aa28bbb1-…` | Queue time is compared against the **planned** start; unavailable plan ⇒ unknown |
| `997c8d29-04de-4add-9620-764f6e71246a` | Never called long-running from a preliminary snapshot alone |

See `docs/product-brain/regression-test-map.md` → `ISABELLA-FRICTION-RADAR-READ`.
