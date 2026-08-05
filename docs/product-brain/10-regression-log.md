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

## REG-023 — Isabella cannot answer basic project-status and risk questions (query-engine hijack)
- **Description:** P0 capability regression (2026-07-09, reported by voice and text): *"necesito un
  resumen del proyecto, ¿cuáles son los posibles riesgos que tengo hoy?"* answered with *"solo puedo
  generar reportes sobre las tareas…"* although every needed engine (REG-013 briefing, risks register,
  Process Intelligence, RAG) already existed and had the data.
- **Root cause (routing, not capability):** the generic query engine's parser resolves FUTURE entity
  aliases ("riesgos", "hitos", "decisiones"…) into a plan, but the task adapter executes ONLY
  `entity === "task"` and returned the hardcoded `unsupported_entity` message
  (`query-engine/task-adapter.ts`). Because that deterministic path answered FIRST in
  `askLivingGuideAction`, Process Intelligence, the briefing engine and RAG never ran. Multi-intent
  questions (summary + risks) had no goal planner. Verified in prod `ai_runs` and in code.
- **Status: RESOLVED (2026-07-09).** Fix (`src/lib/isabella/executive-brief/*`,
  `components/living-guide/actions.ts`, tool registry):
  1. **Executive Brief gateway** runs FIRST for detected PM goals (`project_summary` /
     `risk_outlook` — bilingual, cue-based, multi-intent): answers deterministically from the
     REG-013 briefing engine + the risks register, with `registeredRisks` strictly separated from
     `detectedRiskSignals` and honest `dataGaps`; RBAC/tenant scope via the REG-013 gate; audited in
     `ai_runs` (`model: isabella-executive-brief`, detectedGoals/tools/latency/counts).
  2. **Non-task query plans no longer dead-end:** only `entity === "task"` runs the task adapter;
     other entities fall through to Process Intelligence / RAG.
  3. **Composite tools** `get_project_executive_brief` / `get_project_risk_outlook` registered in
     the tool loop over the SAME service — one brain for text, voice and the LLM loop.
