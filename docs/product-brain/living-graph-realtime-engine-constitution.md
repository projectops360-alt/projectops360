# Living Graph Realtime Engine — Constitution & Architecture (Phase 4, Task 1)

> **Constitutional status.** This document is the source of truth for the Living
> Graph Realtime Engine (**LGRE**). It overrides chat memory and prompts (ADR-007).
> Corrected behavior must remain corrected; approved architecture is **extended,
> never replaced**. Phase 4, Task 1 delivers the **architecture + contract
> foundation** in code (`src/lib/living-graph/realtime/`) — no runtime, no UI.
>
> Companion to the [Living Graph module doc](12-living-graph-strategy.md) (CAP-005)
> and the [MPF Engine Constitution](milestone-process-flow-engine-constitution.md),
> whose Engine First Principle™ and canonical-boundary rules this engine inherits.

---

## 1. Purpose

The LGRE answers one question:

> **When approved project truth changes, how does the Living Graph a user is looking
> at become current — quickly, cheaply, honestly, and without ever becoming a second
> source of truth?**

Today the Living Graph is rebuilt on navigation/refresh. The LGRE makes it *live*:
it detects that upstream truth changed, plans **which** parts of the graph
projection must be recomputed (by the **existing** deterministic engines), and
describes the **minimal delta** a UI consumer applies — with honest freshness
disclosure and a safe degradation ladder when realtime is unavailable.

## 2. Position in the approved architecture

```
Canonical Domain (roadmap_tasks, milestones, risks, …)
  → Project Event Graph              (project_event_log — Phase 2, immutable)
    → Deterministic engines          (status engine, rollup engine, census resolver,
                                      capacity engine, MPF Engine — owners of derived truth)
      → Living Graph Realtime Engine (detects change · plans recalculation ·
                                      versions snapshots · describes deltas)   ← this
        → Living Graph UI / Isabella freshness context / (future) PMO dashboards
```

The LGRE sits **between** the approved projection outputs and their realtime
consumers. It is **orchestration and transport semantics only**.

## 3. Responsibilities (owns) / Non-responsibilities (never owns)

**The LGRE owns exactly four things:**
1. **Change detection semantics** — what counts as a change notice, from which
   sources, with which ordering/dedup guarantees.
2. **Recalculation planning** — mapping coalesced notices (via their
   projection-invalidation tags) to the set of graph targets that must be
   recomputed by the existing engines.
3. **Snapshot versioning + delta/sync semantics** — monotonic versions per scope,
   minimal delta description, and the deterministic apply/resync decision.
4. **Delivery health** — connection state, freshness disclosure, fallback ladder,
   and tick observability.

**The LGRE never owns:**
- Canonical truth (tasks, milestones, risks, dependencies, …) — canonical owners do.
- Event history — `project_event_log` is append-only and written ONLY by the
  Event Ingestion Service (PEG-INGEST).
- Derived intelligence — node status (Execution Status Engine, REG-008), counts
  (rollup engine, REG-010), task census (REG-018 resolver), capacity (CAP-009),
  milestone-flow (MPF Engine). LGRE plans *that* they rerun; it never re-derives
  or edits their output.
- Graph substrate — `process_nodes` / `process_edges` are never read for truth
  the census owns (REG-018) and **never written**.
- Presentation — saved layouts (UX-007/PD-008) are client-owned presentation
  state; deltas are DATA-only and carry no positions/layout.

## 4. Canonical boundaries (hard rules)

1. **Read-only consumer by construction.** The realtime layer imports no DB
   client, no event write path (`ingestion.ts`, `dual-write.ts`,
   `emit-event.ts`), and never references `process_nodes`/`process_edges` in
   code — enforced by test **LGRE-FOUNDATION**.
2. **No new events.** The LGRE consumes change notices; it never emits Project
   Event Graph events (its operation is not project history).
3. **Payload pass-through.** Delta payloads are verbatim engine output. The LGRE
   never computes a status, count, or health value.
4. **If a notice and canonical truth disagree, canonical truth wins** — the
   consumer resolves by full resync against the canonical projection, never by
   trusting the notice.

## 5. Inputs

