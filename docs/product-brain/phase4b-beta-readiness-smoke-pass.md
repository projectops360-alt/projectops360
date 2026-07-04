# Phase 4B · Task 4 — Beta Readiness Smoke Pass

Final validation gate for **Phase 4B — Living Graph Beta Readiness & Hardening**.
Validation only (fix-if-needed); no new features, no redesign.

## Verdict: ✅ **BETA READY**

The user-critical realtime flows work, the hierarchy is correct, observability is
safe, RBAC is protected, and stale/degraded states are honest. Operational
prerequisites are satisfied in production — no pending prerequisite.

---

## 1. Environment tested

- Local dev + CI (`typecheck · test · build`) for the automated suite and build.
- Production Supabase (`ocopmlnkvidvmxgiwvxw`) for the operational health facts.
- Cross-browser realtime E2E: runnable locally/staging (env-gated Playwright);
  **not** in CI by design (no live app/realtime/auth) — see §7.

## 2. Commands run (evidence)

| Command | Result |
|---|---|
| `npm run typecheck` | ✅ pass |
| `npm run test:run` | ✅ **1247 passed** (98 files) |
| `npm run build` | ✅ pass (Product Brain prebuild + i18n parity green) |
| `npm run test:e2e:list` | ✅ lists the multi-tab realtime spec (1 test) |
| `eslint` (realtime + new files) | ✅ 0 problems (no new react-hooks debt) |
| prod `living_graph_realtime_health()` | ✅ publication_ok=true, rls_enabled=true, policies=2 |
| prod `task_subtasks` / health fn exist | ✅ true / true |

## 3. Beta readiness gates

| Gate | Status | Backed by |
|---|---|---|
| **1 · Core Realtime** — Workboard + Living Graph auto-update, honest freshness | ✅ | `REALTIME-TASK-STATUS-WORKBOARD-LIVING-GRAPH-SYNC`, `REALTIME-LIVE-CHANNEL-PUSH` |
| **2 · Cross-Browser** — real multi-tab E2E + CI-safe selector guard | ✅ | `PHASE4B-REAL-MULTI-TAB-REALTIME-E2E` |
| **3 · Hierarchy** — milestone→tasks→subtasks, evidence hidden, scoped expand | ✅ | `LIVING-GRAPH-HIGH-FIDELITY-REALTIME-VISUALIZATION`, `LIVING-GRAPH-SUBTASK-VISIBILITY-NOTEBOOKLM-MODE`, `LIVING-GRAPH-HIERARCHY-CONSISTENCY` |
| **4 · Milestone Inclusion** — new milestone visible; chain not a dependency | ✅ | `LIVING-GRAPH-NEW-MILESTONE-AUTO-INCLUSION`, `LIVING-GRAPH-MILESTONE-CHAIN-NOT-DEPENDENCY` |
| **5 · Observability** — admin panel, safe aggregates, honest "not instrumented" | ✅ | `PHASE4B-LIVING-GRAPH-OBSERVABILITY-PANEL` |
| **6 · Security/RBAC** — deny-by-default subscription/delta + admin allowlist | ✅ | `LGRE-SUBSCRIPTION`, `LGRE-DELTA-SYNC-HIERARCHY-SAFE`, `PHASE4B-LIVING-GRAPH-OBSERVABILITY-PANEL` |
| **7 · Tests/Build + hook hygiene** | ✅ | `LGRE-PERFORMANCE-THROTTLING-OBSERVABILITY-SAFEGUARDS`, `PHASE4B-REALTIME-HOOKS-LINT-HARDENING` |

Each gate's guard row + test file existence is asserted by the executable smoke
gate `beta-readiness-smoke.test.ts` (guard `PHASE4B-BETA-READINESS-SMOKE-PASS`) —
so a future change that removes a guard or its test fails CI here.

## 4. Smoke checklist (mapped to automated coverage)

