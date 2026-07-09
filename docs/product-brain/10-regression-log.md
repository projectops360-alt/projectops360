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

## REG-013 — Isabella Project Health Briefing not triggering on load
- **Description:** Isabella previously provided a proactive **project health/status briefing** when
  opened inside a project. She regressed to a passive generic guide state and no longer
  automatically analyzes the project.
- **Observed:** Opening Isabella inside a project showed only the generic prompt *"What are you
  trying to accomplish today?"* — no project-aware briefing.
- **Expected:** When opened inside a project context, Isabella generates a **grounded Project Health
  Briefing** using deterministic project data and clearly identifies what is healthy, what needs
  attention, and what the user should do next.
- **Impact:** High — Isabella loses operational value if she waits for the user to ask basic
  project-health questions she should proactively surface. **Severity:** High.
- **Root cause (audited 2026-06-28):** two compounding factors —
  1. **No project context reached Isabella.** The app layout mounts `LivingGuideWidget` with a base
     context of `{ module: "", role, userId, organizationId }` — **no `projectId`** — and
     `enrichContextWithScreen` never derived it from the route. So even a briefing capability could
     not know which project she was in.
  2. **No briefing surface existed.** `isabella-experience.tsx` only rendered a passive greeting +
     generic prompt; the persona carried "briefing readiness" tone guidance but nothing fetched or
     rendered real project data. (The deterministic `project-rollup-engine.ts` from REG-010 existed
     and was tested, but was **not wired into any runtime surface**.)
- **Status: RESOLVED (2026-06-28).** Deterministic fix (not an AI prompt patch):
  - **Project context:** `extractProjectId` + `enrichContextWithScreen` (`lib/knowledge-os/screens.ts`)
    now derive `projectId` from `/projects/{id}/…` so Isabella detects project context.
  - **Briefing engine:** new `lib/project-briefing/{types,briefing-engine,briefing-copy,service}.ts`.
    The engine is **pure and deterministic**, reusing `project-rollup-engine.ts` (REG-010),
    `roadmap/progress.ts`, and `task-activity.ts` blocker rules — so the briefing **agrees** with the
    Living Graph header, Executive Insights, and Resource Capacity. **No AI call on open.**
  - **Surface:** `components/isabella/project-briefing.tsx`, rendered by `isabella-experience.tsx`
    above the generic prompt when a project context exists. Includes **Refresh** (re-run) and
    session-scoped **Dismiss**, plus **Verify in app** deep links.
  - **Honesty:** Blocked vs Waiting separated; terminal tasks never count as active blockers;
    missing data → explicit `dataGaps`; "looks stable" when nothing is flagged. Nothing invented.
  - **RBAC:** org role → briefing scope (owner/admin = full · member = execution-only · viewer =
    external-safe); sensitive capacity/personnel and governance detail withheld below `full`.
  - Tests: `lib/project-briefing/__tests__/briefing-engine.test.ts`; Product Brain QA seeds added.