- **Protection rule (binding):** **A deterministic short-circuit may only RETURN an answer for an
  entity/intent it can actually execute; anything else must fall through to the next pipeline
  layer.** "Solo puedo generar reportes de tareas" (or equivalent) reaching a user whose question
  the platform CAN answer is this regression returning. Registered risks and detected/inferred
  signals must never be merged. Guard id **ISABELLA-EXECUTIVE-BRIEF**. Related: [REG-013](#reg-013),
  [REG-020](#reg-020), ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE, ISABELLA-VOICE-REALTIME-BRIDGE.
- **Owner:** Product/Engineering. **Verify:** inside a project ask (voice or text) *"dame un resumen
  del proyecto y los riesgos de hoy"* → one grounded executive answer with real counts, registered
  risks and detected operational signals — never the task-only phrase.

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

## REG-038 — Task Report Builder returned 0 rows when a second filter was added

- **Reported:** 2026-07-27. In the Task Execution report, `Project = Agro*` returned
  rows, but adding `Responsable = Paul*` returned an empty report — even though 12
  tasks in the Agro* projects are assigned to Paul.
- **Root cause (two independent defects, both required to see rows):**
  1. **Owner never resolved.** `fetchTaskExecution` built its assignee lookup with
     `profiles.select().eq("organization_id", ctx.organizationId)`. A profile's
     `organization_id` is the person's **home** org, not every org they work in.
     Paul's home org differs from the Agro* projects' org, so he fell out of the
     map and every one of his tasks carried `owner: ""`. Any Owner filter then
     matched nothing — the Project filter looked fine only because project names
     are resolved from a different (correct) lookup.
  2. **Wildcards compared literally.** `Paul*` was matched with `===`, so even a
     correctly resolved "Paul Reyes" would not have matched. There is no SQL here
     (filters run in memory over curated rows), so `ILIKE` had no equivalent.
  3. **Accent-sensitive matching** — surfaced during acceptance once 1 and 2 were
     fixed. `Proyecto = mobil*` returned 29 rows, but adding `Responsable =
     Sofia*` returned 0: the stored name is `Sofía Gómez (Dev)`. Nobody types
     diacritics into a filter box, and in a Spanish-language product a report
     that silently empties over one accent reads as the same defect.
- **Status: RESOLVED / PROTECTED (2026-07-27).** Owner names are now resolved from
  the assignee ids actually referenced by the already-org-scoped tasks
  (`.in("id", ownerIds)`), which also shrinks the query. Text filters compile `*`
  and `?` into an anchored pattern — the in-memory equivalent of `ILIKE` — with
  regex metacharacters escaped, and both sides are compared case- **and
  accent-insensitively** (NFD fold), so `Sofia*` finds `Sofía Gómez`. Filters are
  compiled once per report instead of per row, so combining filters stays linear.
- **Protection rule (binding):** **A display name shown in a report must be
  resolved from the ids the scoped rows reference, never by re-filtering the
  lookup table on `organization_id`.** Org isolation comes from the rows being
  scoped, not from the name lookup; re-scoping the lookup silently blanks
  multi-org people and turns a filter into a silent empty result. A filter that
  cannot be satisfied must return no rows *because the data says so*, never
  because a column was never populated. Guard id **REPORT-OWNER-ID-RESOLUTION**.
- **AND/OR semantics (recorded decision):** filters AND across different columns;
  repeating a membership filter (`=` / `is one of`) on the **same** column ORs
  those values. This carries forward the semantics from
  `codex/report-filter-or-wildcards` rather than forking it.
- **Owner:** Product/Engineering. **Verify:**
  `src/lib/reports/__tests__/task-report-owner-resolution.test.ts` (fails if the
  profile lookup goes back to `organization_id`) ·
  `src/lib/reports/__tests__/task-report-filters.test.ts` (wildcards, 1/2/3+
  filter combinations, numeric and percentage filters, AND/OR, empty results).
  Live check against DEV data:
  `REPORT_FILTERS_VERIFY=1 npx vitest run src/lib/reports/__tests__/task-report-filters.live.test.ts`.

---

## REG-024 — Supabase email confirmation callback rewritten to a missing locale route

- **Reported:** 2026-07-19. Confirmation email opened `/auth/callback?code=...` and production
  returned `404`.
- **Root cause:** the route handler intentionally lives outside `[locale]`, but next-intl middleware
  rewrote it to `/en/auth/callback`; only landing and Navigator were bypassed.
- **Status: RESOLVED.** All non-localized app routes are centralized in
  `src/lib/i18n/unlocalized-paths.ts`; middleware bypasses them before next-intl and Auth session
  handling.
- **Protection rule:** `/auth/callback` must never be localized. CI protects the registry and the
  production workflow smokes an invalid callback code, which must redirect instead of returning 404.

---

## REG-025 — Landing pricing diverged from the plan catalog

- **Reported:** 2026-07-19. Landing displayed Personal `$0`, Team `$29` and Business `$99` while
  production `plans` contained Personal `$9`, Team `$16` and Business `$29`.
- **Root cause:** prices were duplicated in EN/ES translation JSON and rendered independently from
  the billing tables.
- **Status: RESOLVED.** Landing reads active plan commercial values from `public.plans`; translation
  files contain presentation copy only. Personal is monthly individual billing, Team and Business
  are monthly per-user billing, and Enterprise is custom.
- **Protection rule:** no price or currency literal may be added to landing translations/components;
  changes to the plan table are the only supported commercial update path.

---

## REG-026 — Imported milestone order corrupted between analysis and execution

- **Reported:** 2026-07-20. A Budget & Cost Management project showed P6 before
  P0 in the Living Graph although the approved JSON listed P0 through P9.
- **Root cause:** `project_import_entities` was bulk inserted in canonical order,
  then read for execution without `ORDER BY`. PostgreSQL row-return order is
  undefined, and `executeImport` assigned `milestones.order_index` in that
  arbitrary order. The Living Graph correctly rendered the corrupted
  `order_index`.
- **Status: RESOLVED / PROTECTED (2026-07-21).** Import analysis now persists a
  unique zero-based `source_order`; execution queries and the canonical rebuild
  both sort by it. A partial unique index prevents duplicate ordinals.
- **Protection rule (binding):** imported ordered entities must carry an
  explicit source ordinal across persistence. Database return order, UUIDs,
  timestamps and visual node position are never business order. Guard id
  **IMPORT-ENTITY-SOURCE-ORDER**.
- **Owner:** Product/Engineering. **Verify:**
  `src/lib/import-intelligence/__tests__/execute-order.test.ts` supplies shuffled
  entity rows and must still produce P0, P1, P2, P6. Operational procedure:
  [Import Order Integrity](import-order-integrity.md).

---

## REG-039 — Boolean report filter rejected as invalid without being touched

- **Reported:** 2026-07-28. In the Task Report Builder, adding `En ruta crítica =
  true` produced "Uno o más filtros no son válidos" and refused to run, although
  the user had picked the column and the value shown was `true`.
- **Root cause:** the builder seeded every new filter with `value: ""`,
  regardless of column type, and the boolean editor is a `<select>` with only
  `true`/`false` options. With `""` in state, no option matched, so the browser
  fell back to rendering the first one — `true` — while the report config still
  carried `""`. Server-side validation then correctly rejected it for having no
  value. The control displayed a state the configuration did not hold.
- **Status: RESOLVED / PROTECTED (2026-07-28).** New filters start from
  `defaultFilterValue(type, operator)`: `true` for booleans, `["", ""]` for range
  operators, `""` where the user genuinely must type something. The boolean
  select now derives its rendered option from the stored value instead of
  falling back. Switching column or operator re-seeds the value the same way, so
  a boolean can never be left holding `""` nor a range holding a scalar.
  Validation errors also carry a `code` + `columnLabel`, and the builder
  validates live: it names the filter that is incomplete ("Escribe un valor para
  «Nombre de la tarea»") next to that row instead of failing with a generic
  message after Run. Half-filled ranges are now caught too.
- **Protection rule (binding):** **a form control must never display a value the
  configuration does not hold.** Any editor without an empty state (select,
  toggle, radio) must be seeded with a valid value when the field is created or
  its type changes — otherwise the UI shows a complete filter that the server
  rightly rejects. Validation must name the offending field in the user's
  language, never a generic "one or more filters are invalid". Guard id
  **REPORT-FILTER-DEFAULT-VALUE**.
- **Owner:** Product/Engineering. **Verify:**
  `src/lib/reports/__tests__/task-report-filter-defaults.test.ts` — a freshly
  added boolean filter must validate untouched; removing the boolean default
  fails six tests.

---

### Resolved
*(none fully closed yet — REG-004/005 partially resolved; keep open until depth/vision shipped.)*

---

## REG-032 — Los motores genéricos quedaron ciegos a datos que sí existían

**Fecha:** 2026-07-26 · **Estado:** cerrada · **Guards:** `PMO-SIM-EVM-SOURCE`,
`IMPORT-TASK-HOURS-BOTH-FIELDS`, `IMPORT-PROJECT-TYPE-WORD-BOUNDARY`

Tres defectos con la misma forma: el dato estaba en la base y el consumidor no lo
leía. Ninguno producía un error — producían una respuesta plausible y menos
informada, que es el modo de fallo más difícil de notar.

| # | Defecto | Efecto |
|---|---|---|
| 1 | `financial_measurement_snapshots` guarda BAC/PV/EV/AC; el read model de simulación forzaba `ev: null` con un comentario que decía "EV no tiene fuente en este esquema" | Todo pronóstico EVM reportaba "unavailable" para proyectos con medición válida |
| 2 | La importación escribía las horas solo en `estimated_labor_hours` | La estimación quedaba invisible para CPM, capacidad genérica, process mining e Isabella; en un proyecto de software se perdía del todo |
| 3 | El clasificador de tipo de proyecto comparaba palabras clave como subcadena, y `"ia"` (dos letras) vive dentro de *ingeniería*, *licencia*, *garantía* | Planes de infraestructura en español se clasificaban como `ai_native_execution`, lo que decide qué módulos recibe el proyecto |

**Causa raíz común:** el comentario de (1) fue cierto cuando se escribió y dejó de
serlo cuando el módulo financiero añadió la tabla. Nadie volvió. (2) y (3) nunca
se ejercitaron contra datos reales en español.

**Cómo se encontraron:** recorriendo el flujo completo contra un proyecto real
—importar, simular, leer las filas de vuelta— no inspeccionando el código. La
lectura del código no los habría encontrado porque todos parecen correctos.

**Regla de protección:** al leer un dominio, verificar contra el esquema vigente
que la fuente sigue ausente antes de codificar `null`. Un comentario que afirma
que un dato no existe es una aserción con fecha de caducidad, no un hecho.

---

## REG-033 — Trabajo guardado que no se podía recuperar

**Fecha:** 2026-07-26 · **Estado:** cerrada · **Guards:**
`PMO-SIM-MULTIPLE-SCENARIOS`, `PMO-SIM-NO-SILENT-DROP`, `PMO-SIM-NO-RAW-ERROR-CODES`,
`ACRONYM-GLOSSARY-REACHABLE`

Cuatro defectos de alcanzabilidad en la misma superficie:

1. **Escenarios guardados inaccesibles.** `listScenarios` y `getLastResult`
   existían en el servidor, las tablas guardaban las filas, y la interfaz nunca
   los pedía. "Guardar" escribía un escenario que no se podía reabrir jamás.
2. **Una sola simulación.** Editar, Re-ejecutar, Duplicar y Borrar volvían todos
   al mismo escenario. Comparar opciones es la actividad completa de un what-if.
3. **Intervención descartada en silencio.** Una intervención sin objetivo la
   elimina el parser; la corrida seguía y reportaba un resultado calculado sobre
   cero intervenciones mientras el formulario mostraba una.
4. **Acrónimos inalcanzables.** Solo se llegaba a una definición teniendo ya el
   número en pantalla, lo que exigía construir y ejecutar un escenario.

**Causa raíz común:** cada pieza funcionaba aislada y ninguna era alcanzable por
el camino que un usuario recorre de verdad.

**Regla de protección:** una capacidad no está terminada cuando su lógica pasa
sus tests, sino cuando existe un camino desde la pantalla hasta ella. Si una
acción de servidor no tiene consumidor, o un dato guardado no tiene lector, eso
es un defecto y no una función pendiente.

---

## REG-027 — A replaced view kept its definition and lost its grants

**Date:** 2026-07-26 · **Status:** closed · **Guard:** `EKI-VIEW-REGRANT`

`create or replace view` cannot rename or reorder columns, so the EKI scope
migration dropped the view and recreated it. Dropping a view discards its grants.
The recreated view was correct and unreadable: every `authenticated` caller lost
`select`, and the failure surfaces as an empty screen, not as an error.

**Root cause:** the drop was treated as a syntactic workaround for a Postgres
restriction rather than as a change of ownership state. Only the definition was
carried across.

**Protection rule (binding):** a migration that drops a view must restore its
grants in the same migration. Every `drop view` needs a matching `grant` — the
test enumerates the drops and requires a regrant for each, so a new drop cannot
be added without one.

**Verify:** `src/lib/eki-evidence/__tests__/migration-contract.test.ts` →
"a replaced view must keep its grants".

---

## REG-028 — Array append written as concatenation with a literal

**Date:** 2026-07-26 · **Status:** closed · **Guard:** `EKI-ARRAY-APPEND`

`failures := failures || 'no_fresh_evidence'` parses the right-hand side as an
array *literal*, not as an element, and raises `22P02: malformed array literal`
at runtime. It appeared in five places in the control gate — the exact code path
that runs when a control is failing, so the error only fired when something was
already wrong.

**Root cause:** `||` is overloaded for arrays and reads as "append" to anyone who
has written it in another language. The ambiguity is invisible in review.

**Protection rule (binding):** accumulate into a `text[]` with `array_append`.
No `x := x || 'literal'` in any migration.

**Verify:** `src/lib/eki-evidence/__tests__/migration-contract.test.ts` →
"array append must not be written as concatenation with a literal".

---

## REG-029 — Transaction time used where statement time was meant

**Date:** 2026-07-26 · **Status:** closed · **Guard:** `EKI-CLOCK-TIMESTAMP`

`now()` is the **transaction** timestamp. It broke the engine twice:

1. Two evaluations written in one transaction received an identical
   `evaluated_at`. `order by evaluated_at desc limit 1` became non-deterministic,
   the engine read a stale evaluation as the latest one, and **a control could
   never reach `operating`** — the single state the whole programme exists to
   establish.
2. Freshness measured as `now() - latest_evidence` compared against an
   increasingly wrong "now" inside a long transaction, so evidence that aged
   during the transaction was reported as current.

**Root cause:** `now()` is the default reflex and is correct for "when did this
unit of work happen". It is wrong for "when did this measurement happen" and for
"how old is this evidence".

**Found by:** running the end-to-end flow against a real database. Invisible in
review — both spellings look right.

**Protection rule (binding):** evaluation and freshness use `clock_timestamp()`.
"Latest" is resolved by the `sequence_no` identity column, never by a timestamp
alone, in SQL and in the repository.

**Verify:** `src/lib/eki-evidence/__tests__/migration-contract.test.ts` →
"evaluation time is statement time, not transaction time" ·
`src/lib/eki-evidence/__tests__/repository.test.ts` → "resolves the latest
evaluation by sequence, not by timestamp".

---

## REG-030 — A shared trigger referenced a column not present on every table it served

**Date:** 2026-07-26 · **Status:** closed · **Guard:** `EKI-TRIGGER-BRANCH-SCOPE`

One audit trigger function serves `project_knowledge_objects`,
`project_knowledge_object_transitions` and `project_knowledge_relations`.
Resolving the actor type with a shared expression over `new.knowledge_type`
raised `42703: record "new" has no field "knowledge_type"` on the two tables that
lack the column — including the branch that never needed it.

**Root cause:** PL/pgSQL resolves `new.<column>` when the statement executes, not
when the branch is taken, so an expression outside the per-table branch runs for
every table.

**Protection rule (binding):** in a trigger shared across tables, read
table-specific columns only inside the `TG_TABLE_NAME` branch for that table.
Declarations and shared expressions use variables with safe defaults.

**Verify:** `src/lib/eki-evidence/__tests__/migration-contract.test.ts` →
"reads table-specific columns only inside their own branch".

---

## REG-031 — A denial rolled back the record that proved it happened

**Date:** 2026-07-26 · **Status:** closed · **Guard:** `EKI-DENIAL-RETURNED`

`eki_resolve_finding` wrote an `access_denied` audit record and then `RAISE`d to
reject the caller. The exception rolled back the audit insert made in the same
transaction, so the refusal left no trace. The system logged only its successes
and could not demonstrate that it refuses anything — which is precisely the claim
an auditor tests.

**Found by:** the acceptance run reporting `17b_denegacion_auditada = false` while
every functional step passed. The engine worked; its evidence of working did not
exist.

**Protection rule (binding):** an authorization denial that must be audited is
**returned** as `{authorized: false, reason}`, never raised. Nothing is mutated on
the denied path. The service layer converts the denial into an error for the
caller, after the record exists.

**Verify:** `src/lib/eki-evidence/__tests__/migration-contract.test.ts` →
"a denial must be returned, never raised" ·
`src/lib/eki-evidence/__tests__/service.test.ts` → "turns a database denial into
an error without inventing a success" · real-database:
`supabase/tests/eki_macrophase2_acceptance.sql` step 17.

---

## REG-034 — A refusal by an actor with no role could not be recorded

**Date:** 2026-07-27 · **Status:** closed · **Guard:** `EKI-ACTOR-ROLE-NONE`

`eki_resolve_finding`, `eki_assign_owner` and `eki_request_evaluation` all write
an `access_denied` record with `coalesce(actor_role, 'none')` before returning
the denial. `platform_governance_audit.actor_role` admitted owner / admin /
member / viewer / service and nothing else, so the insert violated its check
constraint, the exception propagated, and **both** the audit record and the
caller's answer were lost.

**Root cause:** the vocabulary could not express "no role". An actor with no
standing in the organization is the most important denial there is, and it was
the one the audit was structurally unable to record.

**Why Macrophase 2 did not catch it:** its acceptance test used a *member without
authority*. The role was `member`, the constraint was satisfied, and the branch
that produces `none` was never executed. The test passed for a case adjacent to
the one that mattered — the third time this programme has hit that shape
(Macrophase 1 probe 11, Macrophase 2 step 17).

**Protection rule (binding):** `actor_role` admits `none`, and `none` is denied
**every** operation in `src/lib/platform-governance/security.ts`, reads included.
Widening the vocabulary grants nothing. A denial path must be exercised by an
actor with genuinely no standing, not by a low-privilege member.

**Verify:** `src/lib/platform-governance/__tests__/governance-audit.test.ts` →
"REG-034 — an actor with no role" ·
`src/lib/eki-evidence/__tests__/automation-migration-contract.test.ts` →
"REG-034" · real database: `supabase/tests/eki_macrophase3_acceptance.sql`
steps 10-11.

---

## REG-035 — The trust question classifier declined its own vocabulary

**Date:** 2026-07-27 · **Status:** closed · **Guard:** `EKI-TRUST-QUESTION-ROUTING`

The Enterprise Trust subject gate was written `\b(control|finding|evidence|…)\b`.
`\bcontrol\b` does not match "controls" or "controles"; `\bfinding\b` does not
match "findings". Nearly every real question — "Which controls are degraded?",
"¿Qué controles están degradados?", "Which findings are open?" — failed the gate
and fell through to RAG, which answered a live-state governance question from a
document corpus.

**Root cause:** word-boundary anchors written against the singular English stem,
in a product that must answer in English and Spanish.

**Why it looked fine:** the failure produced a *plausible* answer from the
retrieval corpus rather than an error. Nothing surfaced; the answer was simply
stale and unattributed.

**Protection rule (binding):** the trust subject gate matches plural and Spanish
inflections explicitly, and a routing test asserts every question listed in the
Macrophase 3 scope in both languages. A governance question about current state
must never be answerable from the corpus.

**Verify:** `src/lib/isabella/enterprise-trust/__tests__/trust-reasoning.test.ts`
→ "question classification".

---

## REG-036 — Macrophase 3 functions were executable by `anon` and `authenticated`

**Date:** 2026-07-27 · **Status:** closed · **Guard:** `EKI-FUNCTION-EXECUTE-REVOKED`

PostgreSQL grants `EXECUTE` to `PUBLIC` by default on `CREATE FUNCTION`, and
`anon` and `authenticated` inherit it. Macrophases 1 and 2 revoked explicitly.
Macrophase 3 did not, so all eight functions it added were callable through
PostgREST.

For the write paths this was contained: `auth.role() <> 'service_role'` fires for
both roles and the call raises. **For the read path it was not.**

`eki_resolve_privileged_access_activity` is `SECURITY DEFINER` and had no
service-role guard, because it is a resolver invoked from inside the engine. With
`PUBLIC` execute, any caller could name an **arbitrary organization id** and read
that tenant's privileged-access profile: record count, timestamp of the most
recent privileged change, and contradiction count.

**Confirmed in stage, not inferred.** As `authenticated` with a JWT belonging to
no member of the target organization:

| Path | Result |
|---|---|
| `select count(*) from audit_logs where organization_id = <other tenant>` | **0** (RLS) |
| `eki_resolve_privileged_access_activity(<other tenant>, …)` | **31**, plus the exact `latest_evidence_at` |

Reachable as `anon` as well, so a publishable key and no session were enough.

**Root cause:** the default grant. Not a missing check — a missing *revoke*, which
is invisible in a diff because the dangerous state is the one nobody wrote down.

**Why it was found:** the final review asked precisely which caller reaches
`auth.role() IS NULL`. Answering that required enumerating who can execute these
functions at all, which surfaced a disclosure that has nothing to do with NULL
roles. The NULL question was the right question for the wrong reason.

**Protection rule (binding):** every `SECURITY DEFINER` function in the EKI
namespace must be revoked from `public, anon, authenticated` in the same
migration that creates it. A resolver that reads across RLS must additionally
carry a service-role guard, so a grant restored later cannot silently reopen the
disclosure. The revoke is the control; the guard is defence in depth.

**Verify:** `src/lib/eki-evidence/__tests__/automation-migration-contract.test.ts`
→ "REG-036". The guard discovers EKI migrations from disk rather than from a
hard-coded list, and was negative-controlled: with the fix migration removed it
names all seven unprotected functions.

---

## REG-037 — TRUNCATE left granted to `anon` and `authenticated` on the EKI tables

**Date:** 2026-07-27 · **Status:** closed · **Guard:** `EKI-NO-API-WRITE-GRANTS`

Supabase grants ALL on new `public` tables to `anon` and `authenticated`.
Migrations `20260864000000` and `20260866000000` revoked only
`insert, update, delete`, and only `from authenticated`. Measured in production
immediately after the Macrophase 4 push:

| | `anon` | `authenticated` |
|---|---|---|
| All seven EKI tables | TRUNCATE | TRUNCATE |
| `eki_evaluation_runs`, `eki_evaluation_run_items` | + DELETE, INSERT, UPDATE | TRUNCATE |

The row-level grants are contained by RLS — no policy grants `anon` anything, so
a row write is refused.

**TRUNCATE is not.** It does not go through RLS and it does not fire row-level
triggers. The append-only guards on `eki_evidence_evaluations` and
`eki_control_state_transitions` are `BEFORE DELETE` triggers, so they would never
run. A holder of the publishable key could erase the immutable evidence and
transition history — the record the programme exists to make tamper-evident —
and the guards built to prevent exactly that are structurally unable to see it.

**Root cause:** the revoke enumerated the privileges that seemed relevant, and
TRUNCATE was not one of them. Enumerating what to remove is what produced the gap.

**Why it was found:** a production security probe after the migration, not
review. Every earlier check asked "can this role read another tenant's data?"
and the answer was correctly no. Nobody asked "can this role destroy the
evidence?" — RLS does not answer that question, and neither did the triggers.

**Protection rule (binding):** an EKI table grants `select` to `authenticated`
and nothing else. Revocation is written `revoke all … from anon, authenticated`
followed by an explicit re-grant — never as a list of privileges to remove, which
cannot cover a privilege nobody thought of, including any PostgreSQL adds later.

**Verify:** `src/lib/eki-evidence/__tests__/automation-migration-contract.test.ts`
→ "REG-037". Production re-probed after `20260869000000`: 8 of 8 probes pass, 0
write privileges held by any API role.

---

## REG-041 — Logged hours stopped at the subtask and never reached the task or the PM dashboard

**Date:** 2026-07-29 · **Status:** closed · **Guard:** `TIME-TRACKING-TASK-ROLLUP`

CAP-051 shipped a correct time log. Entries saved, the subtask modal showed real
hours, and `task_subtasks.actual_hours` was refreshed on every change. One level
up, nothing moved: with 11h logged across the subtasks of a task in the Valle
Norte project, `roadmap_tasks.actual_hours` was **NULL**.

Every task-level reader reads that column — the task detail page
(`tasks/[taskId]/page.tsx` → `parent.actualHours`), the execution map's parent
node, the PMO Living Graph read model. All of them showed 0h. The project
dashboard's "Effort left" card was worse than stale: it computed
`SUM(estimate_hours)` over tasks that are not `done` and never subtracted logged
time at all, so it read the untouched plan back to the PM — ~1509h on the user's
project — and could not move no matter how much time was logged.

**Root cause:** the engine refreshed the subtask cache and there was no task-level
rollup at all. `refreshSubtaskActualHours` existed; its task twin did not, and
nothing in the product ever wrote `roadmap_tasks.actual_hours`. The table was
already designed for this — `subtask_id` was deliberately made nullable so "task
level logging needs no second table later" — but only the subtask half of that
design was implemented, so time could not even be logged on a task: the schema
required `subtaskId`, and update/delete rejected any entry whose `subtask_id` was
NULL with `entry_not_found`.

**Why it was not caught:** the shipped tests asserted the arithmetic (`SUM` over
entries) and the subtask surface, both of which were right. Nothing asserted that
the sum *arrives* anywhere above the subtask. The dashboard's own effort cards
read the entries directly, so the one surface that did compute actual hours
correctly hid the fact that the cache feeding every other surface was empty.

**Protection rule (binding):** a task's actual hours are
`SUM(duration_hours) WHERE task_id = task` — one sum over both levels, never
"task hours + subtask hours", which is where double counting would enter. Both
derived caches are refreshed on every mutation, the task one **unconditionally**,
including for subtask-level entries. A task with estimated subtasks is estimated
by those subtasks and never by adding its own number on top. No surface computes
effort itself: they all call `computeTaskEffort` / `getProjectEffortSummary`.

**Verify:** `src/lib/time-tracking/__tests__/task-consolidation.test.ts` (the 14
required scenarios, including the brief's worked example: 60h estimated / 19h
actual / 41h remaining / −41h variance / 31.7% consumed) ·
`isolation-and-refresh.test.ts` (per-org scoping and revalidation on every
mutation). Migration `20260871000000` rebuilds the cache for entries written
before the rollup existed; verified on Stage — the Valle Norte task went from
NULL to 11.00h, matching its log exactly.

---

## REG-042 — The PMO dashboard threw a hydration error on every load

**Date:** 2026-07-29 · **Status:** closed · **Guard:** `PMO-IC-PANEL-HYDRATION`

The PMO Intelligence Center reported *"Hydration failed because the server
rendered text didn't match the client"* on every visit, and React discarded the
rendered tree and rebuilt it on the client. Six occurrences in one dev session
before the fix.

The left rail's collapsed state was read from `localStorage` inside a `useState`
initialiser — that is, **during render**:

```tsx
const [panels, setPanels] = useState(() => loadPanelPreferences(organizationId, userId));
```

The server has no `localStorage`, so it rendered `DEFAULT_PANEL_PREFERENCES`
(`overview: true`, rail open). A user who had collapsed the rail had
`{"overview":false}` stored, so the client rendered it closed. The two trees
disagreed on `aria-pressed` and on the button title (*"Ocultar el panorama"* vs
*"Mostrar salud del portafolio"*) — exactly what React reported.

**Root cause:** a per-user preference was treated as render-time input. It cannot
be. The server is not allowed to know it, so any value read while rendering is
guaranteed to differ from the client whenever the user has expressed a preference
at all — the bug reproduced only for users who had actually used the feature.

**Why it survived:** a green test was pinning it. `panels-and-kpi-feedback.test.ts`
asserted `expect(shell).toContain("useState(() =>")` with the comment *"Lazy
initialiser, so the panels never flash open and then collapse"* — a test
defending the defective mechanism instead of the behaviour it meant to protect.
It would have failed any correct fix, and it did.

**Protection rule (binding):** browser-only state (`localStorage`, `window`,
`matchMedia`, dates in the user's timezone) is never read during render. The
first render is the server-reproducible default; the stored value is applied
after mount in a LAYOUT effect, so it lands before the browser paints and the
no-flash behaviour the original initialiser wanted is preserved. Assertions
protect the behaviour, not the mechanism.

**Verify:** `src/lib/pmo-intelligence/__tests__/panels-and-kpi-feedback.test.ts`
→ "PMO-IC-PANEL-HYDRATION". Measured on the dashboard before and after: 6
hydration errors → 0, projection rendering normally (22 nodes, 68 edges). The
file was byte-identical to `origin/master`, so this was live in production too.

---

## REG-043 — "Whose effort" offered one person, twice

**Date:** 2026-07-30 · **Status:** closed · **Guard:** `TIME-TRACKING-PEOPLE-SOURCE`

The owner of the Agro project opened *Log time* and the picker offered exactly
two options — *Myself* and *Efrain Prada* — the same human twice, while eight
people were on the project. Two independent defects produced one symptom.

**Defect 1 — the wrong source.** The list came from
`profiles WHERE organization_id = <org>` (`getTaskFormOptionsAction`, threaded
down as `options.people`). That column is a profile's **HOME** org, not every org
they work in. Measured on the Agro organization:

| person | home org matches? |
|---|---|
| Efrain Prada | ✅ the only one |
| Cesar, Giovanna, Jose, Juan, Paul, Viveka, Yihad | ❌ seven different orgs |

So the query returned **one row**. This is the same mistake REG-038 had already
documented for report owners — the fix there was "resolve by id, never re-filter
by organization_id", and this call site never got it.

**Defect 2 — the duplicate.** The dialog rendered `<option value="">Myself</option>`
and then mapped the whole list, so whenever the caller was in it they appeared
twice as if they were two resources. That option was added with the person picker
itself, in the same change that introduced task-level logging.

**Root cause of defect 1, stated precisely:** membership was asked of the wrong
table. "Who works on this project" is `project_team_members`; `profiles` only
knows where a person's account lives.

**Fix:** membership now comes from `project_team_members` scoped by
`project_id` AND `organization_id`, excluding `status = 'removed'`, and the
caller is folded INTO that list rather than bolted on beside it — so they render
once, labelled *(Myself)*, sorted first. Names resolve by id (REG-038 rule),
emails are best-effort context. Rows without a `user_id` are excluded and
reported: `subtask_time_entries.user_id` is NOT NULL to `auth.users`, so a
login-less contact or crew has nothing storable and offering them would build a
save that always fails.

**Deliberately not done:** workspace members who are not on the project are NOT
merged in. Mixing every org user into every project is what the report asked us
to avoid; adding someone to a project stays an explicit action.

**Verify:** `src/lib/time-tracking/__tests__/people.test.ts` →
`TIME-TRACKING-PEOPLE-SOURCE` (24 assertions, built on the real Agro rows
including Paul's three roles and Efrain's removed membership). Measured against
the DEV database: the old query returns 1 row, the new source returns the 8
expected people with Paul de-duplicated.

---

## REG-044 — Microsoft Project files were refused, then refused again after being supported

**Date:** 2026-07-30 · **Status:** closed · **Guard:** `IMPORT-MPP-SANDBOX`

A customer's SAP plan (`CPVEN - Plan Tecnico SAP_v1.mpp`) could not be imported:
the wizard answered *"Tipo de archivo no soportado"*. `.mpp` is an undocumented
OLE2 binary; the only mature reader is MPXJ, which is Java, and Vercel Functions
run Node — so nothing in the product could open it.

**How it was solved.** A converter image (JRE 21 + MPXJ 16.5.0) published to the
Vercel Container Registry, run in a **Vercel Sandbox created per conversion and
destroyed after it**. Measured end to end against the real file: sandbox up in
710 ms, 50 tasks / 19 resources / 39 assignments out, 2.5 s total.

The three options were priced before choosing, because the cheap-looking one was
the expensive one:

| Option | Recurring cost | Verdict |
|---|---|---|
| Java microservice | MPXJ free (LGPL) + a host to run and pay for | a standing service to operate |
| Browser via CheerpJ | **£100/developer/month**, and MPXJ ships no supported JS build | rejected |
| **Vercel Sandbox** | pay-per-conversion, no standing host | chosen |

**The second refusal, and the real lesson.** After all of that was built and
green, the wizard still said *"Tipo de archivo no soportado"*. `.mpp` had been
added to `ImportFileType`, to the parser's switch, to the file input's `accept`
and to the conversion routing — but **not to `EXTENSION_MAP`**, the one table
`detectFileType` reads. The upload was rejected before the converter was ever
reached.

Sixteen tests covered the conversion and every one passed: egress denied, the
sandbox always released, absolute paths, error codes distinguishing a bad file
from an unavailable converter. Not one asked *"is the file accepted?"*. The
sophisticated properties were guarded and the front door was not.

**Protection rule (binding):** a new import format is not supported until
`detectFileType` returns it. Any test suite for an intake path asserts the
entry point first, then the behaviour behind it.

**Also recorded:** relative paths to `sandbox.writeFiles` fail with a bare
`400` that names nothing — paths into a sandbox are always absolute. The
uploaded file name is never one of them: it is user input, written to a fixed
`input.mpp`, and `java` is invoked directly rather than through a shell. The
sandbox runs with an empty allowlist (`networkPolicy: { allow: [] }`), which is
how this SDK spells deny-all; omitting the policy leaves egress open.

**Verify:** `src/lib/import-intelligence/__tests__/mpp-convert.test.ts`
(`IMPORT-MPP-SANDBOX`, including the three assertions that would have caught the
second refusal) · `mpp-model.test.ts` (`IMPORT-MPP-MAPPING`, 26 assertions over
the real plan). The conversion itself needs a JVM and a Vercel account, so it is
verified by `scripts/verify-mpp-sandbox.mjs` as an operator check, not in CI.

## REG-045 — A structured plan workbook imported nothing at all

**Date:** 2026-08-04 · **Status:** closed · **Guard:** `IMPORT-MULTI-HEADER-WORKBOOK`

A complete SAP Activate plan (`ProjectOps360_Proyecto_Aurora_SAP_Completo.xlsx`
— 10 sheets, 291 WBS rows, 77 gates, 19 people, 10 risks) was accepted by the
wizard and then imported **zero tasks, zero milestones, zero resources and zero
budget lines**. The only entities produced were 12 phantom "risks" scraped out
of a title row. Nothing errored: the review step simply showed an empty plan,
which reads as *"your file had nothing in it"* rather than *"we could not read
it"*.

**Root cause.** `rowsToTable` took **row 0 as the header row**. Real planning
templates almost never start there: they open with a title banner, a subtitle,
and frequently a merged *group band* (`Estructura y alcance | Planificación |
Ejecución`) spanning the columns above the actual headers. So every sheet became
a table whose single header was a sentence — `"Plan de Pruebas y Validación"` —
and the extractor's synonym table matched none of it. With no `name` column,
each extractor returned early. The workbook was structurally perfect and
completely unreadable.

This is the same shape as REG-044: the sophisticated layers were fine and the
front door was not. `extractCharterFromTable` even carried the comment *"the
title row often becomes the headers"* and scanned `[headers, ...rows]` to work
around it — the symptom was known and routed around instead of fixed.

**Four further defects surfaced once the sheets could be read:**

1. **Silent mis-binding.** `findColumn` fell back to substring matching, and
   `"area"` is inside `"ID de t·area·"` — the activity id was bound to
   `location`. `"real"` inside `"Horas reales"` was the same trap. Short
   synonyms are now exact-match only.
2. **The wrong id.** `source_id` preferred the hierarchical WBS outline number
   (`1.1.1.1`) over the referenceable activity id (`SAP-W1-004`) that the
   *Predecesoras* column and every satellite sheet actually cite. Dependencies
   went unresolved and the test-plan sheet minted duplicate tasks instead of
   matching existing ones.
3. **Rows lost to name collisions.** Task dedup treated equal names as
   duplicates, but a WBS legitimately repeats a group name once per phase; 28
   real rows were folded away. An explicit, distinct id now outranks the name.
4. **`out_of_scope` filed as `in_scope`.** The exclusion pattern required
   *"fuera **del** alcance"*; the sheet said *"Fuera de alcance"*, so it fell
   through to `/alcance/` and the project's exclusions were recorded as things
   it **would** deliver.

**How it was solved.** `detectHeaderRowIndex` scores the first rows of a sheet
and picks the one that behaves like a header — near-maximum width, short unique
non-numeric labels, followed by data of comparable width — with ties breaking
toward the earliest row, so files whose row 0 *is* the header are untouched.
On top of that, a row-kind column (`Tipo`) routes rows to what they are: the
project row seeds project identity, phases/waves/gates become milestones, and
everything else stays work. An include column (`Incluir = No`) is honoured, and
key/value sheets (`DATOS_PROYECTO`, budget summaries) are read in a first pass
so a declared project name always beats the root row of a WBS.

Measured on the real workbook: **0 → 274 tasks, 16 milestones, 155 dependencies,
19 resources, 7 budget lines, 10 risks**, project name/dates/budget and seven
charter fields. Every one of the 291 plan rows is accounted for — 274 tasks + 16
milestones + the single `Proyecto` row absorbed into the project itself — and no
sheet is left unexplained.

**Protection rule (binding):** the header row of a sheet is **detected, never
assumed to be row 0**. Any workaround that compensates for a bad header (such
as scanning `[headers, ...rows]`) is a signal that the header is wrong —
fix the detection, do not route around it. A synonym short enough to appear
inside an unrelated word is exact-match only. When a plan carries both a WBS
outline number and an activity id, the **id that predecessors cite** is the
`source_id`.

**Verify:** `src/lib/import-intelligence/__tests__/multi-header-workbook.test.ts`
(`IMPORT-MULTI-HEADER-WORKBOOK`) — header detection incl. the group-band and
"do not mistake a numeric data row for the header" cases, the `area`/`ID de
tarea` mis-binding, row-kind routing, and an end-to-end synthetic workbook.
The real 291-row plan is asserted as a fixture-gated smoke test (row-level
coverage), skipped when the file is absent.

## REG-046 — An import wrote 201 of 274 tasks and reported success

**Date:** 2026-08-04 · **Status:** closed · **Guard:** `IMPORT-WRITE-INTEGRITY`

Immediately after REG-045 made the SAP Activate plan readable, importing it
produced **201 tasks out of the 274 the review step had listed and the user had
approved**. The summary said 274. No error was shown, no warning, nothing in the
validation panel. The loss only became visible because the milestone counts on
three different screens did not add up.

**Root cause — two independent defects, either of which is enough to lose data.**

*1. Zero-duration rows were rejected.* `roadmap_tasks` constrains the column:

```sql
CHECK ((duration_days IS NULL) OR (duration_days > 0))
```

A plan legitimately carries zero-duration rows — milestones, deliverables and
quality gates are points in time, not spans — and the importer passed the
literal `0` straight through. The correlation was total: **all 73 missing rows
had `duration_days = 0`; all 201 written rows did not.**

*2. The rejection was swallowed.* Every write in the executor read only `data`:

```ts
const { data: row } = await supabase.from("roadmap_tasks").insert({...});
if (row) { …track it, count it… }        // no row → silently skipped
```

`error` was never inspected. A refused row did not throw, did not warn and did
not decrement the count — it simply ceased to exist. The same pattern was in
**all eight** inserts (milestones, resources, budget, tasks, dependencies,
materials, risks), so any constraint on any of those tables could silently drop
records. The zero-duration constraint is what happened to fire first.

**How it was solved.** `normalizeDurationDays` maps an explicit `0` (and any
non-finite or negative value) to `NULL`. The model cannot express "zero days",
and writing `1` would invent a span the plan never stated, so the row is stored
with **no duration** — its start and end dates are still imported and the
schedule still draws it. All eight inserts now capture `error`, and every
refusal is recorded as an `ImportWriteFailure` and written to
`project_import_validation_results` with severity **error**, grouped by entity
type and naming the rows that did not make it.

**Why the canonical import still holds `0`.** The extraction stays faithful to
the source — a `0` in the sheet is a `0` in the review screen — and the *writer*
translates it into the column's domain. Sanitizing during extraction would have
made the review step misreport what the file actually says.

**Protection rule (binding):** a write whose result is not inspected is a silent
data-loss bug. Every insert in an import path checks `error`, and any row the
database refuses is reported to the user — an import may import less than was
approved, but it may never *claim* it imported more than it did. A count shown
to the user is the count of rows the database accepted, never the count of rows
attempted.

**Verify:** `src/lib/import-intelligence/__tests__/import-write-integrity.test.ts`
(`IMPORT-WRITE-INTEGRITY`) — zero maps to NULL and specifically not to 1, real
durations are untouched, the canonical keeps the source `0`, and the real
291-row plan (fixture-gated) has >50 zero-duration rows of which none is
unwritable.

## REG-047 — Rolling an import back burned its project slug forever

**Date:** 2026-08-05 · **Status:** closed · **Guard:** `IMPORT-SLUG-UNIQUENESS`

After rolling back the REG-046 import and re-importing the same file, the
import died with *"Import failed and was rolled back"* and:

```
Project creation failed: duplicate key value violates unique constraint
"projects_organization_id_slug_key"
```

**Root cause.** The constraint counts every row:

```sql
UNIQUE (organization_id, slug)          -- no deleted_at predicate
```

An import rollback only **soft-deletes** the project. The executor's clash
check, however, excluded soft-deleted rows:

```ts
.eq("slug", slug).is("deleted_at", null).maybeSingle()   // ← disagrees with the DB
```

So the executor judged the slug free while the database still considered it
taken. The consequence is worse than one failed import: **a rolled-back import
burns its slug permanently** — every future attempt to import that same plan
picks the same base slug and fails the same way. The recovery path we had just
told the user to take was itself broken.

The fallback compounded it: after 49 suffixes the loop exited with `slug` still
set to the last colliding candidate and attempted the insert anyway.

**How it was solved.** `projectSlugCandidates(name, jobId)` returns the ordered
candidate list — the clean slug, then `-1…-49`, then one derived from the job id
that cannot collide and is stable across retries of the same job. The executor
walks it and takes the first slug that is free **against every row, deleted or
not**.

**Protection rule (binding):** a uniqueness pre-check must use the *same*
predicate as the constraint it is anticipating. Filtering soft-deleted rows out
of a check whose constraint counts them makes the application and the database
disagree, and the database always wins. Where a soft-delete convention coexists
with a plain UNIQUE constraint, either the constraint is partial
(`WHERE deleted_at IS NULL`) or the check must not filter — never one of each.

**Verify:** `src/lib/import-intelligence/__tests__/import-write-integrity.test.ts`
(`IMPORT-SLUG-UNIQUENESS`) — candidate order, accent/punctuation slugging, the
unnamed-project fallback, that the list never ends on a plain numbered suffix,
and that it is stable for a given job id.
