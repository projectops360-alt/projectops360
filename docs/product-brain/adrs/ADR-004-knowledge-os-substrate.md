# ADR-004 — Knowledge OS is the product knowledge substrate

**Status:** Accepted · 2026-06-27

## Context
AI answers must be grounded and honest. A curated corpus over pgvector (`match_knowledge`)
already exists; it was formerly called "Living Guide" and is now Knowledge OS.

## Decision
Knowledge OS is the **single knowledge substrate** for the AI workforce. All experts
(Isabella by default) share one corpus; only persona/tone/specialty differ. Answers are
generated **only** from retrieved knowledge; when nothing is retrieved, the system returns an
honest "no verified answer" rather than fabricating one. Provenance is persisted
(`knowledge_answers`, `ai_runs`).

## Consequences
- Adding AI "knowledge" means curating Knowledge Packages, not hardcoding prompt text.
- Retrieval is hybrid + multilingual (en/es parity).
- The Product Brain is *product* memory; Knowledge OS is *coaching/product knowledge* for end
  users; Project Memory (ADR-pending) is *per-project* memory. These are distinct layers.

## What this prevents
- Ungrounded chatbot answers; knowledge scattered in prompts.

## Related capabilities
CAP-001 Knowledge OS, CAP-002 Isabella, CAP-004 AI Workforce.

## Related modules
`lib/knowledge-os`, `knowledge_*` tables, `lib/embeddings`.
