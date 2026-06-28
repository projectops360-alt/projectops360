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

## REG-009 — Project Memory voice notes → actions/decisions lost
- **Description:** Project Memory previously let users capture a note by **voice (dictation)**,
  have AI structure it, review the extracted actions/decisions/risks, and save approved items into
  Project Memory. This is **ProjectOps Scribe**. The capability was missing.
- **Observed:** No "ProjectOps Scribe" / voice entry point in Project Memory in production.
- **Expected:** Voice note → transcript → AI extraction (actions/decisions/follow-ups/risks) →
  human review → save into Project Memory, with the original transcript + source excerpts preserved.
- **Impact:** High — removes a core capture mechanism. **Severity:** High.
- **Root cause (audited 2026-06-27): code lost in the feat/rythm divergence (same family as
  REG-004/005/007).** ProjectOps Scribe (`src/lib/scribe/ai.ts`,
  `components/memory/scribe-modal.tsx`, `components/memory/use-dictation.ts`,
  `memory/scribe-actions.ts`, and the Scribe wiring in `memory-client.tsx`) existed **only on
  `feat/rythm`** — **zero scribe files on `master`** — even though the migrations
  (`20260805_project_scribe`, `20260810_scribe_traceability`) were applied to prod
  (`project_scribe_items` = 14 rows). The voice "transcription" is **browser Web Speech API
  dictation** (no AssemblyAI / no env var), distinct from the Rythm meeting-audio flow.
- **Status: RESTORED (2026-06-27).** Brought the Scribe files onto `master`; replaced the one RBAC
  guard (`requireProjectContributor`) with master's `getOrgContext` + project-ownership check; added
  `project_backlog_items` to `EmbeddableEntityType` so Scribe-created work items are searchable.
  Prod schema already had the tables/columns. Build green; deployed + promoted.
- **Anti-hallucination (preserved):** the AI extracts only what the capture supports, requires a
  verbatim `source_excerpt` per item, uses `null` for missing owner/date, marks uncertain items
  `needs_review`, and **never creates entities without human approval**.
- **Protection rule (binding):** future Project Memory / ProjectOps Scribe / AI-extraction /
  transcription / UI changes **must not remove** the voice-note → actions/decisions → review →
  Project Memory workflow. Project Memory remains the permanent evidence store.
- **Owner:** Product. **Verify:** Project Memory → "ProjectOps Scribe" → Dictate → Analyze →
  review → Save.

## REG-010 — Cross-module metric rollup inconsistency
- **Description:** The same execution facts were computed independently in several places with
  divergent rules, so different surfaces disagreed for the **same project** ("Mobile App Design").
- **Observed (2026-06-27, prod fixture "Mobile App Design"):**
  - Living Graph header showed **0 blocked**, but Executive Insights / PMO Summary showed
    **"Blockers: 1"** — the "1" was a **completed** task ("Delivery Date Compliance Report",
    status `done`) carrying a **stale `is_blocked = true`** flag (REG-008 family).
  - Resource Capacity **"At-risk Milestones" KPI card** showed **1** while the **"Capacity risks"
    list** showed **2** — the card counted `high` only; the list counted `high + medium`.
  - Metrics did not declare scope, so non-comparable numbers were visually compared.
- **Root cause:** duplicated rollup logic. `health.ts`, `command-center/service.ts`, and
  `executive-summary-panel.tsx` each counted blockers as `status === "blocked" || is_blocked`
  **without excluding terminal tasks**, so a stale flag on a Done task inflated the count. The
  Living Graph header already used the deterministic resolver (REG-008), hence the disagreement.
  Capacity card and list used different risk-level scopes.
- **Fix (durable, data-source level — not frontend formatting):**
  - New canonical module `src/lib/execution/task-activity.ts` — the single source of truth for
    `isActiveStatus / isTerminalStatus / isCompletedStatus / hasActiveBlocker / isUnassigned`.
    A terminal task (`done`, `tested`, `implemented`, `deferred`, `cancelled`) is **never** an
    active blocker, regardless of a stale flag.
  - Rewired `health.ts`, `command-center/service.ts`, and `executive-summary-panel.tsx` to use
    `hasActiveBlocker` → all blocker counts now agree with the Living Graph header.
  - New `src/lib/project-rollups/project-rollup-engine.ts` — deterministic project rollup
    (`activeBlockers`, `waitingOnDependency`, `overdue`, `unassignedActive`, `missingEstimateActive`,
    `priorityActive`, `milestoneHealth`, `counts`). Every metric carries an explicit **scope** and
    dev-only `evidenceIds`. No-owner / missing-estimate are **capacity warnings, not blockers**.
  - Capacity service: `atRiskMilestoneCount` now counts `high + medium` (matches the list);
    `high`-only feeds the health index as `severeCapacityGapMilestoneCount`. Card sub-label states
    the scope ("high + medium risk").
