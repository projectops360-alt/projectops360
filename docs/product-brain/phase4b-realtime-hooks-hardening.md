# Phase 4B · Task 1 — Realtime Hooks Lint Hardening

Resolves the advisory `react-hooks/*` lint debt in the Living Graph realtime
hooks that the Phase 4 closeout flagged as beta-readiness follow-up. No feature
change, no architecture change, no behavior change — the goal is safer beta
readiness (stable subscriptions, no stale closures, no duplicate channels).

Guard: **PHASE4B-REALTIME-HOOKS-LINT-HARDENING**.

---

## 1. Lint debt found (exact)

`npx eslint` on the realtime scope reported **5 errors in 2 files**:

| File | Line | Rule | Issue |
|---|---|---|---|
| `use-live-graph-sync.ts` | 48 | `react-hooks/refs` | `onChangeRef.current = args.onChange` written during render |
| `use-live-graph-sync.ts` | 50 | `react-hooks/refs` | `onConnRef.current = args.onConnectionChange` written during render |
| `use-live-graph-sync.ts` | 119 | `react-hooks/set-state-in-effect` | `setConnected(false)` called synchronously in the effect body |
| `realtime-living-graph.tsx` | 108 | `react-hooks/refs` | `modelRef.current = model` written during render |
| `realtime-living-graph.tsx` | 109 | `react-hooks/purity` | `useRef(Date.now())` — impure call during render |

## 2. Fixes (no eslint-disable, no behavior change)

### `use-live-graph-sync.ts`
- **Latest-callback refs → post-render effect.** `onChangeRef` / `onConnRef` are
  still initialized with `useRef(...)`, but the `.current = ...` sync moved into a
  dependency-less `useEffect` so it runs AFTER render, never during it. This is
  what lets the subscription effect keep its deps `[projectId, organizationId,
  userId, coalesceMs]` — a parent passing a new `onChange` closure never
  re-attaches the channel, so **no duplicate subscriptions**.
- **`setConnected(false)` moved out of the effect body.** The synchronous reset in
  the `catch` was removed; `connected` starts `false` and is now reset in the
  effect **cleanup** (runs on unmount / scope change), so a slow or failing
  re-subscribe never leaves a stale "live" from the previous scope. The only
  remaining `setState` calls are inside the async observability callbacks — the
  legitimate "external system → setState" pattern the rule allows.

### `realtime-living-graph.tsx`
- **Latest-model ref → post-render effect.** `modelRef` stays `useRef(model)`
  (keeps the initial for the first async reader); `modelRef.current = model` moved
  into a dependency-less effect. This preserves the reason the ref exists:
  `refetchSnapshot` reads `modelRef.current.version` WITHOUT depending on `model`,
  so it is not recreated on every graph change (which would restart the polling /
  subscription effects).
- **Freshness clock seeded in an effect.** `useRef(Date.now())` → `useRef(0)` plus
  a mount effect `lastSyncMsRef.current = Date.now()`. No impure call in render; the
  clock is seeded well before the first polling tick (10s interval).

## 3. How duplicate subscriptions are prevented

The subscription `useEffect` re-runs **only** when `projectId` / `organizationId`
/ `userId` / `coalesceMs` change. Callback identities live in refs (synced in a
separate effect), so parent re-renders that pass new closures do not re-run the
subscription effect. On every re-run (real scope change) the cleanup detaches the
old notice/observability listeners and `unsubscribe`s the old channel first.

## 4. Cleanup / timers

- Subscription cleanup: sets `disposed = true`, resets `connected`, clears the
  coalesce timer, releases the notice + observability listeners, and
  `unsubscribe`s the channel (best-effort try/catch).
- Polling fallback effect: clears its `setInterval` and flips a `cancelled` flag
  on cleanup; unchanged by this task.

## 5. Remaining lint (out of scope)

Repo-wide lint went from **272 → 267 problems (96 → 91 errors)** — exactly the 5
realtime errors fixed, none added. The remaining 91 errors are pre-existing
`react-hooks/*` advisories in unrelated areas (roadmap, middleware, other graph
components) and are **not** part of this realtime-scoped task. CI runs
`typecheck · test · build` (not lint), so they are not a merge gate.

## 6. Beta readiness

These fixes remove the stale-closure / impure-render / synchronous-setState
foot-guns from the exact hooks that drive realtime delivery, so the live
subscription, cross-browser sync, stale/fresh honesty, and reconnect behavior are
stable under re-render — the safety bar for exposing the Living Graph realtime to
beta users.

## 7. What was NOT changed

No LGRE/visualization/delta redesign; no eslint-disable; no lint-rule weakening;
no canonical / `project_event_log` / `process_nodes` / `process_edges` mutation;
no change to realtime sync, cross-browser sync, hierarchy-safe behavior, new
milestone auto-inclusion, or the milestone_chain-not-a-dependency fix.

**Recommended next task:** Phase 4B / Task 2 — real multi-tab E2E realtime test.
