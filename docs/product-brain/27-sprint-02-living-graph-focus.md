# 27 — Sprint #2: Living Graph Focus & Usability

A usability/focus improvement — **not** a data-engine refactor. The Living Graph must be the
**protagonist** of the Execution Map page; controls, KPIs, filters, legends, and insights must
**support** the graph, never compete with it ([ADR-002](adrs/ADR-002-living-graph-primary-surface.md)).

> Scope guard: this sprint does NOT redesign Variance / Timeline Playback / What-if / Risk / SOP
> semantics, and adds no new engines. Those are later sprints.

---

## Decisions (binding)
1. **The graph is the main content.** The page must not feel like a toolbar with a graph below it.
2. **Advanced controls are collapsible.** Advanced filters stay behind the "Filters" button;
   Insights and the Legend are **collapsed by default** (compact buttons that expand on click).
3. **Focus Mode** maximizes readability with minimal UI noise.
4. **Header metrics stay compact** (the `{nodes} · {edges} · {blocked} · {waiting}` strip) — no
   oversized KPI cards on the canvas.

## Implementation (2026-06-27)
- **Focus Mode** (`living-graph-view.tsx` + `living-graph-toolbar.tsx`): a new toolbar button
  (target icon) toggles an in-page focus that makes the container `fixed inset-0` (covers the page
  chrome — title/subtitle/back link), hides the long helper hints, and expands the canvas to the
  full viewport. Essential controls (the compact toolbar) stay on top; the user exits via the same
  button. Distinct from the existing browser-fullscreen button (both remain).
- **Insights & Legend** were already collapsible drawers/buttons closed by default — confirmed and
  kept (the Insights drawer is a small "Insights" badge with the health score; opens on click and
  is dismissible; it does not cover the graph by default).
- **Overlay discoverability** (lightweight, per scope): when the **Workforce** overlay is selected
  on the default **Milestones** level (where the people + assignment-edges view is not shown), a
  small non-intrusive note appears: *"Switch to the Activities view to see people and their
  assignments."* (Full overlay semantics = Sprint #3.)
- **Canvas space:** the container already uses viewport height (`100vh-120px`, `min-h 680px`); Focus
  Mode removes the page chrome to give the graph the whole viewport.

## What was intentionally NOT changed
Overlay semantics, engines, capacity/AI logic, the Workforce/Labor layers, Critical Path,
Waiting-vs-Blocked indicators, and the Sprint #1 Workboard/Roadmap changes — all intact (274 tests
green).

## Protection rule
If a control, KPI, legend, or panel competes with the graph instead of helping understand the
project, it must be collapsed, minimized, moved, or made contextual. Focus Mode must be preserved.
