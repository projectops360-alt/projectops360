# 22 — Module Catalog

The in-app catalog of ProjectOps360° modules. The **canonical status** lives in the
[Capability Registry](05-capability-registry.md); this catalog is the narrative review —
*what each module does, why it exists, who uses it, what data and AI it uses, what
permissions apply, what it connects to, and what it must NOT do.*

> Where a module has not been fully reviewed yet, it is marked **"Documentation pending
> review."** Nothing here is faked — gaps are shown honestly.
>
> Binding product decisions affecting these modules are in the
> [Product Decision Log](30-product-decision-log.md) (PD-001 Critical Path · PD-002 Workboard
> ownership · PD-003 Variance baseline · PD-004 Timeline history · PD-005 What-if sandbox · PD-006
> Risk/SOP disconnected nodes · PD-007 Focus Mode · **PD-012 Evidence Provenance** · **PD-013 AI
> Prompt field is internal metadata**).

Per-module template: **Purpose · Status · Users · Data · AI · Permissions · Connects to ·
Boundaries (must-not) · Related capabilities/ADRs.** New in-depth docs use the
[Module Documentation Template](module-documentation-template.md).

---

## Catalog summary (audit tracker)

**Doc status:** Documented (full module doc) · Partial (catalog entry only) · Pending.
**Next audit priority:** order in which to write/deepen each module doc.

