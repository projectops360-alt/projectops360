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
| UX-002 | Living Graph Saved Layouts are presentation-only | **APPROVED** (test exists; contract to be formalized in `contracts.ts`) | [UX-007 / PD-008](30-product-decision-log.md) | `src/lib/graph/__tests__/graph-layout-storage.test.ts` |
| UX-003 | Navigation never hides/orphans a strategic module (BIM visible-or-explained) | **APPROVED** (test exists; contract to be formalized) | [REG-012](10-regression-log.md#reg-012) · UX-006 | `src/components/layout/__tests__/project-tabs-nav.test.ts` |
| UX-004 | Metric rollups are consistent across surfaces (terminal tasks never blockers) | **APPROVED** (test exists; contract to be formalized) | [REG-010](10-regression-log.md#reg-010) · REG-008 | `src/lib/project-rollups/__tests__/project-rollup-engine.test.ts` · `task-activity.test.ts` |
| UX-008 | Living Graph edges are explainable (task tooltip) | **APPROVED** | — (usability; reuses REG-008/010 status rules) | `src/lib/graph/__tests__/edge-task-tooltip.test.ts` |
| UX-009 | Closeout Report has dashboard prominence | **APPROVED** | [REG-015](10-regression-log.md#reg-015) | `src/components/layout/__tests__/project-tabs-nav.test.ts` (Status placement) |
| UX-010 | Closeout Report process is guided & discoverable | **APPROVED** | — (usability) | `src/lib/rhythm/__tests__/closeout-workflow.test.ts` |

> **Placeholders (UX-002/003/004)** already have executable tests guarding the behavior; they are
> listed here so the contract registry is the single index. Promote each to a full `contracts.ts`
> entry (like UX-001) when its rule is next touched — the test is the binding part, the registry row
> makes it discoverable.

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

---

## UX-008 — Living Graph Edge Task Tooltip

**Status:** APPROVED · **Reuses:** REG-008/REG-010 status rules (`task-activity.ts`).

**Principle:** Living Graph edges are **not decorative** — they are evidence. If an edge says
"3 tasks", the user must be able to see *which* 3 tasks and *what state* they are in.

**Contract (binding):**
- Hovering a milestone-connection edge (its path) **or** its task-count badge shows a read-only
  tooltip listing the tasks the connection represents, each with its current status.
- On touch, **tapping** the task-count badge toggles the tooltip; tapping outside / re-tapping closes it.
- The tooltip header shows `source → target` milestone titles and the title "Tasks between milestones".
- Status is **deterministic** and uses the same canonical rules as the rest of the product: a
  completed task with a stale `is_blocked` flag is **Done**, never Blocked (REG-008); **Waiting** is
  distinct from **Blocked**.
- It **never invents** tasks, owners, dates, priorities or statuses; missing fields are omitted.
- It is **read-only**: it must not modify graph data, dependencies, milestones, tasks, blockers, or
  rollups. No DB query and no AI call on hover.
- Long lists show the first ~7 tasks then "+N more tasks".

**Implementation:** task list attached to milestone-chain edges in
`src/lib/graph/living-graph-analysis.ts` (`edge.metadata.taskList`); pure helpers in
`src/lib/graph/edge-task-tooltip.ts`; rendered by `MilestoneChainEdge` in
`src/components/graph/living-graph-edge.tsx`. Protected by
`src/lib/graph/__tests__/edge-task-tooltip.test.ts`.

---

## UX-010 — Closeout Report process is guided & discoverable

**Status:** APPROVED.

**Principle:** A report page must not only say what is missing — it must **guide** the PM through the
process. The Closeout Report answers: *what is missing · where do I fix it · where do I run the
closing meeting · when can I generate the narrative · when can I download the final report*.

**Contract (binding):**
- The Closeout Report page shows a **guided workflow** (6 steps): check readiness → resolve
  requirements → Closing Project meeting → generate AI executive summary → review → download PDF.
- It shows a **single primary CTA appropriate to the current state**: *Create Closing Project
  Meeting* (no meeting) · *Open Closing Project Meeting* (scheduled) · *Generate Executive Summary*
  (meeting completed, no narrative) · *Download PDF* (report ready). Download PDF is **secondary**
  while the report is not ready and is never the only prominent action.
- **Pending readiness requirements are actionable**: each failing check links to the real route that
  resolves it (open tasks/blockers → Workboard, risks/milestones → Execution Map, decisions →
  Decisions, follow-ups → Communications, budget → Budget). No fabricated routes.
- The **Closing Project meeting runs in Project Memory → Rhythm Center** (`/rhythm`); the page routes
  the user there. The **AI narrative is generated only when the closing meeting is completed**;
  Download PDF exports, it does not generate.
- **States:** not_started · readiness_incomplete · ready_for_closing_meeting · meeting_scheduled ·
  meeting_completed · report_ready · exported, shown as a badge.
- **RBAC:** generating the narrative requires PMO/PM/member (not viewer).

**Implementation:** state machine in `src/lib/rhythm/closeout-workflow.ts` (pure); on-demand
generation `src/app/.../closeout/actions.ts` (`generateCloseoutNarrativeAction`, allowlisted by
role); UI in `closeout-client.tsx`; closing-meeting status loaded in `closeout/page.tsx`. Protected
by `src/lib/rhythm/__tests__/closeout-workflow.test.ts`.
