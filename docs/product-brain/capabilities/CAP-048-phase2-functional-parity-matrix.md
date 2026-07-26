# CAP-048 Phase 2 — PMO Intelligence Center: functional parity matrix

**Milestone 1 deliverable — audit and contracts. No UI written yet.**
Extends [CAP-048](CAP-048-pmo-portfolio-living-graph.md). Decision record: ADR-012.

Dashboard 3 becomes the PMO's operational brain by **orchestrating** what
Dashboards 1 and 2 already compute — not by recomputing it. This document is the
audit that has to exist before any of that is wired, because the failure mode
here is not a broken screen: it is a second definition of "portfolio health"
that quietly disagrees with the first.

---

## 0. Method and status

Every row below was verified by reading the implementation, not inferred from
naming. Three states are used and they mean exactly this:

- **REUSE** — call the existing function. No new logic, no new query.
- **EXTRACT** — logic exists but is trapped inside a component; lift it to a
  service that both dashboards call. Requires characterization tests first.
- **GAP** — the mock shows it, the codebase does not have it. Documented, not
  simulated (prompt rule 18).

---

## 1. Dashboard 1 — PMO Command Center

Single entry point: `getCommandCenterSummary(orgId, locale)` in
`src/lib/command-center/service.ts`. Reads 13 tables in parallel, computes
deterministically, returns `CommandCenterData`. **No LLM at runtime.** Every
click in this dashboard is navigation — there is not one server action in it.

| Functionality | Component | Service / query | Data source | Formula (verbatim) | Action | Destination in D3 | Parity criterion |
|---|---|---|---|---|---|---|---|
| Portfolio health (overall) | `page.tsx:105-127` HealthRing | `service.ts:150` | 7 tables | `clamp(Σ dimension scores / n)` | — | **REUSE** `getCommandCenterSummary` | Identical score for same org |
| — Schedule | `page.tsx` dims | `service.ts:136` | roadmap_tasks | `clamp(100 − pct(blocked,total)*1.2 − pct(overdue,total)*1.0)` | — | REUSE | Exact match |
| — Budget | idem | `service.ts:137` | budget_items | `clamp(100 − max(0,variancePct)*4 − pct(overrun,total)*score)` | — | REUSE | Exact match |
| — Resources | idem | `service.ts:138` | resources, roadmap_tasks | `clamp(100 − pct(unassigned,open)*0.6 − unavailable*8)` | — | REUSE | Exact match |
| — Materials | idem | `service.ts:139` | material_requirements | `clamp(100 − pct(problem,total)*1.5)` | — | REUSE | Exact match |
| — Risk | idem | `service.ts:140` | risks | `clamp(100 − high*12 − (open−high)*3)` | — | REUSE | Exact match |
| — Critical path | idem | `service.ts:141` | roadmap_tasks | `clamp(100 − pct(blockedCritical,critical)*1.5)` | — | REUSE | Exact match |
| KPI: active projects | `page.tsx:91` | `service.ts:159` | projects | `count(status ∈ {active,planning})` | → `/projects` | REUSE + graph focus | Same number |
| KPI: blocked tasks | idem | `service.ts:160` | roadmap_tasks | `count(hasActiveBlocker(t))` | → report | REUSE + highlight chains | Same number |
| KPI: critical path risks | idem | `service.ts:161` | roadmap_tasks | `blockedCritical + count(critical ∧ slack ≤ 3)` | → report | REUSE | Same number |
| KPI: budget variance | idem | `service.ts:162` | budget_items | `((fcTotal − estTotal) / estTotal) × 100` | → report | REUSE → Finance lens | Same % |
| KPI: PM decisions | idem | `service.ts:163` | decisions | `count(status = 'proposed')` | → `/projects` | REUSE | Same number |
| Today's PMO focus | `page.tsx:129-153` | `service.ts:166-174` | multi | Deterministic rules, max 3 blockers + 4 conditionals | navigation | **REUSE** verbatim | Same items, same order |
| AI Operator briefing | `page.tsx:157-181` | `service.ts:176-181` | multi | 3 deterministic rules with fixed confidences (0.82/0.9/0.88) | navigation | REUSE | Same recommendations |
| Critical path monitor | `page.tsx:183-204` | `service.ts:183-195` | roadmap_tasks | Picks project with most critical tasks, `slice(0,8)` | → workboard | **REUSE** → bottom drawer | Same list |
| Decision queue | `page.tsx:206-223` | `service.ts:197-202` | decisions | `pendingDecisions.slice(0,6)` | → decisions page | REUSE | Same list |
| Resource & labor capacity | `page.tsx:225-243` | `service.ts:204-215` | resources | ⚠️ **Heuristic**: `assigned > 0 ? min(140, 50 + assigned*18) : null` | read-only | REUSE, **but see §5** | Same number, flagged |
| Material & procurement risk | `page.tsx:245-271` | `service.ts:219-226` | material_requirements | `needs_review ∨ status ∈ {planned,…,unavailable}` | → execution map | REUSE | Same list |
| Living Graph signals | `page.tsx:273-288` | `service.ts:232-235` | process_nodes/_edges | Raw counts | — | Superseded by the graph itself | — |
| Upcoming 14 days | `page.tsx:290-308` | `service.ts:239-244` | milestones, roadmap_tasks | `target_date ∈ [today, today+14]` | navigation | REUSE | Same list |
| Budget & forecast signals | `page.tsx:310-328` | `service.ts:247-255` | budget_items | `forecast − estimated`, sorted desc | → status | REUSE → Finance lens | Same list |
| Recent activity | `page.tsx:332-349` | `service.ts:258-261` | audit_logs | Last 12 | — | Optional | — |
| Import / Ask AI / Report | `page.tsx:397-399` | — | — | — | Links | **REUSE** flows §6 | Same flows |

