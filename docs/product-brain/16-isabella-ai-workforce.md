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

## Next actions
1. Pipe the Execution Status Engine's explanation into Isabella's context for the focused node.
2. Living Graph node → "ask Isabella" wired to that explanation.
3. Grow the multi-expert roster on the shared Knowledge OS substrate.
