# 15 — Knowledge OS

Capability: CAP-001 · Pillars P1/P5 · Ratified by [`ADR-004`](adrs/ADR-004-knowledge-os-substrate.md).
Status: **Implemented (~80%)**.

## Intent
The product knowledge substrate for the AI workforce: a curated corpus over `pgvector` that
grounds every AI answer. Formerly "Living Guide," now Knowledge OS. All experts share one
corpus; only persona differs.

## How it works (audited)
- **Retrieval:** hybrid + multilingual (en/es parity) — `lib/knowledge-os/retrieval`,
  `match_knowledge` (own function, not the generic Supabase one).
- **Generation:** base prompt + persona overlay, grounded **only** in retrieved Knowledge
  Packages — `lib/knowledge-os/service.ts`.
- **Honesty:** no retrieved knowledge → honest "no verified answer" (tier `ai_suggestion`),
  never a fabricated "verified" answer; degraded answers come straight from the corpus when AI
  is unavailable.
- **Screen Intelligence:** answers are context-aware (module/screen/tab/components/role) so the
  coach explains *where the user is*.
- **Action links:** answers can deep-link to safe internal destinations.
- **Provenance:** persisted in `knowledge_answers` + `ai_runs`; telemetry in `guide_events`.

## Data
`knowledge_packages`, `knowledge_package_versions`, `knowledge_localizations`,
`knowledge_chunks`, `knowledge_answers`, `guide_events`. Migrations `20260814`, `20260815`,
`20260816`.

## Gaps
- Corpus coverage/curation is ongoing (depends on authored Knowledge Packages).
- Not yet grounded in **live execution data** (it explains the product, not yet the project's
  current state) — that bridge is the Execution Status Engine (doc 18) + Isabella (doc 16).

## Distinct from
- **Project Memory** (doc 17) = per-project facts. **Product Brain** = product evolution truth.
  Knowledge OS = product/coaching knowledge for end users. Three different layers; do not merge.
