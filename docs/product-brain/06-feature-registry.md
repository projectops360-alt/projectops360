# 06 — Feature Registry (Canonical)

Audited 2026-06-27. A *feature* is a concrete user-facing or engine-level behavior under a
capability. Fields per feature: Capability · Module · Status · Current impl · Expected ·
User value · Tech deps · Regression risk · Test coverage · Source files · Related ADRs · Next.

Status legend as in [00-index.md](00-index.md). **Test coverage** reflects `__tests__/`
presence only; "None" ≠ broken, it means unverified by automated tests.

---

## Living Graph (CAP-005)

| ID | Feature | Status | Test | Regression risk | Source |
|----|---------|--------|------|-----------------|--------|
| F-LG-001 | Graph render (React Flow, node/edge types) | Implemented | None | Med | `components/graph/living-graph-*` |
| F-LG-002 | Longest-path critical path approximation | Implemented | None | Med | `lib/graph/living-graph-analysis.ts` |
| F-LG-003 | Overlays (risk/rework/bottleneck/traceability/labor/variance) | Implemented | None | Med | `living-graph-analysis.ts` |
| F-LG-004 | What-if simulation (downstream impact) | Implemented | None | Med | `living-graph-analysis.ts` |
| F-LG-005 | Workforce Intelligence layer (roster, utilization, at-risk) | Implemented (restored) | None | **High** (was lost) | `lib/graph/workforce-graph-mapping.ts` |
| F-LG-006 | Executive insights panel + graph-first layout | Implemented (restored) | None | High | `components/graph/executive-summary-panel.tsx` |
| F-LG-007 | Recalculate (orphan cleanup + rebuild) | Implemented (restored) | None | Med | `execution-map/living-graph/actions.ts`, `lib/roadmap/living-graph-sync.ts` |
| F-LG-008 | Node "Blocked" indicator | **Regressed** (conflates blocked vs waiting) | None | High | `living-graph-node.tsx` — see REG-006 |
| F-LG-009 | Consume Execution Status Engine | Missing | — | — | doc 18 |

## Resource Capacity Intelligence (CAP-009)

| ID | Feature | Status | Test | Source |
|----|---------|--------|------|--------|
| F-RC-001 | Per-resource utilization/overhead/remaining table | Implemented (restored) | `lib/capacity/__tests__` | `resource-capacity/page.tsx` |
| F-RC-002 | Capacity capture editor (per-resource hours/availability/overhead) | Implemented (restored) | None | `resource-capacity/capacity-editor.tsx` |
| F-RC-003 | Weekly capacity timeline | Implemented | `lib/capacity/__tests__/formulas.test.ts` | `lib/capacity/service.ts` |
| F-RC-004 | Workforce health index + deductions | Implemented | `formulas.test.ts` | `lib/capacity/formulas.ts` |
| F-RC-005 | Capacity risks (overload/no-owner/no-estimate, at-risk milestones) | Implemented | `insight.test.ts` | `lib/capacity/insight.ts` |
| F-RC-006 | Capacity forecast | Missing | — | doc 13 |
| F-RC-007 | Burnout prediction | Missing | — | doc 13 |
| F-RC-008 | What-if reassignment / digital twin | Missing | — | doc 13 |

## Execution Truth (CAP-016/017/020-023)

| ID | Feature | Status | Test | Source |
|----|---------|--------|------|--------|
| F-EX-001 | Task readiness (predecessors/material/rfi/permit/...) | Implemented | `lib/execution/__tests__/readiness.test.ts` | `lib/execution/readiness.ts` |
| F-EX-002 | Project Health engine (schedule/budget/resources/...) | Implemented | `__tests__/health.test.ts` | `lib/execution/health.ts` |
| F-EX-003 | Critical Path (CPM) | Implemented | None found | `lib/execution/critical-path.ts` |
| F-EX-004 | Milestone computed status from tasks | Implemented | `lib/roadmap/__tests__` | `lib/roadmap/progress.ts` |
| F-EX-005 | Execution Status Engine (4 independent dimensions) | **Prototype** | None | `lib/execution/status-engine.ts` |
| F-EX-006 | Status Report | Implemented | `__tests__/status-report.test.ts` | `lib/execution/status-report.ts` |
| F-EX-007 | Dependency-aware task ordering (topo sort) | Implemented | None | `lib/roadmap` |