- **Change notices** (`LivingGraphChangeNotice`) — read-only projections of:
  appended `project_event_log` rows (id, registered type, per-project monotonic
  `sequence`, deterministic `invalidation_tags` from
  `generateProjectionInvalidationTags`, provenance `lifecycleClass`,
  compensating flag); upstream projection-refresh signals; canonical
  revalidation signals; explicit manual refresh requests. Closed source set:
  `LGRE_CHANGE_SOURCES`.
- **Scope** (`LivingGraphRealtimeProjectScope`) — org + project (portfolio is the
  extension path, §16).
- **Access context** (`LivingGraphRealtimeAccessContext`) — resolved server-side.
- **Config** (`LivingGraphRealtimeConfig`) — versioned coalescing/budget policy.
- **Current snapshot descriptor** — what the consumer currently renders.

## 6. Outputs

- **`GraphRecalculationPlan`** — which targets (closed set `LGRE_RECALC_TARGETS`)
  must be recomputed, why (closed reason set), how many notices were coalesced
  and how many rejected — pure orchestration data, no computed values.
- **`LivingGraphSnapshotDescriptor`** — monotonic `snapshotVersion` per scope +
  upstream engine versions (auditable provenance of what the snapshot contains).
- **`LivingGraphDelta`** — the minimal operation list (closed set
  `LGRE_DELTA_OPERATIONS`: upsert/remove node/edge, patch overlay/summary)
  valid only against its exact `basedOnVersion`.
- **`LivingGraphSyncDecision`** — `noop` / `apply_delta` / `full_resync`.
- **`LivingGraphRealtimeClientState`** — honest client freshness/connection state.
- **`LivingGraphRealtimeTickSummary`** — observability per tick.

## 7. Producer / consumer contracts

**Producers (upstream — LGRE consumes, never controls):**

| Producer | What it provides | Contract |
|---|---|---|
| Project Event Graph | INSERT notifications on `project_event_log` (id, type, sequence, invalidation tags) | notices with `source: "project_event_graph"`; at-least-once; ordered per project by `sequence` |
| Deterministic engines | recompute-complete signals + fresh projection output | `source: "projection_recompute"`; payloads pass through verbatim |
| Canonical owners | revalidation signals (server actions) | `source: "canonical_revalidation"` |
| Authorized users | explicit refresh | `source: "manual_refresh"` |

**Consumers (downstream — bound by the UI Consumer Contract, §10):**
Living Graph UI (primary) · Isabella (freshness context for briefings — she may
say "as of 12:03", never fabricate liveness) · future Executive Command Center /
PMO dashboards.

## 8. Event subscription model (contract now; runtime = Task 2)

- **Topics** are a closed set (`LGRE_SUBSCRIPTION_TOPICS`): `project_events`,
  `projection_invalidation`, `capacity_signals`, `milestone_flow`. Unregistered
  topics are rejected loudly (`INVALID_SUBSCRIPTION_TOPIC`).
- The **Event Subscription Layer** (Task 2) is the only component that listens
  to upstream feeds (e.g. Supabase Realtime `postgres_changes` INSERT on
  `project_event_log`, filtered by project) and converts them into
  `LivingGraphChangeNotice` values. It is a **listener** — RLS remains in force,
  and it never writes upstream.
- **Delivery:** at-least-once. Consumers dedup by (`eventId`, `sequence`);
  compensating events are passed through with their flag (interpretation belongs
  to the engines, not the transport).
- **Authorization precedes attachment** — a subscription is never opened for a
  scope the caller failed `resolveLivingGraphRealtimeAccess` for (§12).

## 9. Graph recalculation model

- Notices are **coalesced** inside a configurable window (default 750 ms) into a
  single plan — one storm of task edits produces one recalculation, not fifty.
- The planner maps **invalidation tags → targets**: `subject:task:*` →
  `node_status` + `edge_evidence` + `summary_counts`; `milestone:*` →
  `milestone_flow_layer` + `edge_evidence`; `scope:schedule` → critical-path
  overlay; capacity tags → `workforce_layer`; unknown/unattributable → honest
  `full_graph`.
