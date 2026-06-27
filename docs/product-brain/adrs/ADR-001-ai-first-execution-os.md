# ADR-001 — ProjectOps360° is an AI-first Project Execution Operating System

**Status:** Accepted · 2026-06-27

## Context
The product has repeatedly been treated (in prompts and partial builds) as a task manager
with AI bolted on. That framing produces generic features and loses the core differentiation.

## Decision
ProjectOps360° is an **AI-first Project Execution Operating System**. The AI workforce
(Isabella + Knowledge OS) and a living model of the project are central, not auxiliary. Every
surface should be explainable by the AI using deterministic business rules over real data.

## Consequences
- Features are evaluated by how much execution truth and explainability they add, not by
  parity with task-tracker checklists.
- The AI must be grounded (Knowledge OS + project data), never a free-floating chatbot.
- Determinism first: engines compute truth; AI narrates it.

## What this prevents
- Drifting into "just another Jira/Asana."
- Ungrounded, hallucinated AI answers presented as fact.

## Related capabilities
CAP-001 Knowledge OS, CAP-002 Isabella, CAP-005 Living Graph, CAP-016 Execution Status Engine.

## Related modules
`lib/knowledge-os`, `components/isabella`, `lib/execution`, `lib/graph`.
