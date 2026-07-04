# Phase 4B · Task 2 — Real Multi-Tab Realtime E2E

Proves the beta-readiness guarantee with **real browser clients**: Browser A
moves a task In Progress → Done through the approved app UI, and Browser B's
**Workboard AND Living Graph update automatically** — no manual refresh — with an
honest realtime sync indicator.

Guard: **PHASE4B-REAL-MULTI-TAB-REALTIME-E2E**.

---

## 1. Framework

**Playwright** (`@playwright/test`) — no E2E framework previously existed, so one
was introduced (justified). Spec: `e2e/realtime-sync.spec.ts`; config:
`playwright.config.ts`; scripts: `npm run test:e2e`, `npm run test:e2e:list`.

## 2. Browser A / Browser B setup

Two **isolated Playwright browser contexts** (two real browsers), same authorized
user via a shared `storageState`:

- **Browser A** (`ctxA`): one page on the Workboard — the actor.
- **Browser B** (`ctxB`): two pages — the Workboard (observer) and the realtime
  Living Graph `/execution-map/realtime` (observer). Two contexts prove genuine
  cross-browser realtime, not same-tab state sharing.

## 3. Scenario (Scenario 1 — task status realtime sync)

1. Both browsers open the same project; Browser B mounts the Workboard + realtime
   graph. **Flakiness control:** the test waits for `rt-root` + `rt-sync-bar` +
   the task card to be visible so Browser B is subscribed **before** Browser A acts.
2. Precondition: the task starts `in_progress` (set via the approved UI if not).
3. **Action:** Browser A opens the task card → task editor → `task-status-select`
   → `done` → `task-form-submit`. This is the approved `updateTaskStatusAction`
   path (emits the canonical `TaskStatusChanged` event; no direct DB/ledger write).
4. **Assertions (no reload anywhere):**
   - Browser B Workboard: the card is under `workboard-column-done` and no longer
     under `workboard-column-in_progress`.
   - Browser B Living Graph: the `rt-node-task` for the task flips
     `data-node-status` to `done` (via `expect.poll`).
   - Sync honesty: the `rt-sync-bar` text advances and never shows stale/degraded.
5. `afterAll` restores the task to `in_progress` through the same UI (no DB mutation).

Scenarios 2 (milestone creation inclusion) and 3 (reconnect/missed-update
recovery) are documented as recommended follow-up E2E; Scenario 1 is implemented
thoroughly.

## 4. Auth & test data (env-driven, no secrets, no prod data)

The spec is **env-gated** and self-skips (`test.skip`) when unset, so it never
fails a run that isn't wired for realtime:

| Env var | Meaning |
|---|---|
| `E2E_BASE_URL` | App URL (default `http://localhost:3000`) |
| `E2E_STORAGE_STATE` | Path to an authenticated Playwright `storageState` JSON |
| `E2E_PROJECT_ID` | Seeded test project id |
| `E2E_TASK_ID` | Seeded task id (starts In Progress, has a Workboard card + graph node) |
| `E2E_TASK_TITLE` | Task title (locates the graph node) |
| `E2E_LOCALE` | `en` / `es` (default `en`) |

No secrets are hard-coded; auth comes from a `storageState` the runner captures
once (e.g. a login helper) and points to via `E2E_STORAGE_STATE`.

## 5. Stable selectors (added minimally)

| Selector | Component |
|---|---|
| `workboard-column-{status}` (+ `data-status`) | `workboard-client.tsx` |
| `workboard-card-{taskId}` (+ `data-task-status`) | `workboard-client.tsx` |
| `task-status-select`, `task-form-submit` | `task-form-dialog.tsx` |
| `rt-node-task` + `data-node-status` / `data-node-id` | `realtime-graph-nodes.tsx` |
| `rt-root`, `rt-sync-bar` (pre-existing) | `realtime-living-graph.tsx` / `realtime-sync-bar.tsx` |

## 6. Flakiness controls

Serial mode, single worker, `retries: 1` (local); Browser B subscription confirmed
before the action; **web-first assertions + `expect.poll`** with a 20s realtime
propagation budget — **no arbitrary sleeps** (`waitForTimeout`/`setTimeout` are
banned and asserted absent by the CI guard); the spec **never** calls `page.reload()`.

## 7. Diagnostics

Trace on first retry, screenshot on failure, video retained on failure (HTML
reporter). Artifacts (`test-results/`, `playwright-report/`) are git-ignored.

## 8. CI status (honest limitation)

**The real E2E does NOT run in CI.** CI runs only `typecheck · test · build`; it
has no running app, no Supabase Realtime, and no authenticated storage state — so
it cannot exercise real websockets. This is documented, not hidden.

**CI-safe protection instead** (two layers that DO run in CI):
- The deterministic cross-browser **convergence simulation** already exists under
  `REALTIME-TASK-STATUS-WORKBOARD-LIVING-GRAPH-SYNC`
  (`src/lib/living-graph-realtime-ui/__tests__/realtime-consumer.test.ts`): two
  independent consumers applying the same delta stream converge.
- A **selector-contract guard**
  (`src/lib/workboard/__tests__/realtime-e2e-selectors.test.ts`): fails CI if a
  refactor removes a `data-testid` the E2E depends on, or if the spec regresses to
  a direct DB mutation / arbitrary sleep / reload.

## 9. How to run locally / staging

```bash
npx playwright install chromium         # one-time browser download
export E2E_BASE_URL="http://localhost:3000"
export E2E_STORAGE_STATE="./.auth/state.json"   # authed session
export E2E_PROJECT_ID="<seeded project>"
export E2E_TASK_ID="<seeded task, In Progress>"
export E2E_TASK_TITLE="<task title>"
npm run test:e2e
```

Against staging: point `E2E_BASE_URL` at the deployed app (which has real Supabase
Realtime) and use a staging test user's `storageState`.

## 10. Known limitations / next steps

- Requires a running app + realtime env + authed storage state (not CI).
- Scenarios 2 (milestone creation inclusion) and 3 (reconnect / missed-update
  recovery) are follow-up E2E cases.
- To enable CI execution later: provision a preview/staging deployment with
  Supabase Realtime, a seeded fixture project/task, and a login helper that writes
  `storageState`, then add a dedicated (non-blocking) E2E workflow.

**Recommended next task:** Phase 4B / Task 3 — Living Graph Observability Panel.
