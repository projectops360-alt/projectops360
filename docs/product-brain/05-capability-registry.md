# 05 — Capability Registry (Canonical)

Audited 2026-06-27 against the repo and the production database. **Implementation % is a
deliberately conservative estimate.** When unverified, status = Unknown. This registry —
not chat memory — is the source of truth for "what exists."

Status values: Implemented · Partial · Prototype · Documented · Missing · Deprecated · Regressed · Unknown.

---

## Overview table

| ID | Capability | Pillar | Status | Impl % | Owner module |
|----|------------|--------|--------|--------|--------------|
| CAP-001 | Knowledge OS | P1/P5 | Implemented | 80% | `lib/knowledge-os` |
| CAP-002 | Isabella (AI presence) | P1 | Implemented | 70% | `components/isabella` |
| CAP-003 | Living Guide | P1/P5 | Deprecated→merged into CAP-001 | 100%* | `components/living-guide` |
| CAP-004 | AI Workforce (multi-expert) | P1 | Partial | 35% | `lib/knowledge-os` (experts) |
| CAP-005 | Living Graph | P2 | Implemented | 75% | `lib/graph`, `components/graph` |
| CAP-006 | Project Memory | P5 | Implemented | 80% | `lib/memory` |
| CAP-007 | Project Memory vectorization | P5 | Implemented | 85% | `lib/embeddings`, `lib/memory` |
| CAP-008 | Project Scribe | P5 | Implemented | 80% | `lib/memory`, `components/memory` |
| CAP-009 | Resource Capacity Intelligence | P3 | Partial | 45% | `lib/capacity` |
| CAP-010 | Labor Capacity | P3 | Implemented | 70% | `lib/labor` |
| CAP-011 | Overhead | P3 | Partial | 50% | `lib/capacity` |
| CAP-012 | Workforce availability | P3 | Partial | 50% | `lib/capacity`, `lib/labor` |
| CAP-013 | Resource utilization | P3 | Implemented | 70% | `lib/capacity` |
| CAP-014 | Burnout prediction | P3 | Missing | 0% | — |
| CAP-015 | Executive Command Center | P2/P4 | Partial | 40% | `lib/command-center` |
| CAP-016 | Execution Status Engine | P4 | Prototype | 20% | `lib/execution/status-engine.ts` |
| CAP-017 | Risk Management | P4 | Partial | 50% | `risks` table, `lib/execution/health` |
| CAP-018 | Issue Management | P4 | Missing | 0% | — (only risks exist) |
| CAP-019 | WBS | P4 | Partial | 40% | `lib/execution` (universal model) |
| CAP-020 | Tasks | P4 | Implemented | 90% | `lib/roadmap` |
| CAP-021 | Milestones | P4 | Implemented | 90% | `lib/roadmap` |
| CAP-022 | Dependencies | P4 | Implemented | 85% | `task_dependencies` |
| CAP-023 | Critical Path | P4 | Implemented | 80% | `lib/execution/critical-path` |
| CAP-024 | Reports | P4 | Implemented | 70% | `lib/reports` |
| CAP-025 | Dashboards | P2/P4 | Partial | 50% | `components/roadmap`, `lib/command-center` |
| CAP-026 | Communication Intelligence | P1 | Partial | 30% | `/communications` |
| CAP-027 | Financial Intelligence | P4 | Partial | 40% | `budget_items`, `lib/execution`, `cost_library` |
| CAP-028 | Security / RBAC | P6 | Partial / Regression-risk | 50% | `lib/auth` |
| CAP-029 | People / Team Workspace | P6 | Implemented | 70% | `lib/team`, `lib/team-roles` |
| CAP-030 | Manual Team Member creation | P6 | Implemented | 80% | `lib/team` |
| CAP-031 | Rename/Edit Team Members | P6 | Implemented | 85% | `lib/team` |
| CAP-032 | User creation (email/password) | P6 | Implemented | 80% | `lib/team` |
| CAP-033 | Project Templates | P6 | Implemented | 75% | `lib/execution/templates` |
| CAP-034 | Project Charter & Governance | P6 | Implemented | 80% | `lib/charter` |
| CAP-035 | BIM / Drawing Intelligence | P2 | Partial | 55% | `lib/drawing-intelligence` |
| CAP-036 | Documents | P5 | Implemented | 75% | `/documents` |
| CAP-037 | Meetings (Rhythm Center — canonical; Rythm consolidated via REG-011) | P5 | Implemented | 70% | `lib/rhythm` (`lib/rythm` dormant) |
| CAP-038 | AI Recommendations | P1 | Partial | 45% | `lib/roadmap/recommendation`, `lib/delivery/ai` |
| CAP-039 | Adaptive Delivery Framework | P6 | Implemented | 70% | `lib/delivery` |
| CAP-040 | Project Import Intelligence | P5 | Implemented | 75% | `lib/import-intelligence` |
| CAP-041 | Billing & Entitlements | P6 | Partial | 50% | `lib/billing` |
| CAP-042 | Product Intelligence Center | P5 | Implemented | 70% | `lib/product-brain`, `/product-intelligence` |
| CAP-043 | Evidence Provenance & Traceability | P5 | Implemented (Phase 1) | 70% | `lib/provenance`, `components/provenance` |
| CAP-044 | Unified People, Roles & Stakeholder Directory | P6 | Partial (Phase 1 — read model) | 40% | `lib/people` (projection over `project_team_members` + sources) |
| CAP-045 | Living Graph Process Mining Layer | P2/P4 | Documented | 0% | — (concept only; [foundation baseline](capabilities/CAP-045-process-mining-layer-foundation-baseline.md) approved 2026-07-10 · [Risk-to-Resolution ontology](capabilities/CAP-045-process-mining-layer-ontology-risk-to-resolution.md) approved 2026-07-11) |

