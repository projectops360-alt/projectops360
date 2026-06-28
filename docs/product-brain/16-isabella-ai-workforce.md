# 16 — Isabella & the AI Workforce

Capabilities: CAP-002 (Isabella), CAP-004 (AI Workforce) · Pillar P1 ·
Ratified by [`ADR-005`](adrs/ADR-005-isabella-primary-ai-interface.md).

## Intent
**Isabella** is the primary, app-wide face of the AI workforce: a presence that explains,
recommends, and (eventually) acts — always grounded in Knowledge OS (ADR-004) and the project's
deterministic engines (ADR-006).

## Current implementation (audited)
- **Isabella presence — Implemented (~70%):** floating hologram window (drag/dock/resize), 3D
  presence (React Three Fiber + procedural fallback), real voice (TTS, female es/en), immersive
  stage, **Free Mode** (zero-cost daily presence), Character Bible, navigable action-link
  answers. Source: `components/isabella/*`. PRs #13–#22 on `master`.
- **Answers:** routed through Knowledge OS (doc 15) with Screen Intelligence.
- **AI Workforce (multi-expert) — Partial (~35%):** persona/expert scaffolding exists in
  `lib/knowledge-os/experts`; Isabella is the default and currently primary expert.

## Key gap (ties to ADR-006 / doc 18)
Isabella does **not yet explain live execution state.** The intended behavior:
- *"Why is this phase blocked?"* → if status == Waiting on Dependency, Isabella must say: "This
  phase is not blocked. It is waiting for its predecessor activities to finish. No impediments
  have been recorded; execution will continue automatically once those dependencies complete."
- If status == Blocked, she must explain the exact recorded impediment.

This requires the Execution Status Engine (doc 18) to feed Isabella the deterministic
explanation for the focused entity/node.

## UX / Layout — Content wins ([UX-004](25-ux-design-debt.md))
The Isabella panel (`components/isabella/isabella-experience.tsx`) has three layout states:
**A — Idle** (full hologram + name/role/status + suggested prompts), **B — Active** (compact
one-line header once a question is asked, so the answer is immediately visible and the conversation
area gets priority height), **C — Expanded** (user can re-show the hologram without hiding the
response). **Binding rule:** decorative avatar/header elements must never obscure or compete with
generated answer content. Resolved 2026-06-27.

## Isabella Layout Lifecycle (UX-001 · REG-014 — binding)
Isabella has **two major layout states**, governed by the Product UX Contract **UX-001**
([doc 32](32-product-ux-contracts.md)) — the rule lives in
`src/lib/product-ux-contracts/contracts.ts` and is consumed by the panel, so it has one source of
truth and is protected by tests.

