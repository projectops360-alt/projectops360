# 30 — Product Decision Log

The canonical ledger of product decisions from the product-owner review of Workboard, Critical
Path, the Living Graph, and its advanced overlays. Each decision is binding and overrides
conversation/prompt history ([ADR-000](adrs/ADR-000-product-intelligence-source-of-truth.md)).

Status legend: **Shipped** (live in prod) · **Partial** (some of the decision shipped) · **Decided**
(recorded, not yet built).

---

## PD-001 — Critical Path lives inside the Living Graph
- **Decision:** Critical Path is computed and shown in the **Living Graph** — the single source of
  truth. **Reason:** the graph already represents dependencies, milestones, execution status,
  downstream impact, blockers, waiting states, risks, and flow, so it is the correct surface.
- **Rule:** Roadmap/Execution Map must NOT maintain a separate Critical Path engine, and must NOT
  show a "coming soon" placeholder when Critical Path already exists in the Living Graph. It may
  provide an **entry point** (Project → Execution Map → Living Graph → Critical Path overlay).
- **Status: Shipped** — Sprint #1 ([doc 26](26-sprint-01-operational-clarity.md)); the Execution
  Map tab now deep-links to `…/living-graph?overlay=criticalPath`. CAP-005/CAP-023, ADR-002.

## PD-002 — Workboard task card ownership
- **Decision:** Workboard cards must show **assignee avatar/initials (when available) · name ·
  role (when available)**, or **"Unassigned"** when there is no owner. **Reason:** a PM must know
  who owns each task without opening the detail panel — operationally required, not decorative.
- **Rule:** real assignment data only; never invent a name; a failed lookup → "Unassigned".
- **Status: Shipped** — Sprint #1 + follow-up (2026-06-27): the card shows **avatar (or initials)
  · name · role**, with **"Unassigned"** when no owner and **"Assigned user unavailable"** when an
  owner id resolves to no name. Role comes from `project_team_members.project_role` (person) or
  `resources.resource_type` (group); avatar from `profiles.avatar_url`. Names resolved via the
  admin client (RLS-safe, cross-org). Real data only. CAP-020,
  [doc 26](26-sprint-01-operational-clarity.md). Helper `src/lib/roadmap/task-owner.ts` (unit-tested).

## PD-003 — Variance View requires a baseline
- **Decision:** Variance View shows real variance only when an approved **baseline** exists
  (baseline/planned vs current/actual/forecast). **Rule:** do NOT invent variance values.
- **Empty state:** "Variance View requires a project baseline. Create or approve a baseline first
  to compare planned vs actual performance." (with a CTA to the Delivery Framework).
- **Status: Shipped** — Sprint #3 overlay clarity ([doc 28](28-sprint-03-overlay-clarity.md));
  deterministic empty/incomplete states in `overlay-metadata.ts`.

## PD-004 — Timeline Playback requires real history
- **Decision:** Timeline Playback is based on **real** project events, status history, audit logs,
  Project Memory events, dependency changes, or graph snapshots. **Rule:** do NOT show fake playback.
- **Empty state:** "Timeline Playback requires project history. Start capturing task changes,
  decisions, risks, dependencies, and Project Memory events to enable playback."
- **Status: Shipped** (clarity/empty state) — Sprint #3 ([doc 28](28-sprint-03-overlay-clarity.md)).

## PD-005 — What-if Simulation is sandbox-first
- **Decision:** What-if Simulation may change variables (delay task, move milestone, change
  dependency, reassign, reduce availability) **inside a sandbox**. **Rule:** no simulation may
  modify real project data unless the user **explicitly applies** it; results always labeled
  **"Simulation only — no project data changed."**
- **Status: Shipped** (the existing deterministic what-if + the Sprint #3 clarity card enforce the
  "estimate only, nothing changes" framing). [doc 28](28-sprint-03-overlay-clarity.md).

## PD-006 — Risk / SOP disconnected nodes must be explained
- **Decision:** Disconnected nodes in Risk View or SOP Candidate View must NEVER look like broken
  graph behavior.
  - Unlinked risk → "This risk is not linked to any task or milestone yet."
  - Unlinked SOP candidate → "Detected from repeatable work patterns but not linked to a formal
    process yet."
  - If caused by missing edges / layout bugs → fix edge generation / layout in implementation.
