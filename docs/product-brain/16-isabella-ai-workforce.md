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
