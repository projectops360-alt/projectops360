# ADR-005 — Isabella is the primary AI Workforce interface

**Status:** Accepted · 2026-06-27

## Context
The product has multiple AI touchpoints. Users need one coherent, trustworthy AI persona.

## Decision
**Isabella** is the primary face of the AI Workforce: an app-wide presence (hologram window,
optional 3D, voice, Free Mode) that answers grounded in Knowledge OS (ADR-004) and, going
forward, in the project's live execution data (Execution Status Engine, ADR-006). The
multi-expert AI Workforce is a roster behind the same substrate; Isabella is the default
expert.

## Consequences
- Isabella's answers about execution must reflect the deterministic engines (e.g. she must
  say "waiting on dependency, not blocked" when that is the truth — ADR-006).
- New AI experts reuse the Knowledge OS substrate and persona-overlay pattern.

## What this prevents
- A fragmented set of inconsistent AI widgets.
- Isabella giving answers that contradict the engines' computed truth.

## Related capabilities
CAP-002 Isabella, CAP-004 AI Workforce, CAP-001 Knowledge OS, CAP-016 Execution Status Engine.

## Related modules
`components/isabella`, `lib/knowledge-os`, `lib/execution`.
