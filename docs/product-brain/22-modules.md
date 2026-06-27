# 22 — Module Catalog

The in-app catalog of ProjectOps360° modules. The **canonical status** lives in the
[Capability Registry](05-capability-registry.md); this catalog is the narrative review —
*what each module does, why it exists, who uses it, what data and AI it uses, what
permissions apply, what it connects to, and what it must NOT do.*

> Where a module has not been fully reviewed yet, it is marked **"Documentation pending
> review."** Nothing here is faked — gaps are shown honestly.

Per-module template: **Purpose · Status · Users · Data · AI · Permissions · Connects to ·
Boundaries (must-not) · Related capabilities/ADRs.**

---

## Living Graph
- **Purpose:** The visual digital twin and primary intelligence/navigation surface.
- **Status:** Implemented (~75%). **Users:** PM, PMO, founder.
- **Data:** `process_nodes`/`process_edges`, tasks, milestones, capacity.
- **AI:** deterministic analysis (critical path, bottlenecks); Isabella explanations (pending wiring).
- **Permissions:** project members; respects project isolation.
- **Connects to:** Tasks, Milestones, Dependencies, Resource Capacity, (future) Execution Status Engine, Risks/Decisions.
- **Boundaries:** must never be decorative; must not infer "Blocked" from dependencies.
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
- **Purpose:** Primary AI presence that explains and recommends.
- **Status:** Implemented presence (~70%); live-state explanations pending.
- **AI:** Knowledge OS + (future) Execution Status Engine. **Boundaries:** AI assists, humans decide.
- **Related:** CAP-002/004 · [ADR-005](adrs/ADR-005-isabella-primary-ai-interface.md) · [Doc 16](16-isabella-ai-workforce.md).

## Project Memory & Scribe
- **Purpose:** Per-project institutional memory; fast capture → structured items.
- **Status:** Implemented (~80%). **Data:** `project_memory_items`, `project_scribe_items` (vectorized).
- **Boundaries:** per-project; distinct from Knowledge OS and Product Intelligence.
- **Related:** CAP-006/007/008 · [Doc 17](17-project-memory.md).

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

## Task / Milestone / Dependency / Critical Path Management
- **Purpose:** Core execution objects and CPM scheduling.
- **Status:** Implemented (Tasks/Milestones/Dependencies ~85-90%; Critical Path ~80%).
- **Related:** CAP-020/021/022/023.

## Risk Management
- **Purpose:** Project risk register + risk health dimension.
- **Status:** Partial (~50%). **Related:** CAP-017.

## Issue Management
- **Status:** **Missing.** Documentation pending review. (Only Risks exist today; Issues are a distinct future entity — ADR-011 proposed.) **Related:** CAP-018.

## Project Charter & Governance
- **Purpose:** Charter, roles, governance rules, approval matrix, sign-off.
- **Status:** Implemented (~80%). **Related:** CAP-034.

## People / Team Workspace & Security (RBAC)
- **Purpose:** Members, roles, RACI; access control.
- **Status:** Team Implemented (~70%); RBAC **Partial / regression-risk** on `master`.
- **Boundaries:** authorization must be server-side. **Related:** CAP-028/029 · DEBT-002.

## Drawing Intelligence / BIM
- **Status:** Partial (~55%). Documentation pending deeper review. **Related:** CAP-035.

## Adaptive Delivery Framework · Project Import Intelligence · Billing
- **Status:** Delivery Implemented (~70%); Import Implemented (~75%); Billing Partial (~50%).
- **Related:** CAP-039/040/041.

## Product Intelligence Center (this module)
- **Purpose:** Read the product brain inside the app (DNA, North Star, Principles, ADRs, Modules, Governance).
- **Status:** Implemented (~70%). **Users:** owner/admin only (server-enforced).
- **Data:** `docs/product-brain` (build-bundled). **Permissions:** internal; denied to member/viewer/client.
- **Boundaries:** internal only; never client-facing; read-only (no in-app editing yet).
- **Related:** CAP-042.

---

> To deepen any module, add a file under [`capabilities/`](capabilities/) and link it here.
