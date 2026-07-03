# Phase 4 — Living Graph Realtime Engine · Closeout & Release Readiness

**Task 7** — final integration, regression pass, and release-readiness gate for
Phase 4. This is not a feature task: it validates that Tasks 1–6 (+ the Realtime
Task Status Sync fix and the NotebookLM-style subtask visibility corrections) are
integrated, tested, documented, and trustworthy.

**Assessment: ✅ RELEASE-READY.** All operational prerequisites are satisfied in
production; no pending migration.

---

## 1. Phase 4 tasks validated

| Task | Guard(s) | Status |
|---|---|---|
| 1. Architecture & Contracts | `LGRE-FOUNDATION` | ✅ |
| 2. Event Subscription Layer | `LGRE-SUBSCRIPTION`, `REALTIME-LIVE-CHANNEL-PUSH` | ✅ |
| 3. Incremental Recalculation Service | `LGRE-RECALCULATION` *(= the "LGRE-INCREMENTAL-RECALCULATION-SERVICE" coverage; repo naming)* | ✅ |
| 4. Delta Store & Sync Contract | `LGRE-DELTA-SYNC-HIERARCHY-SAFE` | ✅ |
| 5. High-Fidelity Visualization | `LIVING-GRAPH-HIGH-FIDELITY-REALTIME-VISUALIZATION` | ✅ |
| 6. Performance / Throttling / Observability | `LGRE-PERFORMANCE-THROTTLING-OBSERVABILITY-SAFEGUARDS` | ✅ |
| Realtime Task Status Sync fix | `REALTIME-TASK-STATUS-WORKBOARD-LIVING-GRAPH-SYNC` | ✅ |
| Subtask visibility / NotebookLM | `LIVING-GRAPH-SUBTASK-VISIBILITY-NOTEBOOKLM-MODE`, `LGS-EXPAND-SCOPE`, `LGS-NODE-LABEL-CANONICAL`, `SUBTASK-MAP-LAYOUT`, `SUBTASK-PROGRESS`, `TASK-EXECUTION-MAP` | ✅ |
| 7. Integration & Final Regression Pass | `LIVING-GRAPH-HIERARCHY-CONSISTENCY` (umbrella), `PHASE4-LIVING-GRAPH-REALTIME-INTEGRATION-READINESS` | ✅ |

---

## 2. Release gates

### Security / RBAC gate — ✅
- Deny-by-default access before subscription attach and before delta delivery
  (subscription manager + delta store `unauthorized`); RLS "Members read
  project_event_log" is the outer wall (2 policies, RLS enabled in prod).
- Cross-project / cross-org scope is treated as unauthorized (no leak);
  unauthorized nodes are never rendered or counted; error reasons are
  machine-readable and tenant-safe.
- Reconnect re-checks permission; permission loss stops delivery.

### Hierarchy gate — ✅
- Milestone/phase scope → root + **direct tasks** only; task expansion → **direct
  subtasks** only; child subtask → branch expansion only; **no unrelated leakage**.
- **Evidence/event nodes are never default-visible** (`resolveNodeVisibility` →
  `visible_in_evidence_overlay`), even when the evidence layer is included.
- Hierarchy edges are distinct from dependency/evidence edges; scoped Expand-all
  never dumps the project; a large scope arms a confirmation.

### Realtime gate — ✅
- A task status move persists (status-only, preserve-on-absent) and emits the
  canonical `TaskStatusChanged` event through the append-only ingestion path.
- Workboard updates without manual refresh; the Living Graph (both the
  `/execution-map/realtime` view and the classic SSR `/execution-map/living-graph`
  view via the auto-refresh bridge) updates without manual refresh; cross-browser
  convergence via the shared signature/delta stream.
- Critical updates flush immediately (never silently dropped); degraded realtime
  falls back to polling and shows honest stale/degraded state (never fake "live").
- Missed-update recovery via contiguous delta replay or `full_resync`.

---

## 3. Operational / deployment prerequisites — ALL SATISFIED (prod)

Verified against prod (`ocopmlnkvidvmxgiwvxw`) on this pass:

| Prerequisite | Status |
|---|---|
| `project_event_log` in `supabase_realtime` publication (migration `20260833`) | ✅ present |
| RLS enabled on `project_event_log` + members-read policy | ✅ enabled, 2 policies |
| `task_subtasks` table (migration `20260834`) | ✅ exists |
| Environment variables | ✅ existing Supabase URL/anon key (no new vars) |
| Pending production migration | ✅ none |

No manual operational step is required before production. The live postgres_changes
channel is active; the polling fallback (LGRE ladder) covers degraded realtime.

---

## 4. Commands run (Task 7)

- `npm run typecheck` → pass.
- `npm run test:run` → pass (**1182** tests / 93 files).
- `npm run build` → pass (Product Brain `prebuild` generation runs first).
- `npm run lint` → see Known limitations (pre-existing advisory warnings, not a CI gate).

---

## 5. Known limitations

- **Lint (advisory, not a CI gate):** the repo has ~96 pre-existing
  `react-hooks/*` advisory errors (React-Compiler-era rules:
  `set-state-in-effect`, `refs`, `exhaustive-deps`, `static-components`). CI runs
  `typecheck · test · build`, not lint. Five of these are in Phase-4 realtime
  hooks (`use-live-graph-sync.ts`, `realtime-living-graph.tsx`) and match the
  same repo-wide subscription/callback-ref pattern; they are not correctness bugs
  and were **not** introduced by Task 7. Restructuring shipped, tested realtime
  hooks to satisfy them would risk the corrected realtime behavior and is
  deferred (see recommended Option C).
- **Cross-browser socket behavior** is validated deterministically (shared
  signature/delta stream, consumer logic unit-tested) and by manual QA, not by an
  automated multi-tab e2e.
- **Observability** counters are per-consumer and in-memory (no server sink /
  dashboard yet).
- **Delta batching** at the render-frame level (individual node deltas) is a
  future optimization; today the consumer relies on the content-signature guard
  for final-state convergence.

---

## 6. Confirmations

- ✅ Canonical truth not mutated.
- ✅ `project_event_log` not updated/deleted (append-only respected; UI never
  writes it).
- ✅ `process_nodes` / `process_edges` not modified.
- ✅ UI does not consume raw `project_event_log` rows.
- ✅ UI does not consume raw Supabase realtime payloads (typed notices only).
- ✅ UI does not calculate graph truth.
- ✅ Evidence/events hidden by default.
- ✅ Hierarchy-safe narrowing works.
- ✅ Realtime task-status sync works (Workboard + Living Graph, cross-browser).
- ✅ Stale/degraded state is honest.

---

## 7. Recommended next phase

**Option C — Phase 4B Hardening / Beta Readiness** is the honest next step: resolve
the advisory `react-hooks/*` lint debt in the realtime hooks (carefully, behind
the existing tests), add a multi-tab e2e for cross-browser sync, and surface an
observability panel — before advancing to a new capability.

After 4B, **Option A (PMO Portfolio Living Graph Realtime Rollup)** or **Option B
(Isabella Realtime Process Intelligence)** are the capability-expansion paths.
