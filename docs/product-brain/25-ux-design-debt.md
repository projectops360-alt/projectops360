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
