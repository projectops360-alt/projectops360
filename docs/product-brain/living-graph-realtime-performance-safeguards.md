# Living Graph Realtime — Performance, Throttling & Observability Safeguards

**Phase 4 · Task 6** — hardens the Living Graph Realtime Engine (LGRE) and its UI
consumers against realtime load **without weakening correctness**. It does not
redesign the engine, replace the subscription/delta/visualization layers, add
graph intelligence, compute graph truth in React, or mutate canonical truth.

Regression guard: **`LGRE-PERFORMANCE-THROTTLING-OBSERVABILITY-SAFEGUARDS`**
(`docs/product-brain/regression-test-map.md`).
Tests: `src/lib/living-graph/realtime/__tests__/living-graph-realtime-performance.test.ts`.

---

## 1. What this task adds

Pure, client-free primitives under `src/lib/living-graph/realtime/`:

| Module | Responsibility |
|---|---|
| `performance-budget.ts` | Single `LgrePerformanceBudget` (throttle/debounce/batch/reconnect/large-graph/max-delta/render). Inherits Task-1 `maxDeltaOperations`. `resolvePerfBudget` clamps unsafe overrides. |
| `critical-update.ts` | Fail-safe classification of critical vs throttleable updates. |
| `update-scheduler.ts` | Coalescing buffer: throttle + debounce + batch + dedup, critical flush-on-arrival. |
| `reconnect-backoff.ts` | Bounded exponential reconnect backoff with give-up. |
| `large-graph.ts` | Large-graph classification + max-delta full_resync decision. |
| `perf-observability.ts` | Numeric-only, privacy-safe pipeline counters. |

Consumer wiring (performance-safe only, no business logic in UI):

- `use-live-graph-sync.ts` — applies the critical-update policy (critical notice →
  instant refetch; cosmetic → coalesced debounce).
- `realtime-living-graph.tsx` — arms a **scoped** Expand-all confirmation when the
  scope is large.

---

## 2. Performance budget (documented defaults)

`LGRE_PERFORMANCE_DEFAULTS` in `performance-budget.ts`:

| Value | Default | Meaning |
|---|---|---|
| `debounceWindowMs` | 350 | Non-critical bursts wait this long before applying. |
| `throttleIntervalMs` | 300 | Minimum spacing between applied (rendered) flushes. |
| `maxBatchSize` | 100 | Distinct keys before a batch must flush. |
| `maxDeltaOperations` | **200 (from Task 1)** | Node+edge ops over this → full_resync. |
| `staleTimeoutMs` | 25 000 | No successful sync in this window → stale. |
| `reconnectBackoffMinMs` | 1 000 | First reconnect delay. |
| `reconnectBackoffMaxMs` | 30 000 | Backoff ceiling. |
| `reconnectMaxAttempts` | 6 | Attempts before give-up → degrade. |
| `largeGraphNodeThreshold` | 300 | ≥ → "large". |
| `largeGraphEdgeThreshold` | 600 | ≥ → "large". |
| `renderBatchSize` | 50 | Nodes per progressive render frame. |

`resolvePerfBudget(override?)` clamps every value to a safe positive range so a
bad config can **never disable a safeguard** (e.g. a 0-ms debounce reintroducing
render storms, or a 0-op delta budget force-resyncing forever). Delta budget is
inherited from Task 1 so the two layers can never disagree.

---

## 3. Critical-update policy (priority-aware, fail-safe)

**Critical updates are never silently dropped.** The classifier is **fail-safe**:
an unknown or empty event type is treated as **critical**.

- **Critical** (bypass throttle/debounce): task status/move/lifecycle, subtask
  status/progress/topology, parent rollups, milestone status/progress/readiness,
  dependency add/remove, blocker/unblocker, delete/archive/visibility, project
  archive/close/reopen, **and any unrecognised type**.
- **Throttleable** (explicit allow-list only): `TaskUpdated`, `TaskAssigned`,
  `TaskUnassigned`, priority/due-date/estimate edits, subtask metadata edits,
  Isabella narrative events, snapshots, communications/meetings/uploads.
- A cosmetic event **escalates to critical** if it carries a
  status/progress/count/topology/dependency/blocker/delete/archive invalidation
  tag, or is a compensating/reversal event.

Sync-lifecycle signals are always critical: `full_resync_required`,
`permission_lost`, `version_mismatch`, `stale_transition`, `degraded_transition`,
`reconnect_result`.

---

## 4. Throttle / debounce / batch (the scheduler)

`update-scheduler.ts` is a **pure, deterministic** state machine driven by an
injected clock (`now`) — fully testable with a fake clock, no timers inside.