**Permissions**: org-level only (`getOrgContext()`); every query `.eq("organization_id", …)`.

---

## 2. Dashboard 2 — Process Intelligence (CAP-047)

| Functionality | Component | Loader | Data source | State | Destination in D3 |
|---|---|---|---|---|---|
| Breadcrumbs (Org→Stage→Project→Milestone) | `process-graph-breadcrumbs.tsx:6` | — | — | ✅ Complete | D3 has its own (CAP-048 §navigation) |
| Filter: project | shell | `read-model.server.ts` | `project_event_log.project_id` | ✅ Complete | **REUSE** |
| Filter: portfolio / program | UI present | — | — | ❌ **GAP** — no table | §4 |
| Filter: date range | `process-canvas.tsx:86` | localStorage | — | ⚠️ **Partial** — UI only, does **not** reach the read model | §4 |
| Lens: Process | `ProcessCanvas` | `read-model.server.ts:56` → `buildFlowModel()` | `project_event_log` | ✅ Complete | **REUSE** |
| Lens: Risk | `RiskPanel` | `overlays-read.server.ts:45` | risks + task_dependencies (BFS) | ✅ Complete | **REUSE** |
| Lens: Finance | `FinanceOverlay` | `financial-read.server.ts:15` | `financial_project_cockpit` | ✅ Complete | **REUSE** |
| Lens: Resources | `ResourcesPanel` | `overlays-read.server.ts:84` → `computeResourceCapacity()` | project_resource_allocations | ✅ Complete | **REUSE** |
| Lens: Dependencies | `DependenciesPanel` | `overlays-read.server.ts:52` | task_dependencies | ✅ Complete | **REUSE** |
| Lens: Benefits | `BenefitsPanel:220` | — | — | ❌ **GAP** — honest placeholder, "no benefits/strategic-objective data model yet" | §4 |
| What-if | `WhatIfPanel` | `whatif.ts:76` `simulateWhatIf()` | pure function | ✅ Complete, **non-persistent by design** | **REUSE** as-is |
| Cycle time | — | `flow-projection.ts:46` | PEG | `Σ(occurredAt_end − occurredAt_start) / cases` | REUSE |
| Rework % | — | `command-center-shell.tsx:85` | flow model | `(rework edges / total edges) × 100` | REUSE |
| Bottleneck score | — | `flow-projection.ts:74` | flow model | `normalized(avg_incoming_wait × frequency)`, threshold ≥ 0.7 | REUSE |
| Search / focus / LOD | `process-graph-toolbar.tsx:43` | — | — | ✅ Complete | D3 has its own |
| Save / restore layout | `process-graph-layout-storage.ts` | localStorage | key `pmo-pi-view:{orgId}:{level}` | ✅ Complete | D3 has its own (`pmo_graph_views`) |
| Isabella insights (6 rules) | `IsabellaPanel` | `insights.ts` | read models | ✅ **Deterministic, no LLM**; 100 % evidence enforced by test | **REUSE** |
| Accept / Reject / Defer | `isabella-panel.tsx` | **`recordInsightFeedbackAction`** (`actions.ts:43`) | persists to **`audit_logs`** | ✅ Complete | **REUSE the action verbatim** |
| Open in map | `isabella-panel.tsx:124` | `insight.openInMapActivities` | — | ✅ Partial (only bottleneck/rework carry ids) | REUSE + extend |
| Evidence package | — | `PmoPiEvidencePackage` | formulas, projections, quality, timestamps | ✅ Complete | **REUSE** |
| Realtime | `RealtimeRefresh` | `getPmoPiSignatureAction` | `count + max(sequence_number)` | ✅ **Polling**, 20 s → 120 s backoff. **No websockets** | See §7 |

