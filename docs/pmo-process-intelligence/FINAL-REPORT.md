# PMO Process Intelligence Command Center — implementation report

**Date:** 2026-07-23
**Branch:** `codex/pmo-process-intelligence-command-center`
**Flag:** `pmo_process_intelligence_dashboard` — OFF by default
**Release state:** local only; no deploy, merge or push.

## 1. Outcome

The Process Intelligence Beta now uses a true interactive canvas instead of a static executive SVG. It reuses the Living Graph stack (`@xyflow/react`, React Flow viewport primitives, `@dagrejs/dagre` and shared layout controls) while keeping the existing Living Graph unchanged.

The current PMO Command Center remains available through the protected **Current Dashboard | Process Intelligence Beta** switcher. The Technical Event Explorer remains available under **Advanced**.

## 2. Interaction delivered

- Pan, wheel zoom, pinch zoom, minimap and zoom controls.
- Far/intermediate/close/deep semantic zoom.
- Draggable nodes and user-scoped saved layouts.
- Node/edge hover, relationship emphasis and unrelated-node dimming.
- Click selection, Ctrl/Meta/Shift multi-selection and evidence drawer.
- Expand/collapse and double-click drill-down.
- Organization → Stage → Project → Milestone → Activity navigation.
- Breadcrumbs, search/focus, Fit View, Reset Layout and fullscreen.
- Context menu and individual node-position reset.
- Keyboard Tab/Enter/arrows/Escape behavior.
- Reduced-motion-aware viewport changes and accessible table fallback.

## 3. Data truth

The hierarchy adapter reads only already-authorized projects and canonical `milestones`, `roadmap_tasks` and `task_dependencies`. Layout persistence stores presentation coordinates and viewport only.

The schema does not contain canonical portfolio, program or workstream taxonomy. Those levels are not invented. The supported hierarchy is explicitly:

`Organization → Stage → Project → Milestone → Activity`

Stage-to-stage reference edges are shown only when no adjacent transition was observed; frequency remains zero and the evidence labels them as reference sequence, not observation or causality.

## 4. Isabella

The canvas publishes route, mode, trusted organization, hierarchy, active layer, hover, selections, visible nodes/edges, date range, filters, viewport, metrics, bottleneck, variant, quality and language.

The publication channel retains the latest in-memory screen context. This closes the mount-order race where Isabella could subscribe after the canvas emitted its first state and fall back to generic Process Mining knowledge.

Server-side sanitization:

- Re-stamps the authenticated organization.
- Rejects client-provided portfolio/program claims.
- Caps IDs and payload sizes.
- Rebuilds visible entities from authorized server projections.
- Uses client IDs only as lookup hints.

Deterministic handling exists for node count, hovered-node meaning, worst visible node, opening projects from a stage and explaining the current view.

## 5. Validation

- Focused ESLint: pass with zero findings.
- TypeScript: pass.
- Focused Vitest: 20 files, 91 tests, all pass.
- Full Vitest suite: 258 files passed, 13 skipped; 2,385 tests passed, 58 skipped.
- Next.js production build: pass.
- Dense projection test: 201 entities under a 1,000 ms guard.
- Authenticated browser UAT: drag, save, expand, stage/project/milestone drill-down, back navigation, tablet and mobile canvas visibility all passed.
- Isabella conversational UAT: node count, hovered/selected-node meaning, worst visible node and open-projects intent all returned authorized screen-grounded answers.
- Dagre layout benchmark: 50 nodes 11.17 ms median / 17.81 ms P95; 200 nodes 39.17 ms median / 52.03 ms P95.

## 6. Files and evidence

- Canvas: `src/components/pmo-process-intelligence/process-intelligence-canvas.tsx`
- Graph components: `src/components/pmo-process-intelligence/graph/`
- Projection: `src/lib/pmo-process-intelligence/process-graph.adapter.ts`
- Contracts: `src/lib/pmo-process-intelligence/process-graph.types.ts`
- Hierarchy read model: `src/lib/pmo-process-intelligence/hierarchy-read.server.ts`
- Layout persistence: `src/lib/pmo-process-intelligence/process-graph-layout-storage.ts`
- Isabella context: `src/lib/isabella/screen-context-event.ts`
- Isabella server grounding: `src/lib/pmo-process-intelligence/process-graph-assistant.server.ts`
- Detailed parity matrix: `docs/pmo-process-intelligence/LIVING-GRAPH-PARITY-REPORT.md`
- UAT: `docs/pmo-process-intelligence/UAT-plan.md`
- Visual sequence: `docs/pmo-process-intelligence/evidence/01-desktop-hover.png` through `docs/pmo-process-intelligence/evidence/06-isabella-context.png`

## 7. Remaining UAT risks

- Browser FPS on target hardware needs a Performance-panel trace; the structural-layout benchmark is documented.
- Tablet/phone viewport emulation passed; physical-device touch confirmation remains pending.
- Portfolio/program/workstream require a canonical model before implementation.
- Benefits need a canonical realization model.

## 8. Safeguards confirmed

- Feature flag remains OFF in `.env.example`.
- Current dashboard is preserved.
- Living Graph behavior is unchanged.
- No schema migration was introduced by this correction.
- No deploy, merge, push or production mutation occurred.
