# Living Graph interaction parity report

**Date:** 2026-07-23
**Scope:** `/[locale]/process-intelligence`
**Flag:** `pmo_process_intelligence_dashboard=false` by default
**Release:** local only; no deploy, merge, push or production data change.

## 1. Living Graph audit

| Concern | Existing Living Graph | Process Intelligence adaptation |
|---|---|---|
| Graph engine | `@xyflow/react` 12.11 | Reused |
| Viewport | `ReactFlowProvider`, `useReactFlow`, Controls, MiniMap | Reused |
| Layout | `@dagrejs/dagre` | Reused through a domain adapter |
| Node framework | Custom React Flow nodes | Adapted to stage/project/milestone/activity |
| Edge framework | Custom interactive React Flow edges | Adapted to process/finance/risk/resource/dependency/benefit semantics |
| Selection | React Flow selection + product state | Adapted with node/edge drawer state |
| Drag persistence | `graph-layout-storage.ts`, local presentation state | Reused interaction pattern; separate scoped storage contract |
| Layout controls | `LivingGraphLayoutControls` | Reused directly |
| Search/focus | React Flow viewport centering | Adapted |
| Keyboard/touch | Focusable nodes, viewport controls | Extended with Enter, arrows, Escape and pinch |
| Canonical Living Graph behavior | Protected | Not modified |

## 2. Parity matrix

| Capability | Status | Evidence |
|---|---|---|
| Pan / wheel zoom / pinch zoom | Implemented | `process-graph-viewport.tsx` |
| Semantic zoom | Implemented | `semanticZoomFor` + projection LOD |
| Node drag | Implemented | React Flow drag handlers |
| Multi-select | Implemented | Ctrl/Meta/Shift selection |
| Hover context | Implemented | Tooltips, connected-path highlight, unrelated dimming |
| Click selection | Implemented | Persistent node/edge selection + drawer |
| Double-click drill-down | Implemented | Stage → Project → Milestone |
| Expand/collapse | Implemented | Progressive disclosure; canonical children only |
| Breadcrumbs | Implemented | Organization/stage/project/milestone labels resolved outside projection |
| Context menu | Implemented | Details, focus, expand/collapse, drill, project, process map, evidence, Isabella, reset position |
| Interactive edges | Implemented | Hover/click, readable source/target, metrics and evidence |
| Search and focus | Implemented | Toolbar search + centered viewport |
| Fit / reset / fullscreen | Implemented | Toolbar |
| Saved layout | Implemented | User/org/view/hierarchy/layer/filter/date-scoped local storage |
| Keyboard | Implemented | Tab, Enter, arrows, Escape |
| Touch | Implemented | Pan and pinch through React Flow |
| Tablet/mobile shell | Implemented | Sidebar compacts automatically below 1024 px; canvas controls wrap without losing viewport access |
| Reduced motion | Implemented | Zero-duration viewport movement + transition reduction |
| Accessible fallback | Preserved | Executive table |
| Isabella context | Implemented | Explicit latest-value event contract + server sanitization |
| Portfolio/program/workstream | Blocked by canonical model | Not invented; documented gap |

## 3. Components

### Reused directly

- `ReactFlowProvider`, `ReactFlow`, `Controls`, `MiniMap`, `Background`.
- `useReactFlow`, `useNodesState`, `useEdgesState`.
- `@dagrejs/dagre`.
- `LivingGraphLayoutControls`.

### New domain components

- `ProcessIntelligenceCanvas`
- `ProcessGraphViewport`
- `ProcessStageSuperNode`
- `ProcessProjectNode`
- `ProcessMilestoneNode`
- `ProcessActivityNode`
- `ProcessGraphEdge`
- `ProcessNodeTooltip`
- `ProcessNodeContextMenu`
- `ProcessNodeDetailDrawer`
- `ProcessGraphBreadcrumbs`
- `ProcessGraphToolbar`
- `ProcessGraphLegend`
- `useProcessGraphState`
- `useProcessGraphLayout`

## 4. Security and data truth

