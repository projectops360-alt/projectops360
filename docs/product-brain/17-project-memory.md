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

## Voice Notes to Project Intelligence ([REG-009](10-regression-log.md))
ProjectOps Scribe is the **branded capture assistant**; Project Memory is **where captured
intelligence lives**. The voice-note workflow (lost on `master`, restored 2026-06-27):
1. **Capture in Project Memory** — the "ProjectOps Scribe" button opens the capture modal.
2. **Voice → text** — the **Dictate** button uses the browser Web Speech API (no AssemblyAI / no
   env var); the user can also type or paste. (The Rythm meeting-audio + AssemblyAI flow is a
   separate module.)
3. **AI extracts** structured actions, decisions, follow-ups, and risks — `lib/scribe/ai.ts` via
   `runAi('custom')`, anti-hallucination: a verbatim `source_excerpt` per item, `null` for missing
   owner/date, uncertain items flagged `needs_review`.
4. **User reviews** and approves / edits / rejects each item.
5. **Approved items are saved** into `project_memory_items` (+ `project_scribe_items`), and only
   approved items create the task/decision/risk/work-item, each linked back via `traceability_links`.
6. **The original capture/transcript is preserved** and every extracted item keeps its source excerpt
   — fully traceable back to the voice note.

**Rules:** capture must integrate with Project Memory (never bypass it); **AI must not create
project records without human confirmation**; Project Memory remains the permanent evidence store.
**Protection:** this workflow must not be removed by future Memory/Scribe/AI/transcription/UI changes.

## Gaps
- Cross-project memory / portfolio-level recall.
- Tighter feedback loop into the Living Graph and Isabella (memory as graph context).
- Audio-file voice notes (upload + AssemblyAI) inside Memory — today voice = browser dictation;
  audio-file transcription lives in the Rythm meeting module.

## Distinct from
- **Knowledge OS** (product knowledge) and **Product Brain** (product evolution). Project Memory
  is *per-project* and *user-owned content*. Keep the three layers separate (ADR-004).