1. **Empty Welcome State** — the full Welcome Hero (large avatar + name + "Product Intelligence
   Expert" + "Grounded in Product Intelligence" badge + presence). Allowed **only** when there is no
   active content: no turns, no briefing, not pending, empty input.
2. **Active Content State** — a **compact header (≤70px)** with the conversation/briefing immediately
   beneath. Triggered by ANY active content: a **Project Briefing** (which counts as active
   assistant content), a conversation turn, a pending request, or the first typed character.

The active conversation starts when the user interacts **OR when Isabella generates a briefing
automatically.** The large avatar is a **welcome affordance, not permanent chrome** — the compact
header is required the moment Isabella is useful, and the content must be readable immediately. The
hero is always mounted but **CSS-collapses smoothly (~300ms, honors `prefers-reduced-motion`)**; on
first load with a briefing it mounts already-collapsed so the hero never flashes or stacks above
content. The full hero returns only on New Conversation / Reset / empty history, or by an explicit
user re-expand (UX-004). **The regression to never reintroduce (REG-014):** a large avatar stacked on
top of a Project Briefing or active conversation.

## Project Health Briefing (REG-013)
Inside a project, **Isabella does not wait passively.** When she is opened in a project context she
proactively shows a **Project Health Briefing** answering, from evidence only: *"How is my project
doing? What should I pay attention to? What should I do next?"*

**Behavior (binding):**
- Isabella **detects project context** from the route (`/projects/{id}/…`); the projectId is
  derived client-side in `enrichContextWithScreen` (`lib/knowledge-os/screens.ts`) and carried on
  the guide context. Outside a project she keeps the generic guide prompt
  ("What are you trying to accomplish today?").
- On open she fetches a **deterministic** briefing — no AI call on load. Source of truth:
  `lib/project-briefing/{briefing-engine,service}.ts`, which **reuses the canonical engines**
  (`project-rollup-engine.ts` (REG-010), `roadmap/progress.ts`, and the `task-activity.ts` blocker
  rules) so the briefing **agrees with every other surface**.
- The briefing is **grounded in runtime project data and deterministic engines** and **must not
  invent** blockers, risks, owners, dates, overdue status, capacity values, critical-path impact,
  Project Memory entries, or recommendations. If data is missing it says so (`dataGaps`); if the
  project has no problems it says it looks **stable**.
- **Blocked vs Waiting are reported separately** (ADR-006 / REG-006/008); completed/terminal tasks
  **never** appear as active blockers (REG-008/010).
- It distinguishes **project data** (these counts) from **Product Brain rules** (how the product
  works), and shows **where to verify** each finding (Workboard, Living Graph, Resource Capacity,
  Project Memory, Status Report).
- **Refresh briefing** re-runs the deterministic load; **Dismiss** hides it for the current
  **session only** (`sessionStorage`), never permanently.
- **RBAC:** the org role maps to a briefing **scope** — owner/admin → full; member →
  execution-focused (no sensitive capacity/personnel or governance detail); viewer → external-safe
  summary. Sensitive capacity/personnel data, unresolved follow-ups, and Resource Capacity links
  are withheld from external scope.

**Sections:** Overall status · What looks good · Needs attention · Recommended next actions (top 3)
· Verify in app. Implemented in `components/isabella/project-briefing.tsx`, rendered by
`isabella-experience.tsx` above the generic prompt when a project context exists.

### Closeout & risk context ([REG-016](10-regression-log.md) / [REG-017](10-regression-log.md#reg-017))
- The Closeout Report is a first-class **Screen-Intelligence** surface (`lib/knowledge-os/screens.ts`,
  project sub-route matching), so Isabella knows the user is on Closeout, names its real components
  (readiness gate, "Risks resolved" row with inline open-risk list), and offers closeout-specific
  follow-ups ("Which requirements are blocking closeout?", "Show me the open risks blocking closeout").
- **She must not simply repeat the closeout count.** The record-backed criterion gives her the open
  count **and** the risk IDs/titles; her explanation is deterministic via
  `isabellaCloseoutRiskExplanation` (`lib/rhythm/closeout-criteria.ts`):
  - count > 0 and records present → *"Closeout is not ready because N open risks remain (…titles). You
    can resolve them from the 'Risks resolved' row, which lists those exact risks."*
  - **count ≠ records → she flags a DATA INCONSISTENCY**, never asserts the number as fact: *"Closeout
    shows N open risks, but I cannot find the matching risk records — this looks like a data
    consistency issue between Closeout and Risk Management."*
  - no permission to see records → permission-safe answer (count only, no titles).
- Isabella distinguishes **execution health** (briefing) from **closeout readiness** (the gate) from
  **risk registry state** (the records) — three separate dimensions, never conflated.

### Portfolio Health Briefing (PMO)
Symmetric to the per-project briefing, but **org-wide for the PMO**. When Isabella opens **outside a
project** for an **owner/admin (PMO)** she proactively summarizes the whole portfolio: overall
health, what looks good, what needs attention (blocked critical-path work, active blockers, at-risk
milestones, high-impact risks, overdue, unassigned, pending decisions), the **projects that need
attention most** (ranked, each with a drill-in link), the top recommended actions, and verify links
(Command Center, Reports, Projects). Same guarantees: **deterministic** (reuses `task-activity.ts` +
`roadmap/progress.ts`, agrees with the Command Center), **no AI on open**, no hallucination, Refresh
+ session Dismiss. Members/viewers do **not** receive the portfolio briefing (PMO scope). Code:
`lib/portfolio-briefing/*` + `components/isabella/portfolio-briefing.tsx`. The PM gets project help;
the PMO gets the same help one level up.

**Protection rule (binding):** future Isabella UI, mode, Product Brain, or layout changes **must not
remove** the project-aware automatic briefing behavior. See [REG-013](10-regression-log.md#reg-013).

## Next actions
1. Pipe the Execution Status Engine's explanation into Isabella's context for the focused node.
2. Living Graph node → "ask Isabella" wired to that explanation.
3. Grow the multi-expert roster on the shared Knowledge OS substrate.
4. Enrich the briefing with critical-path detail once the Living Graph status adapter exposes it
   per-project to a server caller.
