# Phase 4B · Task 3 — Living Graph Observability Panel

An internal/admin diagnostics panel that surfaces **safe** realtime health for the
Living Graph Realtime Engine, so when realtime misbehaves the team knows where to
look — without exposing raw truth or mutating the system.

Guard: **PHASE4B-LIVING-GRAPH-OBSERVABILITY-PANEL**.

---

## 1. Route & access

- Route: **`/[locale]/(app)/admin/living-graph-observability`**.
- Access: **strict server-side email allowlist** (`isProductBrainAllowedEmail`,
  the same gate as the Product Brain cockpit). Unauthorized users get **`notFound()`
  (404)** — the route's existence is not revealed and **no diagnostics data is
  loaded or serialized**. Deny-by-default.

## 2. What it shows

| Card | Source | Metrics |
|---|---|---|
| **Environment** | server (RPC + aggregate) | realtime publication healthy?, RLS enabled (+policy count), org-scoped ledger activity in the last 15 min (**count only**) |
| **Connection** | session (this tab) | subscriptions, active channels, reconnects, duplicate-subs-prevented, permission losses, stale transitions, fresh recoveries |
| **Notices / recalculation** | — | notices received (session); recalc/dedup/fallback shown as *not instrumented* |
| **Delta / sync** | — | *not instrumented* (in-memory per graph consumer) |
| **Rendering** | — | *not instrumented* (in-memory per graph consumer) |
| **Errors / warnings** | session | errors, recoverable errors, warnings |

Plus a **connection badge** (Live / Degraded / Stale / Unknown + raw state) and a
last-event timestamp.

## 3. Honesty contract (the key design rule)

The Task-6 perf counters are **in-memory, per consumer** — there is no server-side
telemetry store. So the panel never fakes data: `buildObservabilitySummary`
(pure) renders every catalog row, and a metric the calling source does **not**
track renders as **“not instrumented”** (italic, value hidden), **never a fake
zero**. A prominent note states counters are session-scoped.

## 4. Data source & subscriptions

- **Environment** (server, RBAC-gated): `getLivingGraphEnvironmentHealth(orgId)`
  calls the read-only `living_graph_realtime_health()` RPC (infra booleans, no
  tenant data) + a `head:true` COUNT on `project_event_log` scoped to the admin's
  org (aggregate only; never rows/payloads).
- **Session runtime** (client): the panel mounts **exactly one scoped
  `useLiveGraphSync`** for the selected project — a single subscription, the same
  approved Task-2 transport (typed notices, never raw payloads). It does **not**
  refetch snapshots, does **not** trigger recalculation, and creates no duplicate
  consumer channels. Counters live in React state (no ref-in-render — Phase 4B
  Task 1 hygiene).

## 5. Security / privacy

- No raw `project_event_log` rows, no raw Supabase realtime payloads, no
  task/user/team detail, no secrets — only numeric counters, infra booleans, and
  a connection-state string. The pure model is asserted numeric/boolean/string-only.
- Env health is org-scoped; the project selector lists only the admin's org's
  projects. The infra RPC returns global, non-tenant facts.
- Read-only: the panel and route never `insert/update/delete/upsert`, never touch
  `process_nodes`/`process_edges`, never mutate `project_event_log`.

## 6. States

Loading/empty are handled honestly: no project selected → environment card only +
“select a project” hint; a metric not tracked → “not instrumented”; unhealthy
infra (publication missing / RLS disabled) → red error rows; degraded realtime →
the badge shows Degraded, never a false Live.

## 7. Diagnosing common issues

- **Publication “missing”** → `project_event_log` isn't in `supabase_realtime`
  (apply migration `20260833`); live push won't work anywhere.
- **RLS “disabled”** → the members-read wall is gone; fix before beta.
- **Ledger activity 0 over 15m but users are active** → events aren't being
  emitted (check the emit path) — realtime has nothing to deliver.
- **Connection Degraded / reconnects climbing** → the socket is flapping; the
  consumer is on the polling fallback (still correct, just not instant).
- **Stale transitions > 0** → freshness budget exceeded between syncs.

## 8. Metrics not yet instrumented (documented gap)

Delta size, recalculation duration, render latency, throttle/batch counts exist in
the Task-6 `RealtimePerfObservability` **inside the graph consumer**, which is not
wired to a shared sink, so this panel shows them as *not instrumented*. Surfacing
them requires a future step: have the realtime consumer publish its snapshot to a
client-side diagnostics context (or a server telemetry sink) the panel reads.

## 9. Tests

`src/lib/living-graph/realtime/__tests__/living-graph-observability.test.ts` (10):
honesty (not-instrumented vs value), severity thresholds, environment card
healthy/unhealthy, `hasAnyInstrumented`, numeric-only safety, pure-module import
boundary, server-only + count-only env helper, admin-route allowlist+404 gating,
panel never renders payloads/ledger rows.

Commands: `npm run typecheck` · `npm run test:run` (1217) · `npm run build` ·
`eslint` on new files (0 problems, no new react-hooks debt) — all green.

## 10. Known limitations / future

- Per-session, in-memory counters only (no historical/aggregated telemetry).
- The env RPC returns global infra facts; per-project realtime health would need
  more instrumentation.
- No diagnostic write actions (by design — read-only, no destructive controls).

**Recommended next task:** Phase 4B / Task 4 — Beta Readiness Smoke Pass.