- **Status: Shipped** (explanations) — Sprint #3 overlay clarity card surfaces the incomplete state
  with disconnected counts ([doc 28](28-sprint-03-overlay-clarity.md)). Edge/layout bug-hunting is
  a follow-up if any disconnected nodes are found to be real bugs.

## PD-007 — Living Graph Focus Mode
- **Decision:** The Living Graph must include **Focus Mode** that maximizes the canvas, collapses
  secondary filters / large KPI blocks / legend (default collapsed), reduces toolbar noise, hides
  long helper text, keeps only essential controls, and exits easily. **Reason:** the Living Graph
  must be the protagonist of the page.
- **Status: Shipped** — Sprint #2 ([doc 27](27-sprint-02-living-graph-focus.md)); in-page Focus Mode
  toggle, Insights/Legend collapsed by default. ADR-002.

## PD-008 — Living Graph Saved Layouts (UX-007)
- **Decision:** Users may manually reposition nodes in the Living Graph and **save** that
  arrangement so it persists across refresh and future visits. A saved layout is a **visual
  workspace preference** — node coordinates and viewport only. **Reason:** time spent arranging the
  graph for a project should not be lost on reload.
- **Rules (binding):**
  - Saved layout stores **node positions + viewport only** — never edges, dependencies, blockers,
    execution status, capacity metrics, rollups, or any business logic. Graph data stays the
    deterministic source of truth; the saved layout only changes the x/y of matching nodes.
  - Scope is **per project + per graph context** (view level + layout mode) and **per user**
    (personal). Changing layout mode (Executive Flow / Process Mining) or view level loads **that
    context's** saved layout — it must not silently destroy the manual one.
  - **Auto-layout stays available**: the user can reset to auto layout, reset to the saved layout,
    or clear the saved layout. New nodes added after a save are placed by the auto-layout; deleted
    nodes in the saved layout are ignored. If the graph changed, the layout is **partially applied**
    with an honest notice — it never crashes on stale node IDs.
  - Unsaved manual changes are surfaced **subtly** (a highlighted Save button + dot), never with
    nagging alerts after every drag.
  - **MVP persistence is localStorage** (project + context scoped, implicitly personal), extending
    the existing graph view-preference convention. A durable `project_graph_layouts` Supabase table
    (id, project_id, user_id, layout_key, level, layout_mode, node_positions jsonb, viewport jsonb,
    is_default, timestamps) is the documented upgrade path for **shared/team layouts**, which would
    require **PM/PMO/Admin** permission. Personal layouts never affect other users.
  - **Isabella must be able to explain** how saved layouts work and what they do (and do not) change.
- **Status: Shipped (MVP)** — UX-007; `src/lib/graph/graph-layout-storage.ts`,
  `src/components/graph/living-graph-layout-controls.tsx`, wired in `living-graph-view.tsx`.
  CAP-005, ADR-002. Shared/team layout = Decided (not yet built).

## PD-009 — BIM Navigation Placement (UX-006 / REG-012)
- **Decision:** **BIM must remain discoverable in ProjectOps360°.** Navigation simplification groups
  capabilities by user intent; it must never remove, orphan, or bury a strategic module. BIM (the
  Drawing Intelligence capability, user-facing label "BIM") gets a **dedicated Technical / BIM group**
  in the grouped project navigation.
- **Preferred placement (in priority order):**
  - **Technical / BIM** — a dedicated technical group (**chosen**: keeps BIM strategic and obvious for
    construction/technical projects). Houses BIM / Drawings / Models / Technical Assets / Construction
    documents as they ship.
  - or **Execution → BIM** — acceptable if fewer top-level groups are required.
  - or **More → Technical / BIM** — only if **More** is clearly visible and BIM is not hidden.
  - For construction / BIM-enabled projects, BIM must be **visible and not buried**.
- **Visibility contract (binding):**
  - BIM is **visible** when the project type is construction, when `drawing_intelligence` is enabled,
    or when the product otherwise treats BIM as available — respecting RBAC.
  - When BIM is **not enabled**, the product must **not silently remove** it: show a **disabled,
    explained entry** ("BIM is not enabled for this project") rather than nothing, so the capability
    is never invisible to a user who expects it. (`keepDisabledWhenModuleMissing` in
    `project-tabs-config.ts`.)
  - Existing BIM deep links (`/projects/:projectId/drawing-intelligence`) must keep working and never
    server-crash.
