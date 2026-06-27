# 17 — Project Memory

Capabilities: CAP-006 (Project Memory), CAP-007 (vectorization), CAP-008 (Scribe) · Pillar P5.
Status: **Implemented (~80%)**.

## Intent
Per-project institutional memory: every captured piece of project context (note, email, meeting
note, decision, risk signal, evidence) is stored, classified, vectorized, and linkable to
project entities — so the project never forgets and the AI can ground answers in it.

## Current implementation (audited)
- **Capture & store:** `project_memory_items` (74 rows in prod) — `lib/memory`, `/memory`.
- **AI classification:** captured items are typed/structured by AI.
- **Vectorization:** indexed into vector search (`lib/embeddings`, `pgvector`) for retrieval.
- **Linking:** `traceability_links` connect memory items to entities (decisions, risks, tasks…).
- **Project Scribe (CAP-008):** fast capture (write/paste/dictate → AI structures → review →
  Memory + create approved entities). Data: `project_scribe_items`. Migration `20260805`/`20260714`.

## Gaps
- Cross-project memory / portfolio-level recall.
- Tighter feedback loop into the Living Graph and Isabella (memory as graph context).

## Distinct from
- **Knowledge OS** (product knowledge) and **Product Brain** (product evolution). Project Memory
  is *per-project* and *user-owned content*. Keep the three layers separate (ADR-004).