- Plans **name** which existing engines rerun; the call site executes them. The
  same resolvers that guarantee REG-008/REG-010/REG-018 ("different views, same
  truth") remain the only computation path — realtime must **never** introduce a
  second, faster-but-divergent computation.
- Notices for the wrong scope are **rejected and counted**, never silently
  dropped or planned.
- **Foundation behavior (Task 1):** selective attribution is not implemented;
  any valid notice set yields a conservative `full_graph` plan with the
  limitation **disclosed** as a warning (`selective_recalculation_not_implemented`).

## 10. Delta / sync contract + realtime UI consumer contract

- Snapshot versions are **monotonic per scope**; consumers compare versions,
  never timestamps.
- A delta is valid **only** against its exact `basedOnVersion`. The sync
  decision is deterministic: same version → `noop`; base match → `apply_delta`;
  anything else (including no base, or a delta above the operation budget) →
  `full_resync`. **Never a partial, possibly-wrong merge.**
- Deltas are **DATA-only**: the operation vocabulary has no layout/position
  operation, and payloads never carry coordinates. Saved layouts (UX-007) stay
  client-owned: surviving nodes keep their manual positions, new nodes go to
  auto-layout, removed nodes release their saved position — exactly the existing
  saved-layout resilience rules, now under realtime change.
- UI consumers must: apply deltas idempotently; replace the model wholesale on
  `full_resync`; and expose `LivingGraphRealtimeClientState` honestly (freshness
  `unknown` before the first sync — never fabricated "live").

## 11. Observability

Every tick (coalescing window / plan cycle) emits an immutable
`LivingGraphRealtimeTickSummary`: notices received/coalesced/rejected, plans and
deltas emitted, full resyncs requested, warnings, duration, engine + config
version. No silent ticks; rejected input is always counted.

## 12. RBAC / security

- **Deny-by-default** (`resolveLivingGraphRealtimeAccess`): cross-organization
  access is always denied (absolute tenant isolation); project-level realtime
  requires the project in `authorizedProjectIds` (team/pm/pmo/admin); viewers /
  clients have **no** realtime access (doc 12 §8); aggregate (org/portfolio)
  scope is reserved to pmo/admin.
- Authorization is checked **before** subscription attachment and **before**
  planning; aggregates are redacted with `filterAuthorizedProjectIds` (no
  leakage through counts or ids).
- The transport trusts RLS as the outer wall: realtime channels filter by
  project, and the underlying tables' RLS still applies to any read.

## 13. Performance constraints (documented budget — `LGRE_DEFAULT_PERFORMANCE_BUDGET`)

| Constraint | Default | Rationale |
|---|---|---|
| Coalescing window | 750 ms | batch edit storms into one plan |
| Target freshness | ≤ 5 s | change visible to a live consumer |
| Max delta operations | 200 | above this, `full_resync` is cheaper and safer |
| Degraded polling interval | 30 s | honest, low-cost fallback cadence |
| Max pending notices | 500 | backpressure → force full rebuild plan |
| Delta apply cost | O(changed) | never O(graph) on the client |

Config overrides are versioned (`LGRE_CONFIG_VERSION`); changing budgets is a
config-version bump, never a silent behavior change.

## 14. Fallback behavior (honest degradation ladder)

`realtime → polling → manual_refresh`, decided deterministically
(`decideLivingGraphFallback`): first channel failure degrades realtime →
polling; repeated failures (default 4) degrade to manual refresh;
`offline_snapshot` always means manual refresh. The UI must disclose the real
mode and freshness — **the engine never reports "live" while degraded**, and a
realtime outage never blanks the graph: the last good snapshot stays rendered
with its honest `lastSyncedAt`.

## 15. Regression protection

- **New guard:** `LGRE-FOUNDATION` —
  `src/lib/living-graph/realtime/__tests__/living-graph-realtime-contracts.test.ts`
  (24 tests): honest conservative planning, deny-by-default RBAC + tenant
  isolation, deterministic versioned sync, DATA-only delta vocabulary, honest
  fallback ladder, read-only notices, tick observability, and the import
  boundary (no write path, no DB client, no `process_nodes`/`process_edges`,
  no layout storage).
- **Existing contracts this engine must never weaken:** REG-005/007 (restored
  layers stay), REG-006/REG-008 (blocked ≠ waiting; status from the engine),
  REG-010 (single metrics source), REG-018/CAP-001 (census from the canonical
  resolver), UX-007/PD-008 (layouts presentation-only), UX-008 (edge tooltip
  deterministic). Realtime refresh must flow **through** those resolvers.
- Per CLAUDE.md rule 2: future LGRE regressions get a REG row + executable test
  before closing.

## 16. Future PMO / Portfolio extension path

The scope model already carries optional `portfolioId`, and aggregate
(no-project) scopes are reserved to pmo/admin. The extension is **additive**:
a `portfolio:*` invalidation-tag family feeding cross-project plans, per-project
snapshot versions composed into a portfolio sync view, and redaction via
`filterAuthorizedProjectIds` so a PMO aggregate never leaks unauthorized
projects. No contract in this document changes for that step.

## 17. Intentionally NOT implemented (Task 1)

Subscription runtime (channel attach/detach) *(delivered by Task 2 — §18a)*,
selective recalculation attribution, the delta builder, snapshot persistence,
the polling fallback runtime, any UI, and any Isabella wiring. Unimplemented
operations throw `UNSUPPORTED_ENGINE_OPERATION` — the engine never fakes
liveness or change data.

## 18. How Task 2 should extend this

**Task 2 — Build Living Graph Realtime Event Subscription Layer.** Implement
`LivingGraphRealtimeSubscriptionContract` against Supabase Realtime
(`postgres_changes` INSERT on `project_event_log`, project-filtered), converting
rows to `LivingGraphChangeNotice` (id, type, sequence, invalidation tags,
lifecycle class), with: authorization before attach (§12), at-least-once
delivery + consumer dedup by sequence, reconnection with the fallback ladder
(§14), and tick summaries (§11). Extend the foundation — never replace it, and
never add a write capability to the subscription layer.

## 18a. Event Subscription Layer (Task 2 — added)

The subscription runtime now exists as a transport-agnostic core plus one DB
adapter, fulfilling `LivingGraphRealtimeSubscriptionContract` (§8):

- **`subscription-types.ts`** — the transport abstraction
  (`LivingGraphRealtimeTransport`, normalized channel statuses), the untrusted
  `ProjectEventLogRowLike` row projection, the typed notice stream
  (`LivingGraphNoticeDelivery`), the closed subscription-observability event
  vocabulary, reconnect results, and defaults (stale threshold 60 s, bounded
  dedup memory 1 000 keys).
- **`notice-mapper.ts`** — pure mapping from an appended `project_event_log`
  row to a **frozen** `LivingGraphChangeNotice` (`source:
  "project_event_graph"`). Missing identity fields ⇒ `null` (reject-and-count,
  never guess); `noticeDedupKey` gives the stable at-least-once dedup key.
- **`subscription-manager.ts`** — `createLivingGraphSubscriptionManager`:
  authorization **before** attachment (deny ⇒ no channel, ever); duplicate
  prevention (same consumer+scope+topics ⇒ same handle, one channel);
  wrong-scope/malformed rows rejected and counted; per-subscription dedup that
  **survives reconnects** (replayed rows never double-deliver, FIFO-bounded);
  transport-status handling driving the Task 1 fallback ladder; `reconnect()`
  **re-authorizes with current permissions first** — permission loss detaches
  the feed (`permission_revoked_on_reconnect`); `sweepStale()` degrades silent
  live subscriptions to `degraded_polling` (honest, never fake-live);
  structured observability events for every lifecycle step; released records
  ignore late channel callbacks. The manager is a listener — no DB client, no
  writes, no event emission.
- **`supabase-transport.ts`** — the ONLY file that knows about Supabase:
  adapts Realtime channels (`postgres_changes` **INSERT-only** on
  `project_event_log`, `project_id=eq.{id}` filtered, under the existing RLS
  read policy) to the transport abstraction via minimal structural typing.
  **Deliberately not exported from the barrel** so the pure core keeps zero
  client-library dependencies; callers wire it explicitly with an
  authenticated client. It opens/closes channels only — no query builder, no
  writes (guarded).
- **Engine wiring** — `createLivingGraphRealtimeEngine` accepts an optional
  `subscriptionManager`; `registerSubscription`/`releaseSubscription` delegate
  when present and still throw `UNSUPPORTED_ENGINE_OPERATION` without one.
- **Migration `20260833000000_project_event_log_realtime.sql`** — idempotently
  adds `project_event_log` to the `supabase_realtime` publication (delivery
  only; table/data/RLS/immutability untouched). **Operational prerequisite —
  not yet applied to prod.**

UI never consumes raw database changes: the typed notice stream is the only
output, and its consumers are the future recalculation (Task 3) and delta
layers. Guard: **LGRE-SUBSCRIPTION**.

## 18b. Incremental Recalculation Service (Task 3 — added)

Selective recalculation now exists, replacing the blanket full rebuild with
attribution — while keeping full rebuild as the **safe fallback**:

- **`recalculation-types.ts`** — the read-only **snapshot index** the planner
  matches against (`subjectRefs` per node/edge in the invalidation-tag grammar:
  `task:{id}`, `milestone:{id}`, …; identity only — no status/counts/layout),
  pure entity records (verbatim engine payloads), the attribution detail
  (entity → source notices evidence chain), and the deterministic
  `LivingGraphRecalculationResult` (added/updated/removed entities, reasons,
  provenance confidence, warnings, versions).
- **`recalculation-attribution.ts`** — pure planner: accepted notices + index →
  affected nodes/edges/overlays/targets. `subject:*`/`milestone:*` tags match
  subject refs; `scope:risk` targets the risk overlay; `scope:schedule`
  **propagates downstream** along the index edges (dependency-path closure,
  reason `dependency_path_propagation`). Honest fallbacks: an unattributable
  notice (`unattributable_change` — could be a brand-new graph area) or an
  affected area beyond the partial budget (`partial_budget_exceeded`,
  default ratio 0.6) ⇒ full rebuild, disclosed in reasons + warnings.
- **`recalculation-result.ts`** — pure deterministic diff (stable sorted-key
  stringify; replay-stable): partial mode diffs ONLY the plan's affected sets
  (an unaffected entity missing from a partial recompute is **not** a removal);
  recomputed entities outside the plan are included **with a warning** (never
  silently dropped, never silently trusted); every change carries
  `sourceNoticeIds` + `sourceEventIds` where attribution knows them;
  `confidenceFromNotices` derives weakest-wins provenance confidence
  (backfilled/derived/AI cap at medium; none ⇒ unknown).
- **`recalculation-service.ts`** — `createLivingGraphRecalculationService`:
  authorize (deny-by-default) → accept/reject notices → attribute → invoke the
  caller's `recompute(plan)` step (**the existing deterministic engines** —
  REG-008/REG-010/REG-018 resolvers; the service computes no graph content) →
  diff → counts. No accepted notices ⇒ explicit `noop` and **recompute is never
  invoked**.