## Labor Capacity (CAP-010)

| ID | Feature | Status | Source |
|----|---------|--------|--------|
| F-LB-001 | Labor capacity engine (headcount/hours by trade/week) | Implemented | `lib/labor/capacity.ts` |
| F-LB-002 | Workface readiness | Implemented | `lib/labor`, `/labor-capacity/workface` |
| F-LB-003 | Lookahead | Implemented | `/labor-capacity/lookahead` |
| F-LB-004 | Crew idle risk + variance + cause classification | Implemented | `lib/labor/*` |

## Knowledge OS / Isabella (CAP-001/002/004)

| ID | Feature | Status | Source |
|----|---------|--------|--------|
| F-KO-001 | Hybrid multilingual retrieval over curated corpus | Implemented | `lib/knowledge-os/retrieval` |
| F-KO-002 | Grounded answer generation + confidence + provenance | Implemented | `lib/knowledge-os/service.ts` |
| F-KO-003 | Screen Intelligence (context-aware answers) | Implemented | `lib/knowledge-os/service.ts` (serializeContext) |
| F-KO-004 | Action links (navigable answers) | Implemented | `lib/knowledge-os/action-links.ts` |
| F-IS-001 | Isabella presence (hologram, 3D, voice, Free Mode) | Implemented | `components/isabella/*` |
| F-IS-002 | Isabella explains live execution state (Blocked vs Waiting) | Missing | doc 16/18 |
| F-AW-001 | Multi-expert AI Workforce | Partial | `lib/knowledge-os/experts` |

## People / Team / Security (CAP-028..032)

| ID | Feature | Status | Regression risk | Source |
|----|---------|--------|-----------------|--------|
| F-TM-001 | Manual team member creation | Implemented | **High** (REG-001) | `lib/team` |
| F-TM-002 | Rename/edit team members | Implemented | **High** (REG-002) | `lib/team` |
| F-TM-003 | User creation email + temp password (no SMTP) | Implemented | **High** (REG-003) | `lib/team` |
| F-TM-004 | RACI assignments | Implemented | Med | `lib/team-roles` |
| F-SEC-001 | Enforced PMO/PM/Team RBAC | **Partial/Regressed** | **High** | `lib/auth` (master permissive) |

## Other capability features (summary)

- **Project Memory (CAP-006/007/008):** capture, AI classification, vector indexing,
  linking, Scribe quick-capture — Implemented. Source: `lib/memory`, `project_memory_items`,
  `project_scribe_items`.
- **Drawing Intelligence / BIM (CAP-035):** ingest, extract, interpret, takeoff→materials,
  evidence — Partial/Implemented. Source: `lib/drawing-intelligence`, `drawing_*`.
- **Reports (CAP-024):** saved reports over curated datasets, runs/exports/schedules —
  Implemented. Source: `lib/reports`.
- **Charter & Governance (CAP-034):** charter, roles, governance rules, approval matrix,
  sign-off — Implemented. Source: `lib/charter`.
- **Adaptive Delivery (CAP-039):** framework wizard, backlog, refinement, cycles, board —
  Implemented. Source: `lib/delivery`.
- **Import Intelligence (CAP-040):** wizard, parsers, heuristic+AI extraction, rollback —
  Implemented. Source: `lib/import-intelligence`.
- **Meetings (CAP-037):** Rhythm Center (calendar + meetings) is the **canonical** module; the
  former Rythm (transcription/intelligence) surface was **consolidated** into it — `/rythm`
  redirects to `/rhythm` and the duplicate nav item was removed (REG-011, resolves DEBT-004).

> Add a `specs/` file when a feature is being designed or significantly changed.