- **Dedup**: same-key updates collapse to the **latest**; the final state is never
  lost. Collapsed intermediates are **counted** (`coalescedNonCritical` /
  `coalescedCritical`).
- **Debounce**: non-critical bursts wait `debounceWindowMs` from the first pending.
- **Throttle**: applied flushes are spaced ≥ `throttleIntervalMs`.
- **Batch**: at `maxBatchSize` distinct keys the buffer flushes regardless of the
  debounce window (`batch_full`).
- **Critical flush**: any critical update makes `decideFlush` return
  `due:true, reason:"critical"` **immediately**, bypassing throttle and debounce.
- **No demotion**: once a key is critical it stays critical even if a later
  same-key update is cosmetic.
- **Force-flush**: `forceFlush` drains on unmount/detach so nothing is lost.

Guarantee: **after any burst, the final canonical state is applied.** Throttling
only affects *how often* the UI re-renders, never *whether* the last state shows.

---

## 5. Stale / fresh honesty

The consumer must never show "live" while stale. `staleTimeoutMs` bounds
freshness; the existing `markStaleIfExpired` / sync-bar vocabulary
(live → recovering → resync_required → stale → unknown) is preserved. Degraded
realtime falls back to polling (LGRE ladder: realtime → polling →
manual_refresh) and **never claims live**. Silent stale state is forbidden.

---

## 6. Reconnect backoff

`reconnect-backoff.ts`: delay = `min · 2^(attempt-1)` clamped to `[min, max]`.
After `reconnectMaxAttempts`, `planReconnect(...).giveUp = true` → stop
auto-reconnecting and **degrade** (no tight loop). On reconnect the subscription
manager re-checks permission; permission loss stops delivery; missed updates are
recovered by the Task 4 sync contract (contiguous replay) or a `full_resync`.

---

## 7. Large-graph warning + max-delta fallback

`large-graph.ts`:

- `assessGraphLoad` → `normal` / `heavy` (≥70 % of a threshold, recommend
  progressive rendering) / `large` (≥ threshold).
- The realtime UI **arms a confirmation** before a **scoped** Expand-all when the
  scope is large (`rt-large-graph-warning` / `rt-expand-all-confirm`). Expand-all
  stays **scoped to the selected milestone/task** — it never dumps the whole
  project, never renders hidden subtask branches, and never shows evidence/events
  unless the evidence overlay is enabled.
- `decideDeltaSize` forces **`full_resync`** when node+edge ops exceed
  `maxDeltaOperations`. An oversized delta is **never** partial-merged (that could
  leave the graph torn/unsafe).

---

## 8. Observability (privacy-safe)

`perf-observability.ts` records **numbers only** — never task titles, team
members, event bodies, or tenant ids, so a snapshot can be logged/surfaced
without leaking. Counters: subscriptions, active channels, reconnects, duplicate
subscriptions prevented, permission loss, notices, deduped, rejected, recalc
count + duration, recalc fallback, delta count + size, full resync, max-delta
fallback, stale, fresh recovery, critical preserved, skipped non-critical, render
update count + batch, large-graph warnings, errors, recoverable errors, warnings.
Derived averages: recalc duration, render latency, render batch size.

---

## 9. Hierarchy-safe performance guarantees

- Throttling never mixes unrelated milestone scopes; batching never mixes
  unrelated task/subtask branches, projects, or orgs.
- Large-graph fallback never shows all nodes as a shortcut.
- Expand-all remains scoped; evidence/event nodes stay hidden unless the evidence
  overlay is on; hierarchy edges stay distinct from dependency/evidence edges.
- Counts and parent progress remain correct after batching/throttling because the
  final state always wins and truth is computed upstream, not in React.

---

## 10. What this task intentionally does NOT do

- It does not redesign the LGRE, nor replace the subscription, delta/sync, or
  visualization layers.
- It does not compute graph truth in the frontend.
- It does not mutate canonical truth, `project_event_log`, `process_nodes`, or
  `process_edges`.
- It does not build new graph intelligence.
- It does not add server-side batching of canonical persistence or authorization.

## 11. Known limitations

- The coalescing scheduler primitive is available for the consumer; the classic
  auto-refresh currently applies the critical-vs-cosmetic split at the notice
  level and relies on the content-signature guard for final-state convergence
  (full render-frame batching of individual node deltas is a future step).
- The observability instance is per-consumer and in-memory (not yet aggregated to
  a server sink); surfacing a debug panel is optional future work.
- Large-graph confirmation is a two-click arm/confirm; a persisted "don't ask
  again" preference is not implemented.

**Recommended next task:** Living Graph Realtime Integration & Final Regression Pass.