- **Note on the milestone false-"Blocked" badge:** not reproducible in current data —
  `getComputedMilestoneStatus` derives status from `status === "blocked"` task counts (0 for
  "Launch and Performance Tracking"), and the `status_override_*` columns **do not exist in prod**
  (the override branch is dead). The earlier observation was a stale deploy / transient blocked
  task; the deterministic logic is correct.
- **Status: FIXED (2026-06-27).** Tests `task-activity.test.ts` + `project-rollup-engine.test.ts`
  (incl. the Done+stale-flag fixture) green; typecheck clean.
- **Protection rule (binding):** any surface reporting blockers/waiting/capacity/priority/milestone
  rollups **must** use `task-activity.ts` rules (or the rollup engine). Completed/terminal tasks
  must never count as active blockers, waiting, or capacity risks. Every metric must declare its
  scope; only same-scope numbers are comparable. Related:
  [REG-006](#reg-006--confusing-blocked-vs-waiting-on-dependency),
  [REG-008](#reg-008--living-graph-false-blocked).
- **Owner:** Product. **Verify:** open "Mobile App Design" → Living Graph header blockers ==
  Executive Insights blockers == PMO Summary blockers; Resource Capacity card == list.

## REG-011 — Rythm/Rhythm duplicate navigation and broken route
- **Description:** Project navigation exposed **two** visible, near-identically named menu items —
  **Rhythm** (`/rhythm`, "Ritmo", Rhythm Center calendar+meetings) and **Rythm** (`/rythm`, "Rythm",
  meeting/audio intelligence). One of them, `/projects/:projectId/rythm`, failed to load with a
  server error.
- **Observed (prod):** `/rythm` rendered *"This page couldn't load — A server error occurred. Reload
  to try again."* Two visible nav items for the same meeting/conversation capability.
- **Expected:** Exactly **one** visible Rythm/Rhythm module in navigation; every old and canonical
  route safe (load or redirect — never crash).
- **Impact:** High — a broken route plus duplicate module names make the product feel unstable and
  erode trust. **Severity:** High.
- **Root cause (audited 2026-06-27):** the **`master` vs `feat/rythm` divergence** (DEBT-001 /
  DEBT-004 family). The standalone Rythm dashboard on `master` queries `project_rythm_meetings`
  (see `lib/rythm/meeting-service.ts`), **a table that never reached production**. In prod the Rythm
  audio capability was folded into the Rhythm Center schema (migrations `rythm_audio_into_rhythm`,
  `rythm_*` 20260620–20260621); the prod Rythm tables are
  `project_rythm_{audio_files,transcripts,processing_jobs,activity_log,speaker_mappings,intelligence}`
  — **no `*_meetings` table**. So every `/rythm` request threw a Postgres "relation does not exist"
  error from the server component → generic error screen. It was **not** a missing env var,
  auth/guard failure, or browser-only API call.
- **Product decision — Rythm canonical naming (binding):** the two surfaces are **consolidated into
  one canonical meeting module: Rhythm Center.**
  - **Canonical visible label:** **"Ritmo" / Rhythm** (the working, prod-backed, documented module).
  - **Canonical route:** `/projects/:projectId/rhythm`.
  - **Backward-compatible alias:** `/projects/:projectId/rythm` (and `/rythm/:meetingId`) **redirect**
    to `/rhythm`. Old bookmarks and deep links stay safe.
  - **Rationale:** making `/rythm` canonical instead would have required hiding the *working* Rhythm
    Center calendar (a second regression) and applying the never-shipped `project_rythm_meetings`
    migration to prod (risk + schema divergence). Prod already treats audio as part of Rhythm, so
    Rhythm-canonical is the only choice that keeps production healthy and deletes no working feature.
- **Status: RESOLVED (2026-06-27).** Fix (durable — removes the broken query path, not a try/catch
  mask):
  - Removed the duplicate **"rythm"** tab from `src/components/layout/project-tabs.tsx` (single
    ProjectTabs nav serves desktop + mobile) — only **"Ritmo"/Rhythm** remains.
  - Converted `app/.../projects/[projectId]/rythm/page.tsx` and `.../rythm/[meetingId]/page.tsx`
    into locale-aware **redirects** to `/rhythm` (same pattern as the `roadmap → execution-map`
    alias). No code reaches the phantom `project_rythm_meetings` query anymore.
  - The `lib/rythm` + `components/rythm` cluster is **kept (dormant)**, not deleted — it can be
    re-wired into Rhythm Center when audio intelligence is properly shipped on the prod schema.
- **Conceptual model (recorded):** **Rythm** = meeting/audio intelligence (lives within Rhythm
  Center) · **ProjectOps Scribe** = quick dictated/pasted capture (REG-009) · **Project Memory** =
  permanent evidence store · **Isabella** = retrieval/explanation interface. No capability has two
  visible homes.
- **Protection rule (binding):** navigation must **never** expose two visible modules for the same
  capability. A single capability = one visible nav item + one canonical route; every legacy route
  must be an explicit redirect/alias, never a crash. Resolves **DEBT-004**. Related: DEBT-001,
  [REG-009](#reg-009--project-memory-voice-notes--actionsdecisions-lost).
- **Owner:** Product. **Verify:** open any project → only one "Ritmo" tab (desktop + mobile);
  visit `/projects/:id/rythm` → lands on `/rhythm` with no error; `/projects/:id/rythm/<anything>`
  → `/rhythm`; Project Memory + ProjectOps Scribe routes unchanged.

## REG-012 — BIM Module Missing from Navigation
- **Description:** The BIM module is no longer visible in the project navigation. BIM is the
  **Drawing Intelligence** capability (user-facing label "BIM" since commit `84bdee5` —
  *"rename Drawing Intelligence → BIM"*), surfaced as the project tab `drawingIntelligence`
  (`/projects/:projectId/drawing-intelligence`) and as an AI Operator hub card. This appears to be
  a navigation/visibility regression rather than a routing deletion.
- **Observed (audited 2026-06-27):** the BIM tab is **gated by the `drawing_intelligence` module**
  (`project-tabs-config.ts` → `module: "drawing_intelligence"`), which is only in the default
  module set for **construction** project types (`data_center/residential/commercial/infrastructure/
  industrial`). For `software_development` and `general` projects the tab is **silently hidden with
  no explanation** — the same filter that hides truly-irrelevant tabs also hides a strategic module.
  Compounding it, the project menu had **13 flat tabs** (UX-006), so even when present BIM competed
  for attention in an overcrowded bar.
- **Expected behavior:** BIM must be available in the project workspace for projects where BIM is
  enabled or relevant, and **discoverable** (not silently removed) elsewhere. It must live in an
  appropriate grouped navigation area (a dedicated **Technical / BIM** group), never buried only in
  Settings or so deep users cannot find it.
- **Impact:** **Critical** for construction and technical projects. BIM is a strategic ProjectOps360°
  capability and must remain discoverable. **Severity:** Critical.
- **Root cause:** two compounding factors —
  1. **Module gating without a visibility fallback.** The nav filter `(!tab.module || enabledModules
     .includes(tab.module))` treats BIM like any optional tab, so non-construction projects lost it
     entirely with no "not enabled here" affordance.
  2. **Navigation overcrowding (UX-006).** A flat 13-item tab bar with no grouping meant a leaner
     menu was overdue, and the simplification work risked hiding strategic modules if done naively.
  The **BIM route itself was never deleted** — `/projects/:projectId/drawing-intelligence` still
  renders and degrades gracefully (missing drawing tables → empty lists; only `notFound()` when the
  project itself is absent), so direct/deep links never server-crash.
- **Status: RESOLVED (2026-06-27).** Fix (durable — grouping + visibility contract, not a label patch):
  - Restructured the project nav into **grouped navigation** (`TAB_GROUPS` in
    `project-tabs-config.ts`): **Command Center · Planning · Execution · Resources · Intelligence ·
    Technical / BIM · More**. `TAB_ITEMS` is now derived (`flatMap`) so existing importers/tests keep
    working. See **UX-006** and **PD-009**.
  - BIM lives in a dedicated **Technical / BIM** group. For projects where `drawing_intelligence`
    is not enabled, BIM is **kept visible as a disabled, explained entry** ("BIM is not enabled for
    this project") via `keepDisabledWhenModuleMissing` — never silently removed.
  - All legacy routes preserved; `/projects/:projectId/drawing-intelligence` unchanged and still
    crash-safe.
- **Protection rule (binding):** **navigation simplification must never remove or orphan an existing
  strategic module.** Grouping reduces clutter by organizing capabilities **by user intent**, never by
  hiding them. BIM must remain visible through an appropriate grouped navigation area (Technical / BIM)
  or a context-aware, explained disabled entry. Related: [REG-011](#reg-011--rythmrhythm-duplicate-navigation-and-broken-route)
  (single visible home per capability), [No silent regressions rule].
- **Owner:** Product. **Verify:** open any **construction** project → **Technical / BIM** group shows
  **BIM** → it opens Drawing Intelligence. Open a **software/general** project → **Technical / BIM**
  shows **BIM disabled** with the "not enabled" tooltip. Visit `/projects/:id/drawing-intelligence`
  directly → renders without a server error.

---

### Resolved
*(none fully closed yet — REG-004/005 partially resolved; keep open until depth/vision shipped.)*