| Module | Doc status | Impl confidence | Related ADRs | Related CAPs | Next audit priority |
|--------|-----------|-----------------|--------------|--------------|---------------------|
| Living Graph | **Documented** ([doc 12](12-living-graph-strategy.md)) | ~75% | 002, 005, 006 | CAP-005 | ✅ done (pass 1) · ⚠️ [REG-007](10-regression-log.md) · ✅ [REG-008](10-regression-log.md) fixed · ✅ [Sprint #2](27-sprint-02-living-graph-focus.md) focus/usability · ✅ [Sprint #3](28-sprint-03-overlay-clarity.md) overlay clarity · ✅ [Sprint #4](29-sprint-04-navigation-evidence.md) navigation/evidence · ✅ **UX-007** Saved Layouts ([PD-008](30-product-decision-log.md)) · ↪ feeds [REG-013](10-regression-log.md#reg-013) briefing · ✅ **UX-008** edge task tooltip ([doc 32](32-product-ux-contracts.md)) |
| Execution Status Engine | Partial ([doc 18](18-execution-status-engine.md)) — now consumed by the graph | ~30% | 006 | CAP-016 | ✅ [REG-008](10-regression-log.md) wiring (graph) · ↪ semantics in [REG-013](10-regression-log.md#reg-013) briefing · ↪ status labels reused by UX-008 |
| Reports / Status Report | Pending | ~70% | — | CAP-024 | aligned semantics ([REG-008](10-regression-log.md)) · ↪ verify target in [REG-013](10-regression-log.md#reg-013) · ✅ [REG-015/UX-009](10-regression-log.md#reg-015) Status+Closeout on dashboard · ✅ **UX-010** guided closeout workflow ([doc 32](32-product-ux-contracts.md)) · ✅ [REG-017](10-regression-log.md#reg-017) record-backed closeout risk count |
| Resource Capacity Intelligence | **Documented** ([doc 13](13-resource-capacity-intelligence.md)) | ~45% | 003, **009** | CAP-009 | ✅ done (pass) · ⚠️ [REG-007](10-regression-log.md) · ↪ capacity warnings in [REG-013](10-regression-log.md#reg-013) |
| Labor Capacity (construction view) | Partial (catalog) — *construction-specific; see [ADR-009](adrs/ADR-009-reconcile-capacity-engines.md)* | ~70% | 009 | CAP-010 | 7 |
| Executive Command Center | Partial ([doc 14](14-executive-command-center.md)) | ~40% | 002, 006 | CAP-015 | 3 · ↪ shares rollup with [REG-013](10-regression-log.md#reg-013) briefing · ✅ [REG-015](10-regression-log.md#reg-015) Status card on dashboard |
| Isabella / AI Workforce | Partial ([doc 16](16-isabella-ai-workforce.md)) · ✅ [Dr. Isabella](31-dr-isabella-product-intelligence.md) Product-Brain grounding · ✅ [REG-013](10-regression-log.md#reg-013) Project Health Briefing · ↪ explains UX-008 edge tooltip | ~82% | 005, 006 | CAP-002/004 | 4 |
| Knowledge OS | Partial ([doc 15](15-knowledge-os.md)) | ~80% | 004 | CAP-001 | 5 |
| Project Memory & ProjectOps Scribe | Partial ([doc 17](17-project-memory.md)) | ~80% | — | CAP-006/007/008 | 6 · ✅ [REG-009](10-regression-log.md) restored (voice→actions/decisions) · ↪ recent decisions/follow-ups in [REG-013](10-regression-log.md#reg-013) briefing · ✅ **PD-012** Evidence Provenance (note → derived items; source chain preserved) |
| Evidence Provenance & Traceability | **Catalog** (this doc) · [PD-012](30-product-decision-log.md#pd-012) | ~70% (Phase 1) | — | CAP-043 | ✅ **PD-012** shipped (engine + Isabella + evidence UI); Phase 2 = task/risk detail UI, Living Graph badges, report counts, backfill |
| Risk Management | Pending | ~50% | — | CAP-017 | 8 · ✅ [REG-017](10-regression-log.md#reg-017) canonical open-risk status semantics (`isOpenRiskStatus`) shared with Closeout |
| Issue Management | Pending | 0% (Missing) | 011 (proposed) | CAP-018 | 9 |
| Decision Management | Pending | Implemented | — | — | 10 |
| Workboard (Task ownership) | Catalog | ~85% | — | CAP-020 | ✅ [Sprint #1](26-sprint-01-operational-clarity.md) — assignee on cards · ↪ primary verify target in [REG-013](10-regression-log.md#reg-013) · ✅ **[UX-014](32-product-ux-contracts.md#ux-014)/[PD-013](30-product-decision-log.md#pd-013)** — internal AI prompt field removed from task editor; "Ask Isabella about this task" instead · ✅ **[UX-013](32-product-ux-contracts.md#ux-013)** — responsive board: Compact density + horizontal scroll/auto-scroll, operable without browser zoom |
| Task / Milestone / WBS / Dependency / Critical Path | Pending | ~85% | 006 | CAP-019/020/021/022/023 | 11 · ✅ [Sprint #1](26-sprint-01-operational-clarity.md) Critical Path source of truth |
| Reports · Dashboards | Pending | ~70% / Partial | — | CAP-024/025 | 12 |
| Project Charter & Governance | Pending | ~80% | — | CAP-034 | 13 |
| People / Team · Security (RBAC) | Pending | ~70% / Partial | 008 (proposed) | CAP-028/029 | 14 (security-critical) |
| Drawing Intelligence / BIM | Pending | ~55% | — | CAP-035 | 15 |
| Documents · Meetings · Communications | Pending | Implemented / Partial | — | CAP-026/036/037 | 16 |
| Adaptive Delivery · Import · Billing | Pending | ~70/75/50% | — | CAP-039/040/041 | 17 |
| Mobile Experience | Pending | Unknown | — | — | 18 |
| Product Intelligence Center | Partial ([doc 22 self](22-modules.md)) | ~70% | 000, 007 | CAP-042 | — |

---

## Living Graph
- **Purpose:** The visual digital twin and primary intelligence/navigation surface.
- **Status:** Implemented (~75%). **Users:** PM, PMO, founder.
- **Data:** `process_nodes`/`process_edges`, tasks, milestones, capacity.
- **AI:** deterministic analysis (critical path, bottlenecks); Isabella explanations (pending wiring).
- **Permissions:** project members; respects project isolation.
- **Connects to:** Tasks, Milestones, Dependencies, Resource Capacity, (future) Execution Status Engine, Risks/Decisions.
- **Boundaries:** must never be decorative; must not infer "Blocked" from dependencies. **Saved
  Layouts (UX-007 / PD-008) are presentation state only** — persisting node coordinates must never
  change edges, dependencies, status, blockers, capacity, or rollups.
- **Affected by UX-007 (Saved Layouts):** manual node positions persist per project + graph context
  + user; auto-layout/reset/clear remain available. [PD-008](30-product-decision-log.md).
- **Related:** CAP-005 · [ADR-002](adrs/ADR-002-living-graph-primary-surface.md) · [Strategy](12-living-graph-strategy.md).

## Resource Capacity Intelligence
- **Purpose:** Real workforce capacity vs plan — utilization, overhead, availability, health.
- **Status:** Partial (~45%). **Users:** PM, PMO.
- **Data:** `project_resource_allocations`, `resource_*`, `workforce_health_scores`.
- **AI:** capacity insight summary (deterministic). **Permissions:** project members; edit = manager.
- **Connects to:** Tasks, Milestones, Living Graph (Workforce layer), Budget, Critical Path.
- **Boundaries:** must not be reduced to "assign a person to a task"; forecast/burnout are required vision.
- **Related:** CAP-009 · [ADR-003](adrs/ADR-003-resource-capacity-intelligence.md) · [Strategy](13-resource-capacity-intelligence.md).

## Labor Capacity
- **Purpose:** Construction labor capacity (headcount/hours by trade/week), workface readiness, lookahead.
- **Status:** Implemented (~70%). **Data:** `labor_resources`, `labor_weekly_capacity`, `construction_activities`.
- **Connects to:** Resource Capacity, Living Graph. **Boundaries:** construction-domain; reconcile with generic capacity engine (ADR-009 pending).
- **Related:** CAP-010.

## Knowledge OS
- **Purpose:** Curated knowledge substrate that grounds the AI workforce.
- **Status:** Implemented (~80%). **Data:** `knowledge_*` tables (pgvector).
- **AI:** hybrid multilingual retrieval + grounded generation. **Permissions:** all app users (read).
- **Boundaries:** answers only from retrieved knowledge; never fabricate.
- **Related:** CAP-001 · [ADR-004](adrs/ADR-004-knowledge-os-substrate.md) · [Doc 15](15-knowledge-os.md).

## Isabella / AI Workforce
- **Purpose:** Primary AI presence that explains and recommends; now the **Product Intelligence layer**.
- **Status:** Implemented presence (~80%); **Product-Brain grounded** (Dr. Isabella) — answers
  ProjectOps360° questions from the curated Product Brain corpus with sources + verification paths.
- **AI:** Knowledge OS hybrid retrieval over `product_intelligence` + `people_permissions` packages.
  **Boundaries:** AI assists, humans decide; engines (status/rollup/capacity) are never overridden.
- **Knowledge sources:** **every module is a knowledge source for Isabella** via curated Product
  Brain packages — Living Graph, Workboard, Project Memory/Scribe, Resource Capacity, Execution
  Status Engine, regressions (REG-008/009/010), ADRs, and Product Decisions.
- **Affected by UX-007 (Saved Layouts):** Isabella must explain how to save the Living Graph layout
  and that it is visual only — it changes no project data, dependencies, or edges
  (package `pi-living-graph-saved-layouts`; [PD-008](30-product-decision-log.md)).
- **Project Health Briefing ([REG-013](10-regression-log.md#reg-013)):** inside a project Isabella
  proactively shows a **deterministic** briefing on open (health, blockers vs waiting, overdue,
  capacity warnings, risks, recommended actions, verify links) built from the canonical rollup +
  roadmap engines — **no AI on load, nothing invented**. Refresh re-runs it; Dismiss is
  session-only; RBAC scopes what each role sees. Code: `lib/project-briefing/*` +
  `components/isabella/project-briefing.tsx`. See [Doc 16 → Project Health Briefing](16-isabella-ai-workforce.md).
- **Provenance intelligence ([PD-012](30-product-decision-log.md#pd-012)):** Isabella answers "where
  did this task/decision/risk come from?", "how many tasks came from voice notes?", "which decisions
  came from meetings?" using a **deterministic, record-backed** PROVENANCE FACTS block stamped into
  her context server-side (`askLivingGuideAction` → `lib/provenance` → `formatProvenanceForPrompt`),
  grounded by KP `pi-evidence-provenance`. She **cites the source**, includes the excerpt when
  allowed, links to Project Memory, and says **"I don't have a linked source"** (a traceability gap)
  when none exists — she never infers a source. `currentEntity` context lets her trace "this" item.
- **Ask Isabella action bridge ([UX-014](32-product-ux-contracts.md#ux-014)):** in-app AI actions
  ("Ask Isabella about this task", "Ask Isabella about this source") open Isabella through ONE app-wide
  `isabella:ask` event (`src/lib/isabella/ask-isabella.ts`), seeded with a question + entity context —
  never a dead deep-link. This is the **user-facing replacement** for the removed internal task
  "AI Prompt" field ([PD-013](30-product-decision-log.md#pd-013)).
- **Related:** CAP-002/004 · [ADR-005](adrs/ADR-005-isabella-primary-ai-interface.md) · [Doc 16](16-isabella-ai-workforce.md) · [Doc 31 — Dr. Isabella](31-dr-isabella-product-intelligence.md).

## Project Memory & Scribe
- **Purpose:** Per-project institutional memory; fast capture → structured items.
- **Status:** Implemented (~80%). **Data:** `project_memory_items`, `project_scribe_items` (vectorized).
- **Boundaries:** per-project; distinct from Knowledge OS and Product Intelligence.
- **Provenance ([PD-012](30-product-decision-log.md#pd-012), binding):** every Scribe extraction is the
  **forward** provenance record (`project_scribe_items`: `source_excerpt`, approval status,
  `created_entity_*`); generated work items carry the **reverse** link
  (`project_backlog_items.source_memory_item_id`/`source_scribe_item_id`). The note detail panel shows
  **"What this note produced"** (derived tasks/decisions/risks + memory-only extractions). AI must
  never create an entity without preserving this chain.
- **Related:** CAP-006/007/008 · [Doc 17](17-project-memory.md).

## Evidence Provenance & Traceability
- **Purpose:** Track the **origin of every AI-derived project entity** so PMs/PMOs can answer "why
  does this work exist?". Provenance is a **read-only projection** over the canonical source-chain
  records — it never forks the truth into a parallel table. See [PD-012](30-product-decision-log.md#pd-012).
- **Status:** Implemented (Phase 1). **Data (read):** `project_scribe_items`, `traceability_links`,
  `project_backlog_items` reverse FKs, `decisions.source_type`/`source_record_id`, `project_memory_items`.
- **AI:** Isabella answers provenance via **deterministic injection** (record-backed PROVENANCE FACTS
  stamped into context; she cites the source, includes the excerpt when present, and says the source
  is **unknown / a traceability gap** when no record exists — never inferred). Engine:
  `getProjectProvenanceSummary` / `getEntityProvenance`.
- **Permissions:** org + project scoped (server-side); **source excerpts are redacted for external
  viewers**. **Boundaries (must-not):** never infer a source from text similarity; never hide a
  missing source (show the gap); never overwrite existing provenance.
- **Related:** CAP-043 · `src/lib/provenance/*` · `src/components/provenance/*` · KP
  `pi-evidence-provenance`.

## Execution Status Engine
- **Purpose:** Single deterministic engine for Execution/Dependency/Health/Risk (independent dimensions).
- **Status:** **Prototype (~20%)** — not wired. **Boundaries:** Blocked requires explicit impediment.
- **Related:** CAP-016 · [ADR-006](adrs/ADR-006-independent-status-dimensions.md) · [Doc 18](18-execution-status-engine.md).

## Executive Command Center
- **Purpose:** Consolidated executive view of health/status/risk/capacity with graph drill-down.
- **Status:** Partial (~40%). **Related:** CAP-015 · [Doc 14](14-executive-command-center.md).

## Reports · Dashboards
- **Purpose:** Saved reports over curated datasets; execution dashboards.
- **Status:** Reports Implemented (~70%); Dashboards Partial. **Related:** CAP-024/025.
- **Closeout Report readiness ([REG-017](10-regression-log.md#reg-017), binding):** every closeout
  readiness count must be **record-backed**. "Risks resolved" counts only **active unresolved risks
  in the project's closeout scope** (`isOpenRiskStatus`), the count must equal `recordIds.length`,
  and the criterion must expose the risk IDs/records. Resolve actions must lead to those **exact
  records** — inline disclosure on the Closeout page (no risk-register route exists), never a generic
  destination where the risks are not visible. If a count has **no matching records**, the report
  shows **0 or an explicit data-consistency warning**, never a fake blocker. Dev mode exposes
  per-criterion diagnostics (source fn, included/excluded IDs + reasons, count, resolveRoute).

## Project Export & Blueprint Generator
- **Purpose:** Export a project two ways — **Full Project Archive** (the project as executed:
  evidence, traceability, reports, memory, closeout) and **Starter Blueprint** (a clean reusable
  template: structure kept, execution history reset). See [PD-011](30-product-decision-log.md#pd-011).
- **Status:** Implemented (MVP — ZIP package). **Entry point:** Command Center / Dashboard →
  "Reports & Executive Outputs" → **Export Project**. **Related:** CAP-024 (Reports).
- **Boundaries (must-not, binding):** export is **read-only** — it never mutates the source project
  (no status change, no reset of original tasks/memory/layout, no closeout completion). RBAC is
  enforced **server-side** in the route handler (Full Archive → owner/admin; Blueprint → also member/
  PM; never viewers); sensitive sets (Project Memory, transcripts, audit) require owner/admin even if
  requested. Starter Blueprint **never** carries raw memory, transcripts, actual costs/dates, owner
  identities or audit history by default. Every package carries `export-manifest.json`; every export
  is **audit logged** (`export` action). Code: `src/lib/project-export/*`,
  `app/.../projects/[projectId]/export/route.ts`, `export-project-modal.tsx`.
- **Affected/related modules (PD-011 surfaces them as export sources):** Command Center (entry),
  Project Memory (gated, lessons-only in blueprint), Closeout Report (archive includes it),
  Workboard/Tasks, Living Graph (structure → blueprint phases/tasks/deps), Resource Capacity &
  Team/Roles (role templates, identity-stripped), Rythm/Meetings (transcripts gated), BIM/Documents
  (manifest only, no bytes), Reports, Isabella (explains the two modes), Product Brain Control Center
  (PD-011 traceable).

## Task / Milestone / Dependency / Critical Path Management
- **Purpose:** Core execution objects and CPM scheduling.
- **Status:** Implemented (Tasks/Milestones/Dependencies ~85-90%; Critical Path ~80%).
- **Related:** CAP-020/021/022/023.

## Risk Management
- **Purpose:** Project risk register + risk health dimension.
- **Status:** Partial (~50%). **Related:** CAP-017.
- **Risk status semantics (canonical, [REG-017](10-regression-log.md#reg-017)):** a risk is **open /
  unresolved** when `status ∈ {open, identified, mitigating}`; it is **resolved** when
  `status ∈ {resolved, closed, accepted}`. These live in the pure, client-safe
  `src/lib/rhythm/closeout-criteria.ts` (`isOpenRiskStatus`) and **must be shared** with any consumer
  that counts open risks — Closeout, Status, briefing — so semantics never diverge.
- **Record-backed entry:** any feature that counts open risks (e.g. Closeout's "Risks resolved")
  must be able to surface the **exact risk records** behind the count (id, title, status, severity,
  owner) for the **current project scope** — counts without visible source records are not allowed.
- **Known gap:** there is **no dedicated risk-register page** yet; risks are created via Project
  Memory / Scribe and read in aggregates. Until a risk list view exists, open-risk blockers are
  disclosed **inline** on the consuming screen (Closeout) rather than routed to a non-existent page.

## Issue Management
- **Status:** **Missing.** Documentation pending review. (Only Risks exist today; Issues are a distinct future entity — ADR-011 proposed.) **Related:** CAP-018.

## Project Charter & Governance
- **Purpose:** Charter, roles, governance rules, approval matrix, sign-off.
- **Status:** Implemented (~80%). **Related:** CAP-034.

## People / Team Workspace & Security (RBAC)
- **Purpose:** Members, roles, RACI; access control.
- **Status:** Team Implemented (~70%); RBAC **Partial / regression-risk** on `master`.
- **Boundaries:** authorization must be server-side. **Related:** CAP-028/029 · DEBT-002.

## Navigation / Shell (Project Workspace)
- **Purpose:** The project-level navigation (`ProjectTabs`, one sticky bar serving desktop + mobile)
  that routes between every project module.
- **Status:** Implemented. **Affected by [UX-006](25-ux-design-debt.md) + [REG-012](10-regression-log.md#reg-012--bim-module-missing-from-navigation).**
  Restructured from a **flat 13-tab bar** into **grouped navigation** (`TAB_GROUPS`): Command Center ·
  Planning · Execution · Resources · Intelligence · **Technical / BIM** · More.
- **Boundaries (must-not):** simplification must **never** hide, orphan, or degrade a strategic module
  (BIM, Living Graph, Resource Capacity, Project Memory). Grouping organizes by **user intent**, not by
  removal. Operational modules must not be demoted into Settings. One visible home per capability
  (REG-011). **Related:** [PD-009](30-product-decision-log.md), [UX-006](25-ux-design-debt.md).
- **Language consistency ([UX-012](32-product-ux-contracts.md#ux-012), binding, app-wide):** nav and
  all user-facing UI must be fully in the selected language — **no Spanglish**. Nav labels, Workboard,
  Team & Roles, Charter/Governance, Command Center, Living Graph, Project Memory, Isabella, Resource
  Capacity, Reports and Landing all draw from `messages/{en,es}.json`, which stay in **key-parity**
  (enforced by `src/i18n/__tests__/message-parity.test.ts`). Canonical terms live in
  `src/lib/i18n/glossary.ts`; product names/acronyms may stay canonical. New UI text must add both EN
  and ES keys — never hardcode single-language strings.

## Drawing Intelligence / BIM
- **Status:** Partial (~55%). Documentation pending deeper review. **Affected by
  [REG-012](10-regression-log.md#reg-012--bim-module-missing-from-navigation):** BIM had disappeared
  from the project menu for non-construction projects (module-gated with no visibility fallback).
  **Now placed in the dedicated Technical / BIM nav group** ([PD-009](30-product-decision-log.md));
  shown disabled-with-explanation where `drawing_intelligence` is not enabled, never silently removed.
  Route `/projects/:projectId/drawing-intelligence` preserved and crash-safe. **Related:** CAP-035.

> **Execution** and **Resources** module areas are also touched by UX-006/REG-012 navigation grouping
> (Execution hosts Workboard/Execution Map; Resources hosts Team & Roles/Stakeholders/Resource
> Capacity/Labor Capacity). Resource Capacity stays operational under **Resources**, never Settings-only.

## Adaptive Delivery Framework · Project Import Intelligence · Billing
- **Status:** Delivery Implemented (~70%); Import Implemented (~75%); Billing Partial (~50%).
- **Related:** CAP-039/040/041.

## Product Intelligence Center (this module)
- **Purpose:** Read the product brain inside the app (DNA, North Star, Principles, ADRs, Modules, Governance).
- **Status:** Implemented (~70%). **Users:** owner/admin only (server-enforced).
- **Data:** `docs/product-brain` (build-bundled). **Permissions:** internal; denied to member/viewer/client.
- **Boundaries:** internal only; never client-facing; read-only (no in-app editing yet).
- **Affected by UX-007 (Saved Layouts):** the Living Graph Saved Layouts behavior is documented here
  (PD-008, doc 12, doc 30) so it is the source of truth and Isabella can answer it.
- **Related:** CAP-042.

---

> To deepen any module, add a file under [`capabilities/`](capabilities/) and link it here.