- **Engine upgrade (additive)** — `LivingGraphRecalculationInput.snapshotIndex?`:
  with an index `planRecalculation` plans selectively; without one the Task 1
  conservative full rebuild (disclosed) remains byte-for-byte identical.

Guard: **LGRE-RECALCULATION**. Next layer: the Delta Store & Sync Contract
(Task 4) persists versioned snapshots and turns results into consumer deltas.

## 19. Files (Phase 4, Task 1)

| File (`src/lib/living-graph/realtime/`) | Responsibility |
|---|---|
| `constants.ts` | Closed vocabularies + versions + performance budget (single source of truth). |
| `types.ts` | Scope/access, change notices, subscriptions, plans, snapshots, deltas, sync, client state, tick summaries. |
| `errors.ts` | `LgreError` + typed subclasses for the 10 failure codes. |
| `security.ts` | `resolveLivingGraphRealtimeAccess` (deny-by-default), `filterAuthorizedProjectIds`. |
| `observability.ts` | `openTickContext` → `closeTickSummary` (injected clock). |
| `contracts.ts` | The 8 stable contracts + `LGRE_CONTRACTS` registry. |
| `engine.ts` | Foundation factory: validation, authorized conservative planning, pure sync/fallback decisions; unimplemented runtime throws. |
| `index.ts` | Barrel. |
| `__tests__/living-graph-realtime-contracts.test.ts` | 24 foundation guards (map id **LGRE-FOUNDATION**). |

**Contracts introduced:** `LivingGraphRealtimeEngine`,
`LivingGraphRealtimeSubscriptionContract`, `LivingGraphRecalculationContract`,
`LivingGraphDeltaSyncContract`, `LivingGraphRealtimeUiConsumerContract`,
`LivingGraphRealtimeSecurityContract`, `LivingGraphRealtimeObservabilityContract`,
`LivingGraphRealtimeFallbackContract`.