- **Protection rule (binding):** future Isabella UI, mode, Product Brain, or layout changes **must
  not remove** the project-aware automatic briefing behavior. When opened inside a project, Isabella
  must proactively surface a grounded briefing (health, blockers vs waiting, capacity warnings,
  risks, recommended actions) and never invent findings. Related:
  [REG-006](#reg-006--confusing-blocked-vs-waiting-on-dependency),
  [REG-008](#reg-008--living-graph-shows-a-resolvedfalse-blocked-state),
  [REG-010](#reg-010--cross-module-metric-rollup-inconsistency), [No silent regressions rule].
- **Follow-up (2026-06-28) — PMO Portfolio Briefing:** extended the same proactive behavior to the
  PMO. When Isabella opens **outside a project** for an **owner/admin**, she shows a deterministic
  **Portfolio Briefing** (org-wide health, blocked critical work, at-risk milestones, high risks,
  overdue, unassigned, pending decisions, ranked projects-needing-attention with drill-in links).
  Same engines/guarantees (no AI on open, no hallucination, Refresh + session Dismiss). Members and
  viewers keep the generic prompt. Code: `lib/portfolio-briefing/*` +
  `components/isabella/portfolio-briefing.tsx`. The PM gets project help; the PMO gets it one level up.
- **Owner:** Product. **Verify:** open any project → Isabella → a **Project Briefing** appears on
  load (overall status, what looks good, needs attention, recommended actions, verify links);
  Refresh re-runs it; Dismiss hides it for the session. Open Isabella on the **Command Center /
  home** as a PMO → a **Portfolio Briefing** appears. Open Isabella outside a project as a
  non-PMO → only the generic guide prompt.

## REG-014 — Isabella Welcome Hero lifecycle reverted
- **Description:** Isabella's approved compact-layout behavior (UX-004) was partially reverted. The
  large Welcome Hero/avatar stayed visible even after **active content** (a Project Briefing) appeared,
  wasting conversation space and pushing useful information below the fold.
- **Observed (2026-06-28):** opening Isabella inside a project showed the **large avatar + the Project
  Briefing stacked together** — the hero occupied ~40–45% of the panel above the briefing.
- **Expected:** the full Welcome Hero appears only in a true **empty welcome** state. Once there is
  any active content or interaction, Isabella collapses into a **compact header** (≤70px) and the
  content is readable immediately.
- **Impact:** High — Isabella feels like it is going backwards; the user loses usable workspace right
  after Isabella produces useful project intelligence. **Severity:** High.
- **Root cause (audited 2026-06-28):** the compact/expanded decision used
  `hasConversation = turns.length > 0`. The REG-013 Project Briefing renders in the conversation area
  but is **not a `turn`**, so with a briefing and zero turns `compactPresence` was `false` → the full
  hero rendered above the briefing. The briefing was never counted as **active content**. Single
  component (`isabella-experience.tsx`), no duplicate/legacy hero — a missing condition, not a stale
  file.
- **Status: RESOLVED (2026-06-28).** Durable fix (state machine + UX contract, not a one-off tweak):
  - The layout rule now lives in a **Product UX Contract** (UX-001) —
    `src/lib/product-ux-contracts/contracts.ts` (`resolveIsabellaLayoutState`,
    `isCompactHeaderRequired`, `isFullHeroVisible`). The component imports it, so there is ONE source
    of truth. ACTIVE_CONTENT = any of: a (Project **or** Portfolio) briefing active, ≥1 turn, a
    pending request, or the first typed character. A **briefing counts as active assistant content.**
  - The full hero is now **always mounted but CSS-collapses** (`.heroWrap` max-height/opacity →0,
    ~300ms, honors `prefers-reduced-motion`); on first load with a briefing it mounts
    already-collapsed (no hero flash, no stacking). The compact header is ≤70px and carries the
    "Grounded in Product Intelligence" badge + presence.
  - The empty greeting card shows only in EMPTY_WELCOME.
  - Protected by `src/lib/product-ux-contracts/__tests__/isabella-welcome-hero.test.ts` — fails if the
    full hero would ever appear automatically while a briefing or messages exist.
- **Protection rule (binding):** future Isabella UI changes **must preserve the approved Welcome Hero
  lifecycle** (UX-001). The large hero must never reappear automatically during an active conversation
  or while a briefing/content exists; it may return only on New Conversation / Reset / empty history,
  or by an explicit user re-expand (UX-004). The avatar is a welcome affordance, not permanent chrome.
  Related: [UX-001](32-product-ux-contracts.md), [REG-013](#reg-013), UX-004
  ([25-ux-design-debt.md](25-ux-design-debt.md)), [No silent regressions rule].
- **Owner:** Product. **Verify:** open a project → Isabella → only a **compact header** above the
  Project Briefing (no large avatar stacked); type/ask in an empty (no-project) state → the hero
  collapses smoothly; dismiss the briefing with no conversation → the full hero returns.

## REG-015 — Project Status not surfaced on the main project dashboard
- **Description:** After navigation simplification (UX-006), explained Project Status was reachable
  only via the **Status** tab; the main project **dashboard (Overview / Command Center)** did not
  surface a status summary, so "how is this project doing?" required leaving the dashboard. The
  Closeout Report (UX-009) was also buried at the bottom of the dashboard sidebar.
- **Observed (2026-06-28):** the Overview dashboard had a 5-KPI health strip but no explained Status
  card; Status lived only as a separate tab; Closeout sat below all activity/traceability/document
  cards.
- **Expected:** Project Status must be **prominent inside Command Center / Dashboard** with an
  explained health summary (blocked vs waiting, overdue, at-risk milestones, capacity warnings,
  recommended attention) using **deterministic rollup data**, while staying simplified in nav.
- **Impact:** High — PMs/PMOs need quick explained status without hunting. **Severity:** High.
- **Root cause:** the capability was **never deleted** — the `/status` route and the Status tab (in
  the **Command Center** nav group) are intact. The gap was that the dashboard itself never rendered
  a status summary, and Closeout was low in the layout.
- **Status: RESOLVED (2026-06-28).** Fix (reuses existing engines, no parallel metric):
  - A prominent **Project Status** card now sits near the top of the dashboard, computed by the SAME
    deterministic engine as Isabella's briefing (REG-013, `buildProjectBriefing` →
    `project-rollup-engine` / `task-activity`), so blocked vs waiting are separated and stale-done
    tasks never count as active blockers (REG-008/010). It links to the full `/status` report.
  - The `/status` route is unchanged and still works (no redirect needed); Status stays in the
    Command Center nav group (not in More/Settings).
  - **UX-009** — Closeout Report promoted to a "Reports & Executive Outputs" card near the top
    (alongside the Status report link), removed from the buried bottom slot. Recent Activity,
    Pending Traceability, and Key Documents remain.
  - Files: `app/.../projects/[projectId]/{page.tsx,dashboard-client.tsx}`. Guard:
    `src/components/layout/__tests__/project-tabs-nav.test.ts` (Status stays in Command Center).
- **Protection rule (binding):** navigation simplification must not remove the Project Status
  capability. If Status leaves the top-level/tab nav it must be relocated to Command Center with
  clear prominence; the dashboard must answer "how is this project doing / what needs attention /
  what report can I give leadership". Related: [UX-006](25-ux-design-debt.md), [REG-013](#reg-013),
  [REG-010](#reg-010--cross-module-metric-rollup-inconsistency), [No silent regressions rule].
- **Owner:** Product. **Verify:** open a project → Overview → a Project Status card (health band,
  %complete, blockers/waiting/overdue/at-risk, top-3 attention, "View full status") sits near the
  top; the Closeout Report appears in "Reports & Executive Outputs" near the top, not at the bottom;
  the Status tab and `/status` still work.

## REG-017 — Closeout Risk Count Does Not Match Resolve Target
- **Description:** The Closeout Report showed `Risks resolved — 2 open risk(s)` and blocked closeout,
  but the **Resolve** action routed the user to a destination where those 2 risks were **not
  visible**. The blocking count could not be reconciled with any list of actual risk records.
- **Observed (2026-06-28):** the `open_risks` readiness check reported `m.risks.open +
  m.risks.mitigated` as an **aggregate count with no record IDs**, and `readinessCtaRoute("open_risks")`
  pointed at **`/execution-map`** — a Living-Graph screen that **renders no risk view at all**. There
  is **no dedicated risk-register page** anywhere in the app (risks are only inserted via Scribe and
  read in aggregates), so the Resolve button was a dead end: the count said "2", the destination
  showed "0".
- **Expected:** the Closeout open-risk count must be **record-backed**. If Closeout says "2 open
  risks", the user must be able to click and see **exactly those 2 risk records** (title, status,
  severity, owner), and the count must equal the number of records shown. If no matching records
  exist, Closeout must **not** show a fake count — it must show 0 or an explicit data-consistency
  warning.
- **Impact:** Critical — closeout readiness is untrustworthy if a blocking count cannot be traced to
  the records that justify it. **Severity:** Critical.
- **Root cause:** **wrong/dead Resolve route + non-record-backed count.** Not a stale cache and not a
  scoping bug — `computeCloseoutMetrics` already scopes risks by `organization_id`/`project_id`/
  `deleted_at IS NULL`. The risks were real and active (`status IN ('open','mitigating')`); the
  failure was that the count was an aggregate (no IDs) and its CTA pointed to a screen that never
  showed risks.
- **Status: RESOLVED (2026-06-28).** Fix:
  - **Record-backed criteria.** `computeCloseoutMetrics` now selects full risk rows
    (`id, title, status, severity, owner_user_id`), resolves owner display names from `profiles`,
    and exposes `risks.openRecords`. The `open_risks` readiness check's count is **derived from
    `openRecords.length`** and carries `recordIds`, `records`, and `recordsConsistent` (= count ===
    recordIds.length). Canonical open-risk semantics live in the pure, client-safe
    `src/lib/rhythm/closeout-criteria.ts` (`isOpenRiskStatus`: open|identified|mitigating; never
    resolved|closed|accepted|deleted|other-project).
  - **Resolve route fixed.** `readinessCtaRoute("open_risks")` now returns **`null`** (no dead link).
    The Closeout page **discloses the exact open-risk records inline** ("View risks" expander) with
    title, status, severity, and owner — so the count is always clickable down to the records. Each
    risk is **actionable inline**: a per-risk **Resolve** button (`resolveRiskAction`, scope-checked,
    non-viewer only) sets `status = resolved` and refreshes, since there is no separate risk-register
    page to open. A **data-inconsistency warning** renders if `recordsConsistent` is false ("Closeout
    expected N open risks, but M matching records were found").
  - **Dev diagnostics.** Each record-backed criterion carries `diagnostics` (source fn, includedIds,
    excluded IDs + reasons, count, resolveRoute, generatedAt), shown in a `<details>` block when
    `NODE_ENV !== "production"`.
  - **Isabella.** The Closeout Report is now a first-class Screen-Intelligence entry
    (`screens.ts`, project sub-route matching), and `isabellaCloseoutRiskExplanation` gives her a
    deterministic, record-backed sentence that **flags a data inconsistency** when count ≠ records
    instead of repeating the number.
  - Files: `src/lib/rhythm/{closeout.ts,closeout-criteria.ts,closeout-workflow.ts}`,
    `app/.../projects/[projectId]/closeout/closeout-client.tsx`, `src/lib/knowledge-os/screens.ts`.
    Tests: `src/lib/rhythm/__tests__/{closeout-criteria,closeout-readiness,closeout-workflow}.test.ts`,
    `src/lib/knowledge-os/__tests__/screens-closeout.test.ts`.
- **Protection rule (binding):** **Any closeout blocking requirement must be traceable to the exact
  records counted.** A count without visible source records is not allowed — the count must equal
  `recordIds.length`, the Resolve action must lead to those exact records (inline or routed), and a
  count with no matching records must surface a data-consistency warning, never a silent fake
  blocker. Related: [REG-010](#reg-010--cross-module-metric-rollup-inconsistency),
  [UX-010](#), [No silent regressions rule].
- **Owner:** Product. **Verify:** open a project with open risks → Closeout → the "Risks resolved"
  row shows "N open risk(s)" with a **View risks** expander listing exactly N risks (title/status/
  severity/owner); resolving/closing all of them flips the row to pass; in dev a diagnostics block
  lists included/excluded risk IDs.

---

## REG-018 — Living Graph milestone task count/tooltip disagrees with the Workboard
- **Description:** For the **same milestone**, the Living Graph milestone card counter
  (`tasksDone/tasksTotal`) and the UX-008 edge tooltip showed **different task information** than the
  Workboard. A milestone with `not_started` tasks read fewer tasks in the graph than on the board.
- **Observed (CAP-001):** the Workboard reads the canonical owner
  (`roadmap_tasks`, `workboard/page.tsx`), but the Living Graph derived its milestone task census from
  **`process_nodes`** via `aggregateByMilestone` — and `backfill_living_graph` **skips
  `status = 'not_started'`** tasks (emit only fires on transition), so those tasks have no node and
  were silently dropped from the count/list. The graph's own Executive Insights already used the owner
  (`tasks` prop), so the graph was even **inconsistent with itself**.
- **Expected:** **Different views, same truth.** Any projection of "a milestone's tasks" (Workboard,
  Living Graph card + tooltip, dashboards) must derive its task set/counts from the **same canonical
  resolver over `roadmap_tasks`** — never from a derived substrate. `process_nodes` is a graph of
  relationships, not a census of entities.
- **Impact:** Critical — a projection presenting different business facts violates the Single Canonical
  Source of Truth principle; PMs cannot trust the graph counts. **Severity:** High.
- **Root cause:** **projection reading from another projection.** The milestone census was computed
  from `process_nodes` (a filtered event materialization) instead of the owner `roadmap_tasks`.
- **Status: RESOLVED (2026-07-01).** Fix:
  - **Canonical resolver.** New pure `src/lib/roadmap/milestone-task-census.ts`
    (`computeMilestoneTaskCensus`) groups `roadmap_tasks` by milestone using the canonical
    task-activity rules (REG-008/010: terminal ≠ blocked). It is the single producer of milestone
    task counts/lists for projections.
  - **Living Graph consumes the owner.** `execution-map/.../living-graph/page.tsx` now fetches **all**
    project tasks (not only those referenced by nodes); `aggregateByMilestone` takes an optional
    `censusByMilestone` and uses it for `tasksTotal/tasksDone/taskList` (and therefore the UX-008 edge
    tooltip). `process_nodes` still supplies relationships/edges, never the census. A fallback to
    node-counting remains only for synthetic demo data (no real tasks).
  - Files: `src/lib/roadmap/milestone-task-census.ts`, `src/lib/graph/living-graph-analysis.ts`,
    `src/components/graph/living-graph-view.tsx`,
    `app/.../execution-map/living-graph/page.tsx`.
    Test: `src/lib/graph/__tests__/milestone-task-census.test.ts`.
- **Protection rule (binding):** **Different views, same truth.** Every projection of an entity
  consumes that entity's canonical owner through a shared resolver; the Living Graph never counts tasks
  from `process_nodes`. A projection presenting different business facts for the same entity is a
  regression. Related: [REG-010](#reg-010--cross-module-metric-rollup-inconsistency),
  [UX-008](32-product-ux-contracts.md), [No silent regressions rule].
- **Owner:** Product/Engineering. **Verify:** open a project with `not_started` tasks in a milestone →
  the Living Graph card counter and edge tooltip show the **same** task count as the Workboard.

---

## REG-019 — Isabella misroutes screen/UI-label questions into Process Intelligence
- **Description:** On the **Resources / "Who participates in this project?"** screen, asking Isabella
  *"explícame qué significa member está unassigned"* / *"qué significa unassigned"* returned the
  **Daily Project Diagnosis** (tasks without owner, project status, milestones, daily focus) instead of
  explaining the **UI label**. Separately, *"Explain this screen"* explained the **Open Projects** list
  instead of the Resources participants screen (stale/wrong screen context).
- **Observed:** Two independent defects.
  1. **Routing.** `classifyIsabellaIntent` has no category for UI-meaning questions, so
     *"qué significa …"* fell through to the `project_status_question` **default** →
     `daily_diagnosis`. With `ISABELLA_PROCESS_INTELLIGENCE_ENABLED` on, that rendered the Daily
     Diagnosis for a question about a table column. The runtime also never conveyed screen context to
     the router.
  2. **Stale screen.** The project participants screen (`/projects/{id}/team`) had **no entry** in the
     Screen Intelligence registry (`src/lib/knowledge-os/screens.ts`), so `resolveScreen` fell through
     to the `/projects` prefix and resolved the generic **Projects list** — so "Explain this screen"
     described "Open Projects".
- **Expected:** A question about the **visible screen, its columns/buttons, or a UI term** (Unassigned,
  Member, Permission, Access) is answered from **screen context**, never from Daily Diagnosis /
  Root Cause / Recommendation. **Domain distinction:** on Resources, *"Unassigned"* = a **project role
  slot with no person assigned yet** ("Role missing assignment"); on a task/Workboard screen,
  *"unassigned"* = a **task with no owner**. These are never conflated. When screen context is
  missing/ambiguous, Isabella asks a safe clarification instead of guessing another screen, and such an
  answer is **never presented as "Verified 100%"**.
- **Impact:** High — Isabella gives a confidently-wrong, off-topic answer to a basic "what does this
  mean?" question, and describes the wrong screen. Erodes trust in the assistant. **Severity:** High (P0).
- **Root cause:** (1) **missing high-priority route** — UI/screen questions had no classification and
  defaulted into the status/diagnosis engine; (2) **incomplete screen registry** — the participants
  screen was unmapped, so screen resolution silently degraded to the Projects list.
- **Status: RESOLVED (2026-07-07).** Fix:
  - **New `screen_context_explanation` route** with **highest priority** in `routeIsabellaQuestion`
    (runs BEFORE `mixed`, `daily_diagnosis`, `root_cause`, `recommendation`, and the factual/RAG
    fallback). UI/screen questions can never reach an engine.
  - **Deterministic content module** `src/lib/isabella/screen-help/` — bilingual explanations of the
    Resources participants screen + its columns, and the **domain-distinct** meaning of "Unassigned"
    (role slot vs task owner). Unknown/ambiguous screen → safe clarification, `confident:false` →
    the wiring returns a non-verified tier (never "Verified 100%").
  - **Registry entry** for `/projects/{id}/team` (`project_team` / `project_participants`) with the real
    columns (Member, Type, Role/Delivery/Governance, Permission, Access) and add-participant actions, so
    "Explain this screen" resolves the participants screen — not the Projects list.
  - **Classifier widened** so *"qué debería revisar primero"* → `recommendation` and *"cómo agrego …"* →
    `product_help` (how-to) rather than the diagnosis default. Tool-use gateway prompt also guards
    UI-label questions away from `get_daily_diagnosis`.
  - Files: `src/lib/isabella/screen-help/screen-help.ts` (+ `index.ts`),
    `src/lib/isabella/process-intelligence-runtime/{router.ts,runtime.ts,types.ts}`,
    `src/lib/isabella/process-intelligence/intent-contract.ts`, `src/lib/isabella/tools/gateway.ts`,
    `src/lib/knowledge-os/screens.ts`. Tests:
    `src/lib/isabella/screen-help/__tests__/screen-help.test.ts`,
    `src/lib/isabella/process-intelligence-runtime/__tests__/{router,runtime}.test.ts`,
    `src/lib/knowledge-os/__tests__/screens-participants.test.ts`.
- **Protection rule (binding):** **Screen/UI questions are answered from screen context, never from the
  process-intelligence engines.** A UI-label or "explain this screen" question that routes to Daily
  Diagnosis (or describes a different screen than the active one) is a regression. Resources "Unassigned"
  (role slot) and task-owner "unassigned" must stay distinct. Missing/stale screen context → safe
  clarification, never "Verified 100%". Related: [REG-013](#reg-013), [REG-014],
  [UX-001](32-product-ux-contracts.md), [No silent regressions rule].
- **Owner:** Product/Engineering. **Verify:** on Resources, ask "qué significa unassigned" → role-slot
  explanation (no Daily Diagnosis); ask "Explain this screen" → participants screen (not Open Projects);
  on a task, ask "owner unassigned?" → task-owner explanation.

---

## REG-020 — Isabella's intent default routes every unclassified question to Daily Diagnosis
- **Description:** With `ISABELLA_PROCESS_INTELLIGENCE_ENABLED` on, a **knowledge / "how it works"**
  question that is NOT about the visible screen — e.g. *"¿cómo funciona el Living Graph?"*,
  *"how does the Workboard work?"*, *"¿qué es el Execution Map?"* — returned the **Daily Project
  Diagnosis** (project briefing) instead of a product-knowledge answer.
- **Observed:** This is the second half of [REG-019](#reg-019). REG-019 added the high-priority
  `screen_context_explanation` route, which only catches questions about the *active screen*
  ("qué significa …", "explain this screen"). A general knowledge question does **not** match that
  route, so it reached `classifyIsabellaIntent` — whose **final default was `project_status_question`**
  (`intent-contract.ts`), which the router maps to `daily_diagnosis`. So every unclassified question
  still fell into the diagnosis engine. Two related classifier gaps compounded it:
  1. `RE_NAV` did not recognize "how it works / what is / para qué sirve / explain / what does … do".
  2. `RE_ROOT_CAUSE` matched **any** "why / por qué", so *"¿por qué se llama Living Graph?"* was
     misrouted to the (future) Root Cause engine instead of the Knowledge OS.
- **Expected:** The **conservative default is the Knowledge OS (RAG / `product_help`)**, not an engine.
  A knowledge/how-to/what-is question is answered from product knowledge; only genuine status/attention
  asks ("cómo va el proyecto", "what needs attention", "what is happening today") route to Daily
  Diagnosis, and only a *why-about-a-problem* ("why is this milestone delayed/blocked?") routes to
  Root Cause. Isabella must never answer "how does X work?" with the project briefing.
- **Impact:** High — with Process Intelligence enabled, ordinary product questions get a confidently
  off-topic project briefing; the app-screens Knowledge OS corpus is never consulted. **Severity:** High (P0).
- **Root cause:** the intent classifier's **fallback category** was an engine-bound status question, and
  `RE_NAV`/`RE_ROOT_CAUSE` were too narrow/too broad respectively. Fixing the screen route (REG-019) did
  not change the default for non-screen questions.
- **Status: RESOLVED (2026-07-07).** Fix (`src/lib/isabella/process-intelligence/intent-contract.ts`):
  - **Fallback flipped** from `project_status_question` → **`navigation_or_how_to`** (→ Knowledge OS).
  - **`RE_NAV` widened** (bilingual) to cover *cómo funciona / how does … work / qué es / what is /
    para qué sirve / explica / explain / qué hace / what does … do*, with negative lookaheads so
    *"what is happening/going"* stays a status ask.
  - **`RE_STATUS` widened** to explicitly catch the daily-status phrasings that previously relied on the
    default (*what is happening / qué está pasando / what needs attention / qué necesita atención*), so
    flipping the default causes **no regression** to Daily Diagnosis.
  - **`RE_ROOT_CAUSE` narrowed** to *why/por qué + a problem word* (delay/blocked/stuck/at-risk/…) so a
    naming question ("¿por qué se llama …?") is knowledge, not root cause.
  - The classification **order is unchanged** (report → root-cause → recommend → diagnosis → nav → status
    → default); only the regexes and the default category changed.
- **Protection rule (binding):** **The conservative default for an unclassified Isabella question is the
  Knowledge OS (`navigation_or_how_to` / `product_help`), never a Process-Intelligence engine.** A
  knowledge/"how it works"/"what is" question that routes to Daily Diagnosis (or a "why is it called X"
  that routes to Root Cause) is a regression. Genuine status/attention asks must still reach Daily
  Diagnosis. Guard id **ISABELLA-INTENT-FALLBACK-TO-KNOWLEDGE**. Related: [REG-019](#reg-019),
  [REG-013](#reg-013), ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION, [No silent regressions rule].
- **Owner:** Product/Engineering. **Verify:** with Process Intelligence on, ask "¿cómo funciona el Living
  Graph?" / "how does the Workboard work?" / "¿qué es el Execution Map?" → product-knowledge answer
  (not the Daily Diagnosis); ask "cómo va el proyecto" / "what needs attention" → Daily Diagnosis
  (no regression); ask "¿por qué se llama Living Graph?" → knowledge, not Root Cause.

---

## REG-021 — Knowledge OS retrieval: screen context drowns the question; vector threshold drops cross-language matches
- **Description:** Asking Isabella *"explícame el bottleneck view"* from the **Projects list** returned
  "No tengo una respuesta verificada…" (AI suggestion · 20%) although the corpus contains
  `screen-living-graph-view-bottleneck` fully embedded (`index_status=completed`).
- **Observed:** The `knowledge_answers` record for the real ask shows 8 retrieved chunks — **none of
  them the bottleneck sheet** (projects-list/settings/charter/import ranked instead) and **every chunk
  with `similarity: null`** (vector half empty). Two independent retrieval defects:
  1. **Query dilution (lexical half).** `buildRetrievalQuery` blends the question with screen context
     (module/screen/pageTitle → "… Projects projects projects list"), and that blended string fed the
     LEXICAL ranking. Context words outranked the actual topic, so the correct sheet fell out of the
     top-8. With the raw question, the same sheet ranks lexical **1.0 (#1)**.
  2. **Vector threshold too strict.** The correct sheet is the **top vector match** for the raw
     question at similarity **≈0.53**, but the hardcoded threshold was **0.6** → the vector half
     returned nothing (cross-language ES question ↔ EN chunk lowers cosine).
  With only irrelevant passages, the LLM honestly answered `grounded:false` — correct behavior given
  wrong retrieval.
- **Expected:** A specific question about screen X asked from screen Y retrieves screen X's sheet. The
  user's actual words always dominate ranking; ambient screen context is a weak prior, never a
  substitute topic. Legitimate cross-language matches are not silently filtered out.
- **Impact:** High — Isabella "can't answer" questions the corpus covers whenever the user asks from a
  different screen, eroding trust in the whole app-screens corpus investment. **Severity:** High (P1).
- **Root cause:** one blended query string served both retrieval halves (context pollution), plus an
  uncalibrated vector similarity threshold.
- **Status: RESOLVED (2026-07-07).** Fix (`src/lib/knowledge-os/retrieval.ts` + `service.ts`):
  - `RetrieveOptions.lexicalQuery` — the LEXICAL half now ranks by the user's **raw question**
    (`input.query`), falling back to the blended query only when the raw one is empty
    (vague/intent-only asks). The blended query stays on the VECTOR half, where the embedding absorbs
    context gracefully.
  - Default vector threshold **0.6 → 0.45** (measured: correct ES↔EN match ≈0.53). RRF fusion + the
    LLM grounding gate handle precision downstream; the threshold only needs to cut noise.
- **Protection rule (binding):** **The user's raw question drives lexical ranking; blended screen
  context must never displace the asked topic. The vector threshold must admit legitimate
  cross-language matches (≤0.5 band).** A specific screen question that retrieves the CURRENT screen's
  sheets instead of the ASKED screen's sheet is a regression. Guard id
  **KNOWLEDGE-OS-RETRIEVAL-QUERY-DILUTION**. Related: [REG-020](#reg-020) (routing default),
  the multilingual retrieval fix (retrieval.ts header), Knowledge OS (doc 16).
- **Owner:** Product/Engineering. **Verify:** from the Projects list, ask "explícame el bottleneck
  view" → grounded answer citing `screen-living-graph-view-bottleneck` (not "no verified answer").

---

## REG-022 — Admin Console "View users" always empty; user emails unreadable

- **Reported:** 2026-07-08 (verified directly against prod: org XXX `dc8205c1-…` has 10
  valid members yet the drill-down showed "No users in this company"; EMAIL column always "—").
- **Symptom:** Expanding any company in the Admin Console → Companies tab returned zero
  users; every email column across the console rendered "—".
- **Root cause (two, same theme — the auth schema is not reachable from PostgREST):**
  1. `getUsersByCompany` used the embed `profiles!organization_members_user_id_fkey(...)`,
     but `organization_members.user_id` references **`auth.users`**, NOT `profiles` — the
     named FK does not point where the embed assumes, PostgREST errors, and the code
     degraded to `[]`.
  2. `fetchEmailsById` queried `.from("auth.users")` — PostgREST does not expose the
     `auth` schema via `.from()` even to the service role, so emails always came back empty.
- **Status: RESOLVED (2026-07-08).** Fix (migrations `20260841`/`20260842` + `queries.ts`):
  reads that need `auth.users` moved INSIDE the database as `SECURITY DEFINER` RPCs gated
  by `service_role OR is_platform_admin()` (active row in `admin_authorized_users`):
  `admin_list_company_users(p_org_id)` (members + profile + email + org_role/status) and
  `admin_get_user_emails(p_user_ids)` (batch owner emails). Business-table RLS was NOT
  widened.
- **Protection rule (binding):** **Admin Console reads that involve `auth.users` (member
  lists, emails) must go through the gated admin RPCs — never a PostgREST embed on
  `organization_members → profiles` and never `.from("auth.users")`.** A company with
  members whose drill-down renders empty is a regression.
- **Owner:** Product/Engineering. **Verify:** as a platform admin, expand XXX
  (`dc8205c1-…`) in Companies → 10 users listed, each with email.

---

### Resolved
*(none fully closed yet — REG-004/005 partially resolved; keep open until depth/vision shipped.)*