- Hierarchy reads are organization-scoped and limited to the already authorized project IDs.
- Client screen context never grants authorization.
- The authenticated organization ID overwrites any client-provided tenant value.
- Visible entity IDs are resolved again from server-authorized projections before Isabella answers.
- Layout persistence contains coordinates and viewport only; it never writes canonical project data.
- No portfolio, program, workstream, risk, decision or event hierarchy is fabricated.

## 5. Automated results

- Focused ESLint: pass, zero findings.
- TypeScript: pass.
- Focused Vitest: 20 files, 91 tests, all pass.
- Full Vitest suite: 258 files passed, 13 skipped; 2,385 tests passed, 58 skipped.
- Production build: pass with Next.js 16.2.7.
- Dense projection guard: 201 entities and canonical dependency topology built under the 1,000 ms guard.
- React Flow uses `onlyRenderVisibleElements`; nodes and edges are memoized; hierarchy reads are capped at 500 milestones, 2,000 activities and 4,000 dependencies.

### Authenticated browser UAT

- Organization view: 5 stage nodes and 4 connections.
- Drag: passed; the node bounding box changed after pointer drag.
- Saved layout: passed; a scoped `po360.processIntelligence.layout.*` record was created.
- Expand: passed; expanding Ejecutar exposed its authorized project.
- Drill-down: passed through stage, project, milestone and activity.
- Test dataset observed: 1 expanded project, 10 project milestones and 3 activities in the selected milestone.
- Back to organization: passed; the five stages were restored.
- Tablet 768 px: compact sidebar and at least 600 px of usable canvas.
- Mobile 390 px: compact sidebar and at least 260 px of usable canvas.
- Browser console/page errors during the final interaction run: none.

### Layout benchmark

The benchmark exercises the same Dagre configuration used by the canvas. It measures the one-time structural layout, not frame rate; drag/pan do not rerun Dagre per frame.

| Graph size | Median | P95 | Maximum |
|---|---:|---:|---:|
| 50 nodes | 11.17 ms | 17.81 ms | 23.53 ms |
| 200 nodes | 39.17 ms | 52.03 ms | 54.53 ms |

## 6. Conversational acceptance

The deterministic Isabella path was exercised against the authenticated canvas:

| Prompt | Verified response |
|---|---|
| ¿Cuántos cubos hay? | “Hay 5 nodos visibles: Iniciar, Planificar, Ejecutar, Controlar, Cerrar.” |
| ¿Qué significa este? | “Estás señalando Ejecutar. La fase donde se producen entregables y se consumen recursos y costos reales.” |
| ¿Cuál está peor? | Identificó Controlar y explicó que comparó salud, retraso, riesgo, presupuesto, recursos y calidad de datos. |
| Abre los proyectos de ahí | Identificó el proyecto autorizado de Ejecutar y explicó doble clic/Expandir. |

The screen context now retains its latest in-memory value. Isabella therefore receives the canvas even when her widget subscribes after the canvas publishes its first state.

## 7. Visual evidence

- `docs/pmo-process-intelligence/evidence/01-desktop-hover.png`
- `docs/pmo-process-intelligence/evidence/02-desktop-expanded.png`
- `docs/pmo-process-intelligence/evidence/03-desktop-drilldown.png`
- `docs/pmo-process-intelligence/evidence/04-tablet.png`
- `docs/pmo-process-intelligence/evidence/05-mobile.png`
- `docs/pmo-process-intelligence/evidence/06-isabella-context.png`

## 8. Remaining risks

1. Portfolio/program/workstream drill-down cannot be completed until a canonical taxonomy exists.
2. The 50/200-node layout benchmark is green, but a true FPS trace still requires the browser Performance panel on target hardware.
3. Touch behavior passed viewport emulation; physical tablet/phone validation remains pending.
4. Benefits nodes cannot be materialized without a canonical benefits model.
5. Compare and Simulate remain available only where an evidence-safe domain action already exists; the context menu does not invent unsupported comparisons.

## 9. Release safeguards

- Feature flag remains OFF in `.env.example`.
- Current Dashboard remains available.
- Technical Event Explorer remains available.
- No behavior in the Living Graph was modified.
- No deploy, merge, push or production mutation occurred.