---

## 3. Dashboard 3 — current state (CAP-048 Phase 1)

Already built, tested (103 tests), and **not** to be rebuilt: hierarchical
navigation with isolation, pan/zoom/drag, persisted positions, search, filters,
focus mode, find path, blast radius 1–3 hops, critical nodes with explanation,
orphan nodes, shared resources, cross-project dependencies, provenance per edge,
Isabella query contracts (`isabella-contracts.ts`), org isolation, and
`pmo_graph_views` / `pmo_graph_declared_edges` with RLS.

**Phase 2 adds orchestration around it. It does not replace it.**

---

## 4. Gaps — shown in the mock, absent in the codebase

Rule 18: document, never simulate.

| Mock element | Reality | Phase 2 behaviour |
|---|---|---|
| **Portfolio filter** | No `portfolios` table. `project_event_log.portfolio_id` exists but is unpopulated. | Control renders **disabled** with "not configured", or is omitted. Never a fake dropdown. |
| **Program filter** | No `programs` table. | Same. |
| **Benefits lens** | No benefits / objectives data model. `kpi_definitions` exists but is not linked to deliverables. | Keep D2's honest placeholder. |
| **Date range** | UI exists in D2 but **never reaches the read model**. | Either wire it end-to-end or disable it. A filter that silently does nothing is worse than no filter. |
| **"Blocked days"** | No engine computes days-in-blocked-state. Needs a pass over `project_event_log` transitions. | Currently `unavailable`. Either build the pass (deterministic, feasible) or keep it honest. |
| **Phase / Deliverable / Issue / Objective / Supplier nodes** | No tables (CAP-048 §2). | Out of the graph. |

---

## 5. Two capacity engines — do not add them together

The single most dangerous integration in this work.

| | Generic engine | Labor / construction engine |
|---|---|---|
| File | `src/lib/capacity/service.ts` + `formulas.ts` | `src/lib/labor/capacity.ts` |
| Unit | **hours** | **headcount** |
| Input | `project_resource_allocations`, task estimates | `labor_resources`, `construction_activities` |
| Output | utilization %, overallocated hours, health index | weekly headcount gap, shortage risk |
| Scope | all project types | construction only |

They answer different questions in different units. D3 must select the engine by
project type and **label which one produced each number**. Summing them, or
showing them in one column, produces a figure that means nothing.

D1's own resource card uses **neither**: it is a heuristic
(`min(140, 50 + assigned*18)`). D3 must not present that number as capacity
without saying so — or better, should call the real engine instead.

---

## 6. Cross-cutting capabilities to reuse

