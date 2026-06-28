# 25 — UX / Design Debt Log

UX and interaction-design debt — friction that is not a code regression but degrades the
experience. Tracked like the [Regression Log](10-regression-log.md). Each: description · impact ·
expected · status · protection rule.

> Governing principle (Product DNA + North Star): **once the user asks a question, the answer is
> the product. Content must win over decoration.**

---

## UX-004 — Compact Isabella Response Layout
- **Description:** The Isabella assistant panel used an oversized hologram/avatar header (a fixed
  150–200px presence block) that consumed too much vertical space and pushed generated responses
  out of view. Not a regression — it never worked well.
- **Impact:** Medium-High. The assistant looked polished but created friction: users couldn't
  immediately see the answer they asked for.
- **Expected behavior:** Before the first question, Isabella may show a larger presentation state.
  After the first response, she transitions to a **compact** state where the answer is prioritized.
- **Status: RESOLVED (2026-06-27).** Implemented three layout states in
  `src/components/isabella/isabella-experience.tsx`:
  - **State A — Idle / Welcome:** full hologram + name + role + status + suggested prompts (no
    conversation yet, `turns.length === 0`).
  - **State B — Active conversation (default once `turns.length > 0`):** compact one-line header —
    small avatar · Isabella · {mode} · {status} — so the answer renders directly below; the
    conversation area (`flex-1 overflow-y-auto`) gets priority height.
  - **State C — Manually expanded:** the user can re-expand the full hologram (chevron) without it
    hiding the current response, and collapse it again. Does not auto-expand after answers.
  - Suggested prompts only show in the idle state; quick-action chips stay below the answer (never
    above it); the input composer stays pinned at the bottom. Isabella's premium identity is
    preserved (hologram kept, just sized to context).
- **Protection rule (binding):** future Isabella UI changes **must not** allow decorative
  avatar/header elements to obscure or compete with generated answer content. The compact
  active-conversation state must be preserved.
- **Owner:** Product/UX. **Verify:** open Isabella → ask a question → the hologram collapses to a
  compact header and the answer is visible immediately; the chevron re-expands/collapses the avatar.

## UX-006 — Project Navigation Simplification
- **Description:** The project-level navigation (`ProjectTabs`, the single sticky bar that serves
  **desktop and mobile**) had grown to **13 flat tabs** (Command Center, Charter, Delivery, Team,
  Workboard, Execution Map, Labor Capacity, Resource Capacity, BIM, Project Memory, Rhythm, Status,
  Settings). Too many top-level items: horizontal overflow-scroll, no information hierarchy, strategic
  modules competing with niche ones — and the flat filter silently hid gated modules like **BIM**
  (see [REG-012](10-regression-log.md#reg-012--bim-module-missing-from-navigation)).
- **Impact:** Medium-High. A long flat menu is hard to scan, doesn't scale as modules grow, and made
  it easy to lose strategic capabilities during "cleanup."
- **Expected behavior:** A **simplified grouped** project navigation. Capabilities are organized **by
  user intent** into a small set of top-level groups, each revealing its modules in a secondary
  menu/dropdown. The menu stays scalable while **preserving access to every major module**.
- **Rule (binding):** **Navigation simplification means grouping modules by user intent, not removing
  capabilities.** The project menu must remain scalable while preserving access to all major modules.
  Simplification must never hide, orphan, or degrade a strategic module (BIM, Living Graph, Resource
  Capacity, Project Memory, …). Operational modules must not be demoted into Settings — Settings is
  for configuration/admin only.
- **Status: RESOLVED (2026-06-27).** Implemented grouped navigation in
  `src/components/layout/project-tabs-config.ts` (`TAB_GROUPS`) + `project-tabs.tsx` (group dropdowns,
  responsive). Final groups:
  - **Command Center** — Overview, Status Report.
  - **Planning** — Charter & Governance, Delivery Framework, Roadmap.
  - **Execution** — Workboard, Execution Map (Living Graph + Critical Path live inside it).
  - **Resources** — Team & Roles, Stakeholders, Resource Capacity, Labor Capacity.
  - **Intelligence** — Project Memory, Rhythm (Meetings).
  - **Technical / BIM** — BIM (Drawing Intelligence).
  - **More** — Settings.
  - `TAB_ITEMS` is preserved (derived via `flatMap`) so prior importers and the REG-011 nav test keep
    passing. Resource Capacity stays **operational** under Resources — never buried in Settings.
- **Protection rule (binding):** future project-nav changes must keep the grouped structure, keep
  strategic modules discoverable, keep Resource Capacity under Resources/People & Capacity (not
  Settings-only), and never reintroduce a flat overcrowded bar. See
  [PD-009](30-product-decision-log.md) and [REG-012](10-regression-log.md#reg-012--bim-module-missing-from-navigation).
- **Owner:** Product/UX. **Verify:** open any project → the tab bar shows the grouped top-level nav;
  each group reveals its modules; BIM appears under **Technical / BIM**; Resource Capacity appears
  under **Resources**.
