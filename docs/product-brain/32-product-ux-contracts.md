# 32 — Product UX Contracts

> **Approved UX decisions that must not be silently reverted.** A Product UX Contract is a binding,
> immutable-by-default agreement about how a surface behaves. Unlike general UX debt (doc 25), a
> contract is **APPROVED** and protected by **code-level constants + automated tests**, so a future
> refactor cannot quietly overwrite it. If a contract must change, that is an explicit Product
> Decision (doc 30) — never an accident.

**Authority:** a Product UX Contract overrides ad-hoc UI changes. Code source of truth:
`src/lib/product-ux-contracts/contracts.ts`. Tests: `src/lib/product-ux-contracts/__tests__/**`.

| Contract | Title | Status | Guards | Source |
|----------|-------|--------|--------|--------|
| UX-001 | Isabella Welcome Hero Lifecycle | **APPROVED** | [REG-014](10-regression-log.md#reg-014) | `contracts.ts` · `isabella-welcome-hero.test.ts` |

---

## UX-001 — Isabella Welcome Hero Lifecycle

**Status:** APPROVED · **Guards:** REG-014 · **Also relates to:** UX-004 (compact layout), REG-013
(Project Health Briefing).

**Principle:** the Isabella avatar is a **welcome affordance, not permanent workspace chrome.** Once
Isabella has something useful to say, the content wins. A Project Briefing is active content.

**Contract (binding):**
- Show the full Welcome Hero **only** in the empty first-load state.
- Collapse the Welcome Hero after the first user interaction.
- Collapse the Welcome Hero when a Project (or Portfolio) Briefing is generated.
- Collapse the Welcome Hero when any assistant content exists.
- Collapse the Welcome Hero when any conversation message exists.
- Animate the collapse smoothly (**250–350ms**); honor `prefers-reduced-motion` (state still wins).
- During active content/conversation, show only the **compact Isabella header (≤70px)**.
- The full hero **must not reappear automatically** during the same active conversation.
- The full hero may return **only** on New Conversation, Reset Isabella, or empty history — or by an
  explicit user re-expand (UX-004), which is user-initiated, never automatic.
- A Project Briefing counts as active assistant content.
- Saving/reloading UI state must not restore the full hero when active content exists.

**State machine (`resolveIsabellaLayoutState`):**
- `EMPTY_WELCOME` — no turns, no briefing, not pending, empty input.
- `ACTIVE_CONTENT` — any of: a briefing is active, ≥1 turn, a pending request, or the first typed
  character. → compact header (unless the user manually re-expanded the avatar).

**Implementation:** `src/lib/product-ux-contracts/contracts.ts` (rule) → consumed by
`src/components/isabella/isabella-experience.tsx` (full hero in `.heroWrap`, CSS-collapsed when
active). **Do not** re-derive the rule inline; import it so there is one source of truth.

**The regression to never reintroduce:** a large avatar/hero stacked above a Project Briefing or an
active conversation.