`*` CAP-003 is "complete" only in the sense that it was fully superseded by Knowledge OS.

---

## Detailed entries (selected; high-priority + at-risk capabilities)

> Template fields: Description · Business value · Status · Impl% · Owner/Related · Data ·
> APIs/Surfaces · Dependencies · Known gaps · Known regressions · Priority · Next action.

### CAP-005 — Living Graph
- **Description:** Visual digital twin of the project on `process_nodes`/`process_edges`;
  longest-path critical path, cycles, bottlenecks, overlays (risk, rework, traceability,
  labor, variance, workforce), what-if simulation, executive insights, Workforce layer.
- **Business value:** The primary intelligence/navigation surface (Pillar P2).
- **Status:** Implemented (75%). **Data:** process_nodes/edges, roadmap_tasks, milestones,
  capacity. **Surfaces:** `/execution-map/living-graph`, `components/graph/*`.
- **Dependencies:** CAP-009 (capacity), CAP-016 (status engine, not yet consumed), CAP-023.
- **Known gaps:** not yet the navigation layer for the whole app; does not consume the
  Execution Status Engine; node "Blocked" vs "Waiting-on-Dependency" still conflated
  (REG-006); not connected to issues/decisions/comms as first-class.
- **Known regressions:** Workforce layer + executive insights were lost on `master`, restored
  2026-06-27 (REG-005). **Priority:** High. **Next:** wire Execution Status Engine (doc 18) +
  see strategy doc 12.

### CAP-009 — Resource Capacity Intelligence
- **Description:** Real workforce capacity vs plan: nominal/effective/remaining hours,
  utilization, overhead, availability, health index, weekly capacity, capacity risks.
- **Business value:** Pillar P3 — answers "do we have capacity / who is overloaded."
- **Status:** Partial (45%). **Data:** `project_resource_allocations`, `resource_profiles`,
  `resource_workload_snapshots`, `workforce_health_scores`, `resource_availability_exceptions`.
- **Surfaces:** `/resource-capacity` (page + capacity editor). **Engine:** `lib/capacity`
  (formulas/insight/service). **Migration:** `20260812` (applied in prod).
- **Known gaps:** no forecast, no burnout, no simulation/what-if reassignment, no digital
  twin, no billable/bench/idle modeling. See recovery doc 13.
- **Known regressions:** Entire module was lost on `master`; restored 2026-06-27 (REG-004).
- **Priority:** High. **Next:** follow roadmap in doc 13.

### CAP-016 — Execution Status Engine
- **Description:** Single deterministic engine resolving 4 independent dimensions (Execution,
  Dependency, Health, Risk) for any item. Blocked requires an explicit impediment, never
  inferred from dependencies.
- **Status:** **Prototype (20%)** — `src/lib/execution/status-engine.ts` exists in the working
  tree, **not committed, not wired, no tests, no consumers.**
- **Dependencies:** CAP-017, CAP-022, CAP-023; feeds CAP-005, CAP-015, CAP-002.
- **Known gaps:** everything past the core decider. **Known regressions:** REG-006 (Blocked
  vs Waiting conflation is what this engine fixes). **Priority:** High. **Next:** doc 18.

### CAP-028 — Security / RBAC
- **Description:** Multi-tenant isolation + role-based access (PMO/PM/Team) + project isolation.
- **Status:** Partial / Regression-risk (50%). `master` runs a permissive org-context model;
  a fuller RBAC system exists on `feat/rythm` and was **not** merged.
- **Known regressions:** potential loss of enforced RBAC parity (related to REG-001..003
  investigation). **Priority:** High (security). **Next:** audit `feat/rythm` RBAC vs `master`,
  decide an ADR, reconcile. **Mark Unknown** for exact current enforcement until verified.

### CAP-014 — Burnout prediction · CAP-018 — Issue Management
- **Status:** **Missing (0%).** No code, no tables. Burnout is part of the P3 vision (doc 13);
  Issue Management is distinct from Risk Management (only `risks` exists today). Both are
  Documented-only aspirations. **Next:** spec before build.

### CAP-026 — Communication Intelligence
- **Status:** Partial (30%). `/communications` is a log (CRUD). The "intelligence" layer
  (extraction, sentiment, action detection, linking into Living Graph/Memory) is missing.
  **Next:** spec; likely should consume Knowledge OS + Project Memory.

> The remaining capabilities (CAP-001..041) are summarized in the overview table. Create a
> deep-dive file under `capabilities/` when a capability becomes the focus of work.