| Capability | Entry point | Persists to | Notes |
|---|---|---|---|
| Isabella context | `askIsabella({query, entity})` → `isabella:ask` event | session | Send a **minimal subgraph**, never the whole graph |
| Evidence / provenance | `getEntityProvenance()`, `getProjectProvenanceSummary()` | provenance tables | Viewers do **not** get excerpts (RBAC) |
| Import | 7 server actions, `executeImportAction` | `project_import_*` | Recomputes critical path; must `revalidatePath` |
| Reports | `runReport(config, ctx)` | `saved_reports` | Accepts scope + filters — invocable programmatically |
| Realtime | `createLivingGraphRealtimeEngine()`, `decideLivingGraphSync()` | — | Supports **delta-sync**; noop / apply_delta / full_resync |
| Critical path | `calculateCriticalPath()` (pure), `recalculateCriticalPath(org, project, trigger)` | roadmap_tasks + snapshot | **Never write a second CPM** |
| Canonical metrics | `task-activity.ts` (`hasActiveBlocker`, `isTerminalStatus`, …) | — | **REG-010 / ADR-006: mandatory.** A terminal task is never a blocker |
| URL state | `searchParams` + `useSearchParams()` | query string | No systematic compound-filter pattern exists yet — D3 establishes it |

---

## 7. Realtime — the two mechanisms are different

D2 **polls** a cheap signature (`count + max(sequence_number)`) every 20 s with
exponential backoff, pausing on `document.hidden`. The LGRE is a **delta-sync
engine** with versioned deltas and a fallback ladder.

D3 should use the LGRE (it preserves layout and viewport, which polling +
`router.refresh()` does not) and must not open a second subscription to the same
topics. Duplicate subscriptions are the likeliest source of cross-org leakage
and of the layout being destroyed on every tick.

---

## 8. Architecture — `PmoIntelligenceReadModel`

```
src/lib/pmo-intelligence/            ← new orchestration layer
  scope.ts            Shared scope contract (org, projects, dateRange, lens)
  read-model.server.ts Composes the three sources. NO new formulas.
  lens-projection.ts   Scope + lens → graph projection (pure)
  kpi-bindings.ts      KPI → lens + node selection (pure)
  evidence-bridge.ts   PmoPiEvidencePackage ⇄ GraphEvidenceRef (pure)
  commands.server.ts   Re-exports existing actions. Defines none.
```

Composition, explicitly:

```
getCommandCenterSummary()  ─┐
loadPmoPiFlowModel()        │
loadPmoPiFinanceOverlay()   ├─→ PmoIntelligenceReadModel ─→ graph projection
loadPmoPiOverlays()         │      (normalise only)              + KPIs
loadPortfolioGraph()        │                                    + health
buildInsights()            ─┘                                    + insights
```

**Hard rule: this layer computes no metric of its own.** It calls, normalises
and correlates. Any new number needs a new row in this matrix and an ADR entry.

State lives in one place (`usePmoIntelligenceScope`), mirrored to the URL:
`organizationId, projectIds, dateRange, activeLens, selectedNodeIds,
focusedNodeId, selectedEdgeId, pathSource, pathTarget, impactDepth, filters,
expandedClusters, layoutId, evidenceId, drawerState`. One scope change updates
every panel — no panel keeps a private filter.

---

## 9. Milestone plan

| M | Scope | Exit criterion |
|---|---|---|
| 1 | **This document** + ADR-012 + characterization tests | D1/D2 behaviour pinned by tests ✅ |
| 2 | `PmoIntelligenceReadModel`, scope, adapters, evidence bridge | Composed numbers equal source numbers |
| 3 | Coordinated state, global filters, lenses, URL, realtime | One scope change updates everything |
| 4 | Graph integration: lenses reproject the same canvas | No lens navigates away |
| 5 | Dashboard parity: KPIs, health, focus, critical path drawer | Every D1/D2 number reproduced |
| 6 | Isabella + evidence + accept/reject/defer | Actions persist via the existing action |
| 7 | Security, performance, regression, mock comparison | Full suite green, no regressions |

---

## 10. Risks

1. **Metric divergence** — the reason this layer computes nothing. Mitigated by
   tests asserting D3's number equals the source function's number.
2. **Capacity engine confusion** (§5) — mitigated by labelling the engine.
3. **Duplicate realtime subscriptions** (§7).
4. **Sending the whole graph to Isabella** — must be a minimal subgraph.
5. **Scope creep into the gaps** (§4) — building portfolios/programs/benefits is
   a data-model project, not a dashboard one.