- **Resource Capacity placement (binding, related):** Resource Capacity is **operational**, not admin.
  It lives under **Resources / People & Capacity** — **never only in Settings**.
- **Settings boundary (binding, related):** Settings holds project settings, permissions/access,
  integrations, notifications, templates, advanced/admin — **not** the primary home for operational
  modules (Team execution, Stakeholders, Resource Capacity, BIM, Workboard, Project Memory).
- **Status: Shipped** — UX-006 grouped nav; `src/components/layout/project-tabs-config.ts`
  (`TAB_GROUPS`, Technical / BIM group) + `project-tabs.tsx`. Resolves
  [REG-012](10-regression-log.md#reg-012--bim-module-missing-from-navigation); implements
  [UX-006](25-ux-design-debt.md). CAP-035.

## PD-010 — Landing Hero Uses Animated Living Graph
- **Decision:** The public landing hero (`/landing`) must use a **real animated HTML/CSS/SVG/React
  Living Graph preview** — never a static screenshot/image. **Reason:** ProjectOps360° should present
  itself as a **living Project Intelligence Platform**, not a generic task board; the hero is the first
  proof of that. The whole landing was also re-skinned from the prior dark theme to a **premium
  corporate light** system (off-white #F7F8F4 surfaces, corporate green #007A4D, generous whitespace,
  subtle premium motion) approved via the `projectops360_animated_hero_mock.html` reference.
- **Scope (binding):** this is a **marketing/landing** change only. It must **not** modify app-internal
  logic — project metrics, rollups, Project Memory, Rythm, the real in-app Living Graph, BIM, internal
  routes, or permissions.
- **Protection rules (binding):**
  - Do **not** replace the hero animation with a static image.
  - Do **not** hide **BIM / Drawing Intelligence** from the public feature set (it stays in the
    Capabilities section *and* appears in the hero graph's sidebar).
  - Do **not** remove existing landing sections, CTAs, the EN/ES language switch, privacy links,
    sign-in, or request-access flows.
  - **AI messaging must say AI _supports_ the Project Manager — it does not replace the PM.** The
    Decision Intelligence section keeps the "AI does not replace your expertise … the project manager
    remains in control" message (now a text-left + Isabella advisor-panel layout).
  - Content is preserved per the product owner's instruction ("change the design, not the content"):
    existing i18n copy is kept; only **design** changed plus **new design-element labels** for the
    hero graph (`heroGraph.*`) and the Isabella panel (`ai.panel*`).
  - Honor `prefers-reduced-motion` (calm static graph), keep it responsive with **no horizontal
    overflow**, and avoid heavy animation libraries (CSS + SVG + a single rAF loop).
- **Implementation:** `src/components/landing/animated-hero-graph.tsx` (new), wired into `hero.tsx`;
  light design tokens + graph keyframes in `landing.css`; every landing section restyled to the light
  system; `execution-map.tsx` (old dark hero mock) removed. **Status: Shipped** — `/landing`.

## PD-010 — Product Brain Control Center (in-app governance cockpit)
- **Decision:** ProjectOps360° exposes Product Brain / Product Intelligence **inside the app** as a
  trackable governance Control Center, not only as markdown. It indexes product decisions,
  regressions, UX contracts, ADRs/CAPs, modules, known gaps, and AI development rules with **status +
  test-protection** metadata, search/filters, a detail drawer, an "Ask Isabella about this item"
  bridge, and a Markdown export.
- **Reason:** markdown alone made governance state hard to track and let solved issues regress.
  Owner and AI developers need a visible, searchable, status-driven system of record.
- **Storage:** **hybrid (Option C)** — markdown (`docs/product-brain`) remains the **source of
  truth**; the app adds a structured index (`src/lib/product-brain-center/registry.ts`) that cites
  each item's `source_path`/`section`. Every item shows whether it is **protected by an executable
  test** (links to the regression-test map).
- **Access (TASK 10A — binding security):** the Control Center is internal and sensitive. Access is a
  **strict server-side EMAIL allowlist**, NOT role and NOT UI hiding. The single source of truth is
  `src/lib/product-brain/access.server.ts` (`isProductBrainAllowedEmail`), configured via
  `PRODUCT_BRAIN_ALLOWED_EMAILS` (set in production to `efrain.pradas@gmail.com,pmo@xxx-demo.io`;
  fallback defaults match). The route (`/product-intelligence`) returns
  `notFound()` for non-allowed users (existence not revealed) and loads no data; the nav item, the
  server actions (Isabella bridge + export), and Isabella's item answers all enforce the same
  allowlist. Isabella refuses internal Product Brain content for non-allowed accounts.
- **Protection rule:** major decisions, regressions, UX contracts, ADRs, CAPs and module rules must
  be traceable from the Control Center, each showing its test-protection status. The allowlist is
  enforced server-side and covered by `src/lib/product-brain/__tests__/access.test.ts`; the registry
  + selectors by `src/lib/product-brain-center/__tests__/registry.test.ts`.
- **Implementation:** route `app/[locale]/(app)/product-intelligence/page.tsx`;
  `components/product-brain/control-center.tsx` (+ embeds the existing docs viewer as the Documents
  tab — no capability removed); `lib/product-brain-center/{types,registry,select}.ts`;
  `lib/product-brain/{access.ts,access.server.ts}`. **Status: Shipped.**

---

## PD-011 — Project Export & Blueprint Generator
- **Decision:** ProjectOps360° must support exporting a project in **two modes**:
  1. **Full Project Archive** — a complete historical package of the project **as executed**
     (project data, charter/governance, roadmap, milestones, tasks, dependencies, risks, decisions,
     action items, communications, meetings, Project Memory, documents manifest, traceability,
     Closeout Report, lessons learned, audit trail). Preserves actual statuses, dates, evidence and
     traceability.
  2. **Starter Blueprint** — a **clean reusable template** derived from the project structure but
     reset for future use (phases, task templates, dependency patterns, role templates, risk
     templates, document checklist, optional lessons-learned summary).
- **Reason:** PMOs need to **preserve** completed projects as evidence/audit while also **reusing**
  successful structures to accelerate similar future projects and simulations. "A completed project
  should become reusable organizational knowledge."
- **Protection rules (binding):**
  - Full Archive must **preserve** evidence and traceability.
  - Starter Blueprint must **remove or reset** sensitive execution history: no completed statuses, no
    actual costs/dates, no private transcripts, no raw Project Memory, no audit history, owners →
    role placeholders — unless explicitly selected (and transcripts never enter a blueprint).
  - Export must **respect RBAC** (Full Archive → owner/admin/PMO; Blueprint → also PM/member; never
    viewers) **server-side**, not via hidden buttons.
  - Export must **never mutate** the original project (read-only gather; pure transforms).
  - Every package includes an **export-manifest.json**; every export is **audit logged** (`export`
    action, no document contents).
  - **Isabella** must understand the difference between Full Archive and Starter Blueprint.
- **Implementation:** pure core `src/lib/project-export/{types,rbac,manifest,transform,csv,zip}.ts`;
  server `{gather,full-archive,blueprint,service}.ts`; download route
  `app/[locale]/(app)/projects/[projectId]/export/route.ts`; UI `export-project-modal.tsx` in the
  dashboard "Reports & Executive Outputs" card; migration `20260628000000_audit_action_export.sql`.
  Tests: `src/lib/project-export/__tests__/project-export.test.ts`. **Status: Shipped (MVP — ZIP
  package; future "Create project from blueprint" import is designed-for, not yet built).**

---

## PD-012 — Evidence Provenance Is Required for AI-Derived Work
- **Decision:** Any **task, decision, risk, issue, follow-up, milestone, or action item created from
  AI extraction** must retain its **source provenance**. Source provenance includes: source type,
  source item ID, source excerpt, transcript/note/document reference, extraction method, approval
  status, approved by, approved at, created entity ID, and a traceability link.
- **Reason:** ProjectOps360° must not only create work — it must remember **why** the work exists.
  PMs and PMOs have to answer "Why does this task exist?", "Who decided this?", "Where did this risk
  come from?", "What note, meeting, or document produced this action?". *No source, no confidence.*
- **Protection rules (binding):**
  - AI must **not** create project entities without preserving source evidence.
  - Isabella must **not** answer provenance questions unless source records exist. If provenance is
    missing she must say the source is **unknown** and **flag a traceability gap** — never inferred
    from text similarity.
  - Traceability must be **record-backed**, created at the time of approval/entity creation.
  - "Created manually" is a **known origin**, distinct from a gap; it must not be reported as missing.
  - Source excerpts are sensitive (raw notes/transcripts): **external viewers never receive them**;
    server-side authorization enforces this (not UI hiding).
- **Model (one source of truth, not a fork):** provenance is a **read-only projection** over the
  canonical records that already store the source chain — `project_scribe_items` (forward:
  extraction → `created_entity_*`, with `source_excerpt` + approval status), the reverse FKs on
  `project_backlog_items` (`source_memory_item_id` / `source_scribe_item_id`), `traceability_links`
  (memory/meeting → decision/risk), and `decisions.source_type`/`source_record_id` (meeting-derived).
  No parallel `entity_provenance` table is created (CLAUDE.md rule #5 — consolidate, don't fork).
- **Implementation (Phase 1 — shipped):** deterministic engine
  `src/lib/provenance/{types,engine,service}.ts` — `getProjectProvenanceSummary(projectId)` (counts
  by source: Scribe voice/note, meetings; traceability gaps) + `getEntityProvenance(type,id)`.
  Isabella answers provenance via **deterministic injection**: server stamps a record-backed
  PROVENANCE FACTS block into her context (`askLivingGuideAction` → `formatProvenanceForPrompt`),
  grounded by Knowledge Package `pi-evidence-provenance` (migration
  `20260830000000_provenance_knowledge.sql`); `currentEntity` context lets her trace "this" item.
  UI: `SourceEvidence` section on the **Decision detail**, "What this note produced" on the
  **Project Memory** note panel. Tests: `src/lib/provenance/__tests__/engine.test.ts`.
- **Phase 2 (Decided, not yet built):** `SourceEvidence` on task (backlog refinement) + risk detail;
  provenance badges on Living Graph nodes; provenance counts in the Closeout/executive report;
  a backfill script for historical items lacking links; persisting meeting-derived non-decision
  entities. **Status: Shipped (Phase 1).** Affects Project Memory · ProjectOps Scribe · Rythm/
  Meetings · Workboard/Tasks · Decisions · Risks · Isabella · Living Graph · Traceability · Reports.

---

## PD-013 — AI Prompt Field Is Internal Metadata (not user-facing)
- **Decision:** The **"AI Prompt / Prompt de IA"** field (`prompt_body`, plus `prompt_context` and
  `ai_tool_target`) must **not** be visible in the normal task editor. It is internal AI-implementation
  metadata, not a user-facing AI interaction.
- **Amendment (2026-07-01) — scoped exception:** for **AI-oriented project types**
  (`software_development`, `ai_native_execution`) these fields **are** exposed as an explicit
  **"AI Execution"** section in the task editor (the AI execution trail: prompt used, prompt context,
  AI tool/model). Rationale: for AI-native/software projects this is a legitimate, expected feature —
  the original concern was a *generic* prompt field on *every* task, not an opt-in AI-execution record
  for AI projects. For all other project types the fields stay hidden and values are preserved on save
  (preserve-on-absent). The forbidden generic labels are still never used; the section uses clear
  labels ("AI Execution", "Prompt used", "AI tool / model"). Guard updated:
  `task-editor-ai-prompt-visibility.test.ts` now asserts the fields are **gated** by project type.
- **Reason:** users expect a prompt field to **produce an AI response**. An external reviewer tested
  ProjectOps360°, saw "Prompt de IA" in the task edit modal, and reasonably interpreted it as an
  interactive AI input. A static field that only stores internal implementation instructions is
  misleading and makes the product feel unfinished/technically exposed.
- **Approved behavior (binding):**
  - Hide/remove the field from the normal task edit UI (all roles).
  - **Preserve existing stored values** — a normal save must not null them (preserve-on-absent). No
    destructive migration; a cleanup migration, if ever wanted, is a documented follow-up.
  - If the metadata is still needed, move it to internal/developer/admin-only, **permission-protected**
    (never frontend-only hiding). Preferred MVP: remove from normal UI, keep backend-only.
  - User-facing AI help is an **explicit action through Isabella** ("Ask Isabella about this task"),
    not a static field. Isabella is the interface for asking questions about a task.
- **Implementation (shipped):** field removed from `task-form-dialog.tsx` (section relabeled
  "Implementation & Testing Notes"); "Ask Isabella about this task" opens Isabella via the app-wide
  `isabella:ask` event bridge (`src/lib/isabella/ask-isabella.ts`); data preserved server-side in
  `roadmap/actions.ts`. Protected by **[UX-014](32-product-ux-contracts.md#ux-014)** + test. The same
  event bridge also fixed the provenance "Ask Isabella about this source" action (previously a dead
  deep-link). **Status: Shipped.** Affects Workboard · Task Editor · Isabella · AI Governance · UX
  Contracts · Product Brain Control Center.

---

## PD-014 — Unified People, Roles & Stakeholder Directory
- **Decision:** ProjectOps360° uses **one unified people directory** as the source of truth for project
  participants, team members, stakeholders, roles, responsibilities, authority, RACI/approval roles,
  and capacity. People are **not module-specific data** — the same person may appear in governance,
  delivery, capacity, task ownership, stakeholder communication, and approvals. **One person. Many
  roles. One connected system.**
- **Reason:** external review found participants, stakeholders, roles and project assignment felt
  disconnected — AI-generated roles weren't clearly tied to real people, and users had to retype
  people across modules.
- **Model (one source of truth, not a fork):** the directory is a **read-only projection** over the
  records that already exist — internal users (`profiles` + `organization_members`), external people
  (`external_contacts`), and `stakeholders` — de-duplicated by **email** (strong signal; ambiguous
  rows kept distinct, never guessed). The canonical **project person assignment** model is the
  existing `project_team_members` (it already links `user_id` / `external_contact_id` /
  `organization_team_id` and carries `member_type`, `project_role`, `governance_role`,
  `responsibility`, `authority_level`, RACI + a full permission set). No new parallel people table.
- **Protection rules (binding):**
  - Do **not** create separate disconnected people lists per module.
  - Role-assignment screens must **reuse** directory people/contact records where possible (select an
    existing person; don't retype).
  - AI-generated roles must be **assignable to real people**.
  - Resource Capacity, Workboard ownership, and Charter/Governance roles must connect to the **same**
    people identity.
  - A role may exist without a person — show **"Unassigned / Sin asignar"** (intentional, not an error).
  - RBAC preserved: authority/permission changes are server-guarded; no UI escalation.
- **Implementation (Phase 1 — shipped):** pure engine `src/lib/people/{types,directory}.ts`
  (`mergeDirectory` dedup-by-email, `classifyContactType`, `unassignedLabel`) + service
  `src/lib/people/service.ts` (`getPeopleDirectory(projectId?)`); wired into the **Charter → Roles**
  person selector so governance roles can be assigned from the full directory (not only project team).
  Tests: `src/lib/people/__tests__/directory.test.ts`. Isabella KP `pi-unified-people-directory`.
- **Phase 2+ (Decided, not built):** dedicated **Resources → People & Roles** page; write-through of
  Charter/Team assignments into `project_team_members` from the directory selector; consolidate the
  legacy `stakeholders` table into `external_contacts`; Resource Capacity + Workboard reading the same
  `person` identity end-to-end; a safe `scripts/backfill-people-directory.mjs` (dry-run, dedup report).
  **Status: Shipped (Phase 1 — read model + directory service + Charter selector).** Affects Team &
  Roles · Stakeholders · Charter/Governance · Resource Capacity · Workboard · RBAC · Isabella.

---

## Affected modules
Living Graph (CAP-005) · Workboard/Tasks (CAP-020) · Critical Path (CAP-023) · Risk Management
(CAP-017) · Variance/Process Intelligence · Timeline/History · What-if Simulation · Delivery
Framework (CAP-039, baseline) · Project Memory (CAP-006, history). See
[22-modules.md](22-modules.md).

## Follow-ups still open
- **PD-006:** verify any disconnected Risk/SOP nodes are explained-only, not edge/layout bugs.
- A standalone **Workboard** module doc and a **Variance/Baseline** module doc could be created when
  those areas next get focused work (today they live in the sprint docs + this log).