1. Milestone creation appears in Roadmap + Living Graph — `LIVING-GRAPH-NEW-MILESTONE-AUTO-INCLUSION` (create actions emit the projection node; new milestone flips the canonical signature).
2. Milestone without flow edge / 0 tasks / missing layout still appears — same guard (`milestone_gate` is `default_visible`; layout is presentation-only, never gates existence).
3. Synthetic `milestone_chain` is not a dependency — `LIVING-GRAPH-MILESTONE-CHAIN-NOT-DEPENDENCY` (execution-status excludes it; detail panel dependency lists exclude it; real prerequisites still count).
4. Task status move persists + Workboard/Living Graph auto-update — `REALTIME-TASK-STATUS-WORKBOARD-LIVING-GRAPH-SYNC` (canonical `TaskStatusChanged`, signature-driven convergence) + the real E2E.
5. Cross-browser realtime — the Playwright multi-context spec (§7) + the deterministic convergence sim + selector contract.
6. Hierarchy / NotebookLM exploration, evidence hidden by default, scoped Expand-all — `LIVING-GRAPH-HIGH-FIDELITY-REALTIME-VISUALIZATION`, `LIVING-GRAPH-SUBTASK-VISIBILITY-NOTEBOOKLM-MODE`.
7. Observability panel admin-only + safe aggregates + honest unavailable — `PHASE4B-LIVING-GRAPH-OBSERVABILITY-PANEL`.
8. Stale/fresh/degraded honesty — sync-state vocabulary tested under the visualization + realtime-consumer guards.

## 5. Automated tests referenced

`realtime-consumer.test.ts` · `task-status-emission.test.ts` · `realtime-e2e-selectors.test.ts` · `e2e/realtime-sync.spec.ts` · `living-graph-realtime-integration-readiness.test.ts` · `living-graph-new-milestone-inclusion.test.ts` · `living-graph-status.test.ts` · `living-graph-observability.test.ts` · `living-graph-realtime-subscription.test.ts` · `living-graph-realtime-delta-sync.test.ts` · `living-graph-realtime-performance.test.ts` · `realtime-graph.render.test.tsx` · `beta-readiness-smoke.test.ts`.

## 6. Operational readiness (prod, verified this pass)

| Prerequisite | Status |
|---|---|
| `project_event_log` in `supabase_realtime` publication (`20260833`) | ✅ present |
| RLS on `project_event_log` (+ members-read) | ✅ enabled, 2 policies |
| `task_subtasks` (`20260834`) | ✅ exists |
| Observability health RPC (`20260836`) | ✅ present |
| Admin allowlist for the Observability Panel (`PRODUCT_BRAIN_ALLOWED_EMAILS`) | ✅ set in prod |
| Pending production migration blocking beta | ✅ none |

## 7. Cross-browser E2E status

`e2e/realtime-sync.spec.ts` (Playwright, two isolated browser contexts) proves
Browser A → Done updates Browser B's Workboard + Living Graph with no reload and
honest sync. It is **env-gated** (self-skips without `E2E_*`) and runs
local/staging — not CI (no live app/realtime/auth), documented in
`phase4b-multi-tab-realtime-e2e.md`. CI-safe protection: the selector-contract
guard + the deterministic convergence simulation both run in CI.

To run: set `E2E_BASE_URL`, `E2E_STORAGE_STATE`, `E2E_PROJECT_ID`, `E2E_TASK_ID`,
`E2E_TASK_TITLE`, then `npx playwright install chromium && npm run test:e2e`.

## 8. Security / RBAC status

Deny-by-default subscription + delta access (tenant isolation; cross-project/org
treated as unauthorized), append-only ledger, admin observability behind the
strict email allowlist (404 on denial), safe aggregates only (no payloads / no
tenant detail). ✅

## 9. Issues found / fixed / deferred

- **Found/fixed:** the smoke meta-test initially matched a `page.reload()` mention
  in an E2E comment → scoped the assertion to executable code. No product issues
  found.
- **Deferred (documented, not blockers):** delta/recalc/render counters are
  in-memory per graph consumer, shown honestly as "not instrumented" in the panel
  (surfacing them needs a telemetry sink); Scenarios 2/3 of the E2E
  (milestone-creation inclusion, reconnect recovery) are follow-up E2E cases;
  pre-existing repo-wide `react-hooks/*` advisories in non-realtime areas (CI runs
  typecheck·test·build, not lint).

## 10. Known limitations

Cross-browser realtime is proven by a real spec but validated in CI only via the
deterministic convergence sim + selector contract; observability is session/
in-memory. Neither blocks beta.

## 11. Final verdict

✅ **BETA READY.** No operational prerequisite is outstanding. When realtime
degrades, the panel + honest stale/degraded indicators show it; when a task
moves, both surfaces update automatically and cross-browser; the hierarchy stays
Milestone → Tasks → Subtasks → Child Subtasks → Evidence (only when requested).

## 12. Recommended next milestone

**Option C — Phase 5: Beta Feedback & UX Refinement** — expose the Living Graph
realtime to selected beta users and iterate on feedback. (Options A/B — PMO
Portfolio rollup, Isabella realtime intelligence — are the capability-expansion
paths after beta feedback.)
