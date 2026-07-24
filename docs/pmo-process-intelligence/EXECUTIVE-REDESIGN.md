# Executive Portfolio Flow redesign

**Date:** 2026-07-23
**Flag:** `pmo_process_intelligence_dashboard` (server-side, OFF by default)
**Release state:** local implementation only; no deploy, merge or push.

## Default experience

The default Process Intelligence surface is **Flujo Ejecutivo del Portafolio**. Its dominant element is now a real interactive graph canvas built with the same engine used by the Living Graph: `@xyflow/react`, `ReactFlowProvider`, React Flow viewport/selection primitives and `@dagrejs/dagre` layout.

The organization starts with five semantic supernodes: Iniciar, Planificar, Ejecutar, Controlar and Cerrar. They are draggable, selectable, expandable and drillable. Technical events are projected into these business stages but never appear as default labels.

The canvas supports:

- Pan, wheel zoom, pinch zoom, minimap and viewport controls.
- Semantic zoom with far, intermediate, close and deep levels of detail.
- Node drag, multi-selection, hover relationship highlighting and dimming.
- Click-to-select with evidence drawer; double-click drill-down.
- Progressive expand/collapse.
- Organization → stage → project → milestone → activity navigation.
- Search/focus, Fit View, Reset Layout and fullscreen.
- Per-user, per-organization, per-view, per-layer and per-filter layout persistence.
- Keyboard focus, Enter selection, directional arrow navigation and Escape back/close.
- Accessible table fallback and reduced-motion-aware viewport transitions.

Observed stage transitions are rendered as evidence-backed edges. If an adjacent stage transition has not been observed, a thin reference edge is shown with frequency zero and explicit evidence that it is only the canonical process sequence; it never claims an observed transition.

## Progressive disclosure

At far zoom only the five stage supernodes and principal routes remain visible. At intermediate/close zoom, an explicitly expanded stage discloses authorized projects. Project views show canonical milestones; milestone views show canonical activities and recorded task dependencies. No level is fabricated.

Clicking selects without changing level. Double-click drills down. Breadcrumbs preserve the real stage/project/milestone labels even when a parent is outside the current projection. Date range, layer and project filters remain part of screen and layout scope.

The current database has no canonical portfolio, program or workstream taxonomy. The implementation therefore does **not** invent those nodes. The honest supported chain is:

`Organization → Stage → Project → Milestone → Activity`

Portfolio/program/workstream remain a declared follow-up that requires a governed source-of-truth model.

## Analytical layers

Process, Finance, Risk, Resources, Dependencies and Benefits use the same graph canvas and change edge semantics. The What-if experience remains the existing non-persistent simulation panel because it is a scenario workspace rather than observed graph truth.

## Technical view preservation

The prior event-level canvas remains intact in:

`Process Intelligence → Advanced → Technical Event Explorer`

It retains event names, variants, filters and technical evidence. The existing Living Graph behavior was not modified.

## Isabella screen context

Every visible canvas state publishes an explicit context contract containing route, mode, trusted organization, hierarchy level, layer, hover, selections, visible nodes/edges, filters, date range, viewport, current metrics, bottleneck, variant, data quality and language.

Client IDs are treated only as lookup hints. Server-side sanitization re-stamps the authenticated organization, caps payload sizes and rebuilds entities from authorized read models before Isabella answers. Deterministic conversational handling covers:

- “¿Cuántos nodos/cubos hay?”
- “¿Qué significa este?”
- “¿Cuál está peor?”
- “Abre los proyectos de ahí.”
- “¿Qué estoy viendo?”

## Known limitations

- Portfolio/program/workstream taxonomy does not exist in the current schema.
- No canonical risk or decision nodes exist in the hierarchy read model; risk remains an analytical layer rather than fabricated hierarchy.
- SLA targets and period-over-period trends remain unavailable when source data is absent.
- Benefits remain unavailable because no canonical benefit-realization model exists.
- What-if remains pure and non-persistent.
