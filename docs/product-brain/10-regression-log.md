# 10 — Regression Log

A regression is functionality that was working or intended and was lost, hidden, or degraded.
Every regression is tracked here until Resolved. Fields: Description · Observed · Expected ·
Impact · Severity · Investigation status · Owner · Next action.

> Root cause for most entries: the `master` vs `feat/rythm` divergence (see DEBT-001). A large
> body of work never reached `master` after the post-divergence rebuild.

---

## REG-001 — Possible loss of manual Team Member creation
- **Description:** Ability for a PM/PMO to manually add a named team member.
- **Observed:** Needs verification on current `master`.
- **Expected:** PM/PMO can add a brand-new named member directly.
- **Impact:** Team setup blocked if absent. **Severity:** High.
- **Investigation status:** **Likely PRESENT on `master`** via team onboarding PRs (#7, #8, #10).
  Must be confirmed by exercising the `/team` flow. → mark **Unknown** until verified.
- **Owner:** TBD. **Next action:** verify `/team` create-member on `master`; close or escalate.

## REG-002 — Possible loss of Team Member rename/edit
- **Description:** Inline rename/edit of a project or workspace member.
- **Observed:** Needs verification.
- **Expected:** Rename pencil always visible; edits persist (incl. cross-org profiles).
- **Impact:** Stale/incorrect names. **Severity:** Medium-High.
- **Investigation status:** **Likely PRESENT on `master`** (PRs #8, #11 "rename pencil always
  visible", "profiles read by id"). Confirm by exercising. → **Unknown** until verified.
- **Next action:** verify rename on `/team`.

## REG-003 — Possible loss of user creation with email/password
- **Description:** Create a login (email + temporary password) without SMTP; forced
  first-login password change.
- **Observed:** Needs verification.
- **Expected:** Member gets a temp-password login; can change it on first sign-in.
- **Impact:** Onboarding blocked. **Severity:** High.
- **Investigation status:** **Likely PRESENT on `master`** (PR #7, #9 new-user-creation guards).
  → **Unknown** until verified.
- **Next action:** verify create-login flow end-to-end.

## REG-004 — Resource Capacity / Labor Capacity vision lost
- **Description:** Resource Capacity Intelligence module (utilization, overhead, availability,
  health) disappeared from `master`.
- **Observed:** Module + `/resource-capacity` route absent on `master` before 2026-06-27; lived
  only on `feat/rythm`; migration `20260812` was applied to prod but code was missing.
- **Expected:** Full Resource Capacity Intelligence per ADR-003 / doc 13.
- **Impact:** Core P3 capability invisible. **Severity:** Critical.
- **Investigation status:** **RESTORED 2026-06-27 (PR #23)** — engine + page + editor + migration
  back on `master`, deployed to prod. Vision depth (forecast/burnout/simulation) still open.
- **Owner:** Product. **Next action:** implement depth per doc 13; keep CAP-009 honest.

## REG-005 — Living Graph prominence reduced / not as intended
- **Description:** Living Graph enhancements (Workforce layer, executive insights, graph-first
  layout, recalculate, live status) lost on `master`; graph risked becoming decorative.
- **Observed:** 11 LG commits on `feat/rythm` never reached `master`; the 5 core LG files were
  frozen on `master`.
- **Expected:** Living Graph as primary intelligence/navigation surface (ADR-002 / doc 12).
- **Impact:** Strategic surface degraded. **Severity:** High.
- **Investigation status:** **PARTIALLY RESTORED 2026-06-27 (PR #23)** — enhancements back; the
  broader "primary navigation/impact surface + status-engine + Isabella explanations" vision is
  still open.
- **Next action:** doc 12 roadmap; wire Execution Status Engine; node Blocked/Waiting fix.

## REG-006 — Confusing Blocked vs Waiting-on-Dependency
- **Description:** A single "Blocked" state represents multiple execution scenarios; items
  merely waiting for predecessors are shown as Blocked (lock icon).
- **Observed:** `living-graph-node.tsx` renders a lock for `isBlocked`; milestone status conflates
  blocked/at_risk; no distinct "Waiting on Dependency."
- **Expected:** Independent dimensions; Blocked only with an explicit impediment (ADR-006).
- **Impact:** Misleads PMs about reality. **Severity:** High.
- **Investigation status:** **OPEN.** Execution Status Engine prototype (`status-engine.ts`,
  doc 18) implements the correct rules but is **not wired**.
- **Owner:** Product. **Next action:** wire the engine into the Living Graph + Isabella (doc 18).

## REG-007 — Living Graph Labor/Workforce Load Layer "lost"
- **Description:** The Living Graph previously had a Labor/Workforce layer to see **who is
  overloaded, who is available, and which activity/task is causing the overload**, with
  resource nodes connected to their assigned work. The product owner reported it as lost.
- **Observed:** Not visible in production.
- **Expected:** Workforce/labor load signals by person/resource and by assigned activity/task,
  on the Living Graph.
- **Impact:** High — it is a core execution-intelligence capability of the primary surface.
  **Severity:** High.
- **Investigation status (audited 2026-06-27): RESTORED IN CODE — root cause was a DEPLOYMENT
  promotion gap, not a code deletion.** Findings:
  - The capability **exists and is fully wired**: `lib/graph/workforce-graph-mapping.ts`
    (`mapWorkforceResourceNodes`, `mapWorkforceAssignmentEdges`, `enrichNodesWithWorkforce`) +
    the construction `lib/graph/labor-graph-mapping.ts`; overlays `workforceCapacity` /
    `laborCapacity` are selectable in `living-graph-toolbar.tsx`; the server page computes and
    passes `resourceCapacity` (`computeResourceCapacity`) into `living-graph-view.tsx`; i18n
    labels present ("Workforce Intelligence" / "Labor Capacity View").
  - It was lost on `master` during the feat/rythm divergence (this is the Living-Graph facet of
    [REG-005](#reg-005--living-graph-prominence-reduced--not-as-intended)) and **restored in code
    via PR #23** (2026-06-27).
  - **Why it appeared lost:** the production domain alias was frozen on commit `e7d004c` (#22)
    — a CLI-pinned deployment — so none of PRs #23–#28 reached the live URL until the alias was
    promoted via `vercel --prod` on 2026-06-27. See [[vercel-deployment]] (deploy memory) and
    DEBT for the promotion-gap lesson.
- **Status:** Code = restored; Production = now live after alias promotion. **Open items:**
  discoverability — the people-nodes + assignment-edges view appears in the **Activities/Events**
  view level (not the default **Milestones** level), and requires captured capacity data
  (`hasResources`). Recommend a follow-up to auto-surface it when the Workforce/Labor overlay is
  selected.
- **Protection rule (binding):** future changes to the Living Graph, Resource Capacity
  Intelligence, Labor Capacity, or the Workforce Intelligence Layer **must not remove** the
  ability to see who is overloaded/available and which activity/task causes the overload. Any
  change that would must be an explicit, recorded decision.
- **Owner:** Product. **Next action:** verify in-app (see doc 12 §"Recovered Labor/Workforce Load
  Layer"); optional discoverability improvement.

## REG-008 — Living Graph shows a resolved/false Blocked state
- **Description:** The Living Graph header showed a blocked count (e.g. "8 nodes · 7 edges · 1
  blocked") for project *Mobile App Design* while the Status Report showed the project on track
  with no active blocker. The graph conflated a stale blocker flag with an active impediment.
- **Observed:** Header "1 blocked"; Status Report: 18/27 done, 9 in progress, on track, some tasks
  waiting on predecessors. Disagreement.
- **Expected:** Blocked only with an explicit **active** unresolved impediment. Waiting on a
  predecessor shows as **Waiting on Dependency**, not Blocked.
- **Impact:** High — false blockers destroy trust in the graph and executive health. **Severity:** High.
- **Root cause (audited 2026-06-27):** the single "blocked" node was task **"Delivery Date
  Compliance Report"** — `status = done`, `progress = 100`, but with a **stale `is_blocked = true`
  flag** (old reason: "no one in the org can do this task") that was never cleared when the work
  completed. 0 tasks had `status='blocked'`, 0 `blocker_event` nodes. The graph's `node.isBlocked`
  derivation used `task.is_blocked` blindly (and milestone aggregation propagated it), while the
  Status Report counted active blockers → mismatch.
- **Status: RESOLVED (2026-06-27).** Deterministic fix (not a label patch):
  - The Living Graph now consumes the **Execution Status Engine** via
    `src/lib/graph/living-graph-status.ts` (`resolveNodeExecutionStatus`, `computeGraphStatuses`).
  - **A completed/cancelled item is never Blocked** — fixed at the source in `normalizeNode`
    (completed task → `isBlocked = false`) and in the engine (terminal lifecycle wins).
  - **Blocked requires an explicit active impediment; Waiting on Dependency** (unfinished
    predecessor) is computed and **counted separately**. Header now shows
    "… · {blocked} blocked · {waiting} waiting"; the node renders 🔗 for waiting, 🚫 for blocked.
  - Unit tests in `src/lib/graph/__tests__/living-graph-status.test.ts` cover the cases.
  - Note: the stale DB flag is harmless now (code ignores it on completed tasks); the durable fix
    is the code, so no prod data mutation was required.
- **Protection rule (binding):** the Living Graph must derive node state from the Execution Status
  Engine (or an equivalent deterministic resolver). It must **never** compute Blocked ad hoc from
  dependencies or from a flag on a completed item. Header counts must come from the same resolver
  as the node indicators. Related: [REG-006](#reg-006--confusing-blocked-vs-waiting-on-dependency).

---

### Resolved
*(none fully closed yet — REG-004/005 partially resolved; keep open until depth/vision shipped.)*
