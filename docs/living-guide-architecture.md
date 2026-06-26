# ProjectOps360° — Living Guide™

## Architecture Design Document (ADD)

**Status:** Phase 0 — Architecture Review (NO implementation)
**Author:** Chief Software Architect (review pass)
**Date:** 2026-06-25
**Audience:** Executive / Engineering Leadership
**Decision requested:** Approve architecture before any code is written.

---

## 0. Executive Summary

The Living Guide™ is proposed as an AI-driven "Project Coach" that answers *"What are you trying to accomplish?"* instead of *"Which article do you want to read?"*. The concept is **strategically correct** and aligns with where ProjectOps360° already is: the platform already runs a production retrieval stack (pgvector + HNSW + `match_documents`), an auditable AI invocation layer (`ai_runs`), a Project Memory capture pipeline, and a Living Graph process model.

My recommendation is **READY WITH CHANGES**. The concept is sound, but three architectural decisions, if made wrong today, will force a painful rewrite within 18–24 months:

1. **Do not build a fourth knowledge silo.** ProjectOps360° already has three retrieval-ish substrates (Project Memory, Living Graph, cross-entity vector search). The Living Guide must be a *distinct corpus on the shared retrieval substrate*, not a parallel database.
2. **Separate authoring from indexing from retrieval from generation.** The single biggest failure mode of "AI help systems" is fusing content authoring with the vector index. Knowledge Packages must be authored as immutable, versioned source-of-truth; chunks and embeddings are *derived, disposable artifacts*.
3. **Confidence and provenance are first-class data, not a UI afterthought.** Every answer must carry origin + confidence + the exact Knowledge Package versions and prompt version that produced it. Retrofitting provenance later is a schema-and-rewrite event.

If these three are accepted, the rest of the proposal is implementable incrementally with zero forced rewrites.

---

## 1. What the Living Guide™ actually is (definition discipline)

Before architecture, we must define boundaries, because ProjectOps360° already has overlapping concepts. Confusing them is the #1 risk.

| Subsystem | Owns | Scope | Trust model |
|---|---|---|---|
| **Living Guide™** (new) | *How the product and the discipline work* — product knowledge, PM best practice, org policy | **Global / shared** (with per-tenant overlays) | Curated, versioned, confidence-tiered |
| **Project Memory** | *What happened on THIS project* — notes, emails, decisions, risks | **Per-project, private** | Tenant data, RLS-isolated |
| **Living Graph** | *The process — causal/temporal events* | Per-project | Derived process telemetry |
| **Rythm / Scribe / Charter / etc.** | Feature-specific capture | Per-project | Tenant data |

> **Architectural rule (non-negotiable):** Living Guide content is *product/domain knowledge*. It is authored and governed centrally. A single tenant's private data **never** flows into the global Living Guide corpus except through an explicit governance promotion step that anonymizes and reviews it. This rule is what keeps a multi-tenant AI coach from becoming a cross-tenant data-leak vector.

The Living Guide *consumes* Project Memory and Living Graph at **answer time** to make coaching contextual — it does not absorb them.

```
          ┌─────────────────────────────────────────────┐
          │            LIVING GUIDE (answer)            │
          │   product knowledge  ⊕  YOUR project state  │
          └───────────────▲───────────────▲─────────────┘
                          │               │
        global, curated   │               │  per-tenant, RLS
        ┌─────────────────┴──┐    ┌───────┴────────┬──────────────┐
        │  Knowledge Corpus  │    │ Project Memory │ Living Graph │
        │  (Living Guide)    │    │  (tenant facts)│ (process)    │
        └────────────────────┘    └────────────────┴──────────────┘
                          shared retrieval substrate (pgvector)
```

---

## 2. Answers to the 20 mandated questions

**1. Is Living Guide™ the correct architectural approach?**
Yes, *as a retrieval-augmented coaching layer over a curated corpus* — not as a help-article CMS, and not as a chatbot bolted onto docs. The correct framing is: a **governed knowledge corpus** + **context fusion** + **confidence-scored generation**. The proposal is correct in spirit; it needs the silo/provenance/confidence corrections above.

**2. Is there a better architecture?**
The better architecture is the same idea with a strict **5-stage pipeline**: `Authoring → Compilation/Chunking → Indexing → Retrieval (hybrid) → Generation+Confidence`, plus a **Feedback** side-channel. The improvement over the naive proposal is treating embeddings/chunks as *derived and re-buildable*, and treating Knowledge Packages as *immutable versioned source*. This makes model swaps, re-chunking, and re-embedding routine instead of catastrophic.

**3. What are the risks?** (full register in §11)
Top five: (a) building a 4th silo; (b) cross-tenant leakage through similarity search; (c) confidence theater (numbers users can't trust); (d) stale knowledge presented as Verified after product changes; (e) cost blow-up from re-embedding everything on every edit.

**4. What becomes difficult in two years?**
Without versioned immutable packages: you cannot answer "why did the Guide say that 6 months ago?" Without provenance in `ai_runs`-style audit: you cannot debug or defend an answer. Without a retriever interface: swapping pgvector for a dedicated vector DB becomes a multi-month migration. Without language-as-data: adding a third language means re-modeling.

**5. What becomes difficult with one million Knowledge Packages?**
First, reframe: **product knowledge is bounded** (hundreds to low thousands of Knowledge Packages). 1M is not product knowledge — it is *learned patterns + analytics*, which must **not** be vectorized wholesale. For the legitimately vectorized corpus (curated KPs × languages × chunks), 1M *chunks* is comfortably within pgvector/HNSW range. The danger isn't the curated corpus; it's accidental ingestion of telemetry. Decision: **cap what is vectorized; never vectorize raw events** (see Q20).

**6. What architectural decisions must change today to avoid future rewrites?**
- Immutable, versioned Knowledge Packages (append-only).
- A `KnowledgeRetriever` interface so the vector store is swappable.
- `embedding_model` + `embedding_dims` stored per chunk (enables re-embed/upgrade).
- Provenance + confidence persisted on every generated answer.
- Language modeled as a column/dimension, not hardcoded en/es.
- Analytics in append-only event tables, never in the corpus.

**7. Is Supabase the correct long-term choice?**
**Yes, for the next 2–3 years.** The codebase already proves pgvector + HNSW + RPC at MVP scale, RLS multi-tenancy, and i18n JSONB. Staying on Supabase keeps the Guide on the same RLS perimeter as tenant data (a security win) and avoids a second datastore to operate. The exit ramp (a dedicated vector DB) is only needed if the *curated* corpus crosses ~1–2M vectors **or** p95 retrieval latency degrades under HNSW — neither is near. Keep the retriever behind an interface so the exit is cheap.

**8. Should Knowledge Packages live entirely inside PostgreSQL, or partly elsewhere?**
Split by data shape:
- **Postgres:** package metadata, version pointers, chunk text, embeddings, tags, status, provenance — the queryable core.
- **Vercel Blob / object storage:** heavy rendered assets (images, diagrams, long media, attachments). Store a URL + checksum in Postgres.
- **Append-only events table (Postgres, partitioned) → optionally external analytics later:** usage telemetry.
Rationale: keep the *retrieval-critical* data in Postgres for transactional consistency with RLS; push large binaries and high-volume telemetry off the hot path.

**9. What indexing strategy?**
**Hybrid.** Per chunk:
- `HNSW (vector_cosine_ops)` for semantic similarity (already the house pattern).
- `tsvector` + GIN for lexical/keyword (BM25-style) — critical because product terms ("RACI", "PMO", "contributor") must match exactly, where pure vectors are weak.
- GIN on `tags`, btree on `(status, language, product_version)` for filtering.
Retrieve with **hybrid fusion** (vector + lexical, Reciprocal Rank Fusion), then optional rerank. Partial indexes `WHERE status='published' AND deleted_at IS NULL` to match the existing house style.

**10. What vectorization strategy?**
- **Chunk-level, not document-level.** Semantic chunking (~300–800 tokens, heading-aware), with overlap.
- **Model:** `text-embedding-3-small` @ 1536 dims to stay *consistent with the existing corpus and `match_documents`*. Store `embedding_model`/`embedding_dims` so we can later move select corpora to `-3-large` without a rewrite.
- **Idempotent embedding:** hash chunk text (the codebase already does `sha256` content-hashing); skip re-embedding unchanged chunks. This is the cost control.
- **Embeddings are derived:** they can always be rebuilt from immutable package versions.

**11. Should the vector database be separated?**
**Not now.** Keep it in Supabase/pgvector behind a `KnowledgeRetriever` interface. Separate only when (a) curated vectors exceed ~1–2M, (b) p95 search latency regresses, or (c) you need cross-region replication the primary can't serve. The interface makes this a swap, not a rewrite.

**12. How should multilingual content be modeled?**
The codebase uses two patterns: i18n JSONB (`title_i18n {en,es}`) for short fields and plain text for long-form. For Knowledge:
- **Package metadata:** i18n JSONB (consistent with the app).
- **Body + chunks + embeddings:** **one row per language** (`language` column), siblings sharing a `knowledge_package_id`. Each language is embedded in its own language so retrieval matches query language and the answer can be generated in-language. This beats one multilingual blob because retrieval precision and answer fidelity both improve. Model `language` as data — never branch on hardcoded `en`/`es`.

**13. Should versioning be immutable?**
**Yes — append-only, immutable versions** with a `is_current` / current-version pointer. A new edit creates a new version; old versions are retained. This is what makes "the Guide said X in March" auditable, lets answers cite an exact version, and makes confidence-decay tractable. It mirrors the platform's existing `ai_runs` "immutable audit trail" philosophy.

**14. How should deprecated knowledge be handled?**
Lifecycle: `draft → published → deprecated → archived`, plus a `superseded_by` pointer. Deprecated content is **excluded from retrieval by default** but **retained** so historical answers remain explainable. When product version advances past a package's `product_version_max`, the package is auto-flagged **stale** (drops in confidence, surfaced to authors), not silently served.

**15. How should AI prompts be versioned?**
Keep generation/coaching prompts **in code** (the app already stores prompt templates as typed constants in `src/lib/ai/prompts.ts` — git gives review, diff, and test). **Do not move prompts into the DB** (loses code review and testing). **But** persist a `prompt_version` string on every answer/`ai_runs`-style record so each answer is reproducible from {prompt_version + KP versions + model + retrieval set}. Prompt = versioned code; prompt-version-used = versioned data.

**16. How should Product Memory relate to Living Guide?**
They are **complementary, not nested**. Project Memory = private tenant facts (RLS). Living Guide = shared product/domain knowledge. They **fuse at answer time**: a coaching answer = (Living Guide knowledge) ⊕ (this project's Memory) ⊕ (Living Graph state). Hard boundary: tenant Memory may inform an answer *for that tenant*, but never writes into the global corpus without governed, anonymized promotion. This prevents the classic multi-tenant RAG leak.

**17. How should Living Graph consume Living Guide?** *(and vice-versa)*
The Living Guide **consumes** Living Graph as a *context signal* (read-only): "you have 3 blocked tasks and an at-risk milestone" → the Guide surfaces the relevant Knowledge Package proactively. The Guide does **not** write `process_nodes`. Conversely, the Living Graph can *link to* a Guide package as evidence/explanation, but the Guide remains the consumer of state, not a producer of process events.

**18. How should future AI agents consume this knowledge?**
Expose a single stable contract — `KnowledgeRetriever.search(query, context) → { chunks, provenance, confidence }` — surfaced as an internal API and (later) an **MCP tool**. Every consumer (the coach UI, future autonomous agents, the Living Graph, Scribe) uses the *same* retriever and gets the *same* provenance/confidence envelope. This is why provenance + confidence must be in the contract from day one.

**19. How should analytics be stored?**
**Append-only event table**, partitioned by month, RLS-scoped, e.g. `guide_events(event_type, query_hash, package_ids, confidence, helpful, dwell_ms, surface, role, ...)`. Roll up into aggregate tables for the learning loop. Optionally fan out to external product analytics later. **Never** store analytics in the corpus and **never** embed it.

**20. What information should never be vectorized?**
- Credentials, secrets, tokens, API keys.
- PII beyond what's strictly needed (emails, personal contact info).
- Raw telemetry / analytics / audit logs.
- Permission grants, RBAC assignments, security policy internals.
- Tenant financials / billing detail.
- Anything whose similarity-match could surface it to a tenant who shouldn't see it.
Vectorize **only** sanctioned curated knowledge and (optionally) tenant Memory that is *already* RLS-protected and retrieved *within that tenant's boundary*.

---

## 3. Data Model (proposed)

All tables follow the house conventions observed in the codebase: `organization_id` FK + RLS via `is_org_member()`, `deleted_at` soft-delete, `updated_at` trigger, partial indexes, `vector(1536)` + HNSW.

### 3.1 Core knowledge tables

```
knowledge_packages                 -- logical unit ("People & Permissions: Roles")
  id                uuid pk
  organization_id   uuid null      -- NULL = global/product knowledge; set = tenant overlay
  slug              text
  domain            text           -- 'people_permissions' | 'execution_map' | ...
  status            text           -- draft|published|deprecated|archived
  superseded_by     uuid null
  product_version_min text         -- applicability window
  product_version_max text null
  default_language  text
  created_at, updated_at, deleted_at

knowledge_package_versions         -- IMMUTABLE, append-only
  id                uuid pk
  package_id        uuid fk
  version_no        int
  is_current        bool
  title_i18n        jsonb
  confidence_tier   text           -- verified|org_policy|best_practice|learned|ai_suggestion
  authored_by       uuid
  reviewed_by       uuid null      -- required to reach 'verified'
  source_refs       jsonb          -- citations / origin
  created_at

knowledge_chunks                   -- DERIVED, rebuildable
  id                uuid pk
  package_id        uuid fk
  version_id        uuid fk
  language          text           -- one row per language
  ordinal           int
  body              text
  content_hash      text           -- sha256, skip re-embed if unchanged
  embedding         vector(1536)
  embedding_model   text           -- 'text-embedding-3-small'
  embedding_dims    int
  tsv               tsvector        -- lexical/hybrid
  index_status      text           -- pending|processing|completed|failed|skipped
  created_at, deleted_at
  -- HNSW(embedding) WHERE embedding IS NOT NULL AND deleted_at IS NULL
  -- GIN(tsv); GIN(tags); btree(package_id, language)

knowledge_answers                  -- provenance per generated answer (IMMUTABLE)
  id                uuid pk
  organization_id   uuid fk
  user_id           uuid
  project_id        uuid null
  query_text        text
  surface           text           -- screen/context where asked
  retrieved_chunks  jsonb          -- chunk ids + similarities
  package_versions  jsonb          -- exact KP versions cited
  prompt_version    text
  model             text
  confidence_tier   text
  confidence_score  numeric
  ai_run_id         uuid fk        -- ties into existing ai_runs audit
  created_at

guide_events                       -- APPEND-ONLY analytics, monthly partitions
  id, organization_id, user_id, event_type, query_hash,
  answer_id, helpful, dwell_ms, role, surface, occurred_at
```

### 3.2 Reuse, don't reinvent

- **Embeddings:** extend the existing `generateAndStoreEmbedding` pattern with a new `EmbeddableEntityType = "knowledge_chunks"`; reuse the `sha256` content-hash idempotency.
- **Retrieval:** add a `match_knowledge()` RPC alongside `match_documents()` (do **not** overload `match_documents`, which is tenant-entity search — keep corpora cleanly separated).
- **AI audit:** every coaching generation writes an `ai_runs` row (widen `prompt_type` with `'guide_coaching'`); `knowledge_answers.ai_run_id` links to it.
- **RLS:** global packages (`organization_id IS NULL`) are readable by all authenticated users; tenant overlays use `is_org_member()`. Writes to global corpus restricted to a `knowledge_author` capability (governance).

---

## 4. Knowledge Confidence Model

Replace the flat list with a **tier + score** model. Tier = where it came from; score = how much to trust it *right now*.

### 4.1 Source tiers (origin)

| Tier | Meaning | Can it be auto-generated? | Default weight |
|---|---|---|---|
| **Verified** | Human-authored AND reviewer-approved; matches current product behavior | No — requires review | 1.00 |
| **Organization Policy** | Tenant-authored governance; authoritative *within that tenant* | Tenant author | 0.95 (in-tenant) |
| **Best Practice** | Curated PM/domain methodology, not product-specific | Curated | 0.80 |
| **Learned Pattern** | Derived from aggregated, anonymized usage with statistical support | Yes, but labeled | 0.55 |
| **AI Suggestion** | Model-generated, weakly/un-grounded | Yes | 0.30 |

This is better than the proposed flat list because **AI Suggestion must always be visibly the lowest tier** and **Learned Pattern must never silently masquerade as Verified**. The UI shows the tier on every answer ("✓ Verified" vs "✨ AI suggestion").

### 4.2 Confidence score (per answer, 0–1)

```
score = tier_weight
      × retrieval_strength        (top-k cosine similarity, normalized)
      × recency_factor            (decays as content ages / product moves)
      × corroboration_factor      (more independent supporting chunks → higher)
      × feedback_factor           (helpful/unhelpful signal over time)
```

### 4.3 How confidence evolves

- **Rises** with: reviewer approval (→ Verified), positive feedback, corroboration by other packages, freshness after a product release that re-confirms it.
- **Decays** with: age, `product_version_max` exceeded (→ **stale**), negative feedback, detected contradiction with a newer package, low usage.
- **Stale gate:** when product version advances past a package's applicability, the package cannot be served as Verified until re-reviewed — it drops to a "needs review" state. This single rule prevents the most damaging failure: confidently wrong, outdated guidance.

---

## 5. Knowledge Evolution (the learning loop)

```
   SIGNALS                      CANDIDATE GEN            GOVERNANCE GATE        CORPUS
 ┌──────────────────┐        ┌──────────────────┐     ┌────────────────┐   ┌──────────┐
 │ questions asked  │        │ cluster unmet    │     │ human review   │   │ new/updated
 │ feedback 👍/👎    │  ───►  │ queries          │ ──► │ (required for  │──►│ KP version
 │ abandoned flows  │        │ detect contradic.│     │  Verified)     │   │ + re-index
 │ repeated mistakes│        │ draft AI suggest │     │ auto-publish   │   └──────────┘
 │ repeated searches│        │ propose Learned  │     │  only Learned/ │        │
 │ dwell time       │        │  Patterns        │     │  AI tiers      │        │
 │ feature usage    │        └──────────────────┘     └────────────────┘        │
 │ new releases     │                ▲                                          │
 │ product changes  │                └──────────── analytics rollups ───────────┘
 │ Project Memory   │
 │ Living Graph     │
 │ support tickets* │  (*future)
 └──────────────────┘
```

Principles:
- **Signals are aggregated and anonymized** before they can influence the *global* corpus (multi-tenant safety).
- **Human-in-the-loop is mandatory to mint Verified knowledge.** Learned Patterns and AI Suggestions may auto-surface but are *always* labeled at their tier and never auto-promoted to Verified.
- **Unmet-query clustering** ("many users asked X, no good answer") is the highest-value signal — it directly tells authors what to write next.
- **Contradiction detection** (a new package conflicts with an old one) triggers a review task rather than silently serving both.

---

## 6. User Experience

**Endorse the "AI Project Coach, task-oriented" direction — with one correction.**

Agree: the primary affordance is *"What are you trying to accomplish?"*, the Guide is context-aware (knows your screen, role, and project state), and it leads with *doing*, not *reading*.

**Correction / addition:** do **not** force everyone through the coach. Power users and skeptics need a fast deterministic escape hatch (browse/search the corpus directly). A coach that hides the underlying knowledge feels like a black box and erodes trust — especially in People & Permissions, where users want to *verify* what a role can do, not be told. Provide three layers:

1. **Ambient / contextual** — inline nudges anchored to the current screen and project state ("This project has 3 contributors with no assigned tasks — assign work?"). Lowest friction, highest value, requires Living Graph + Memory fusion.
2. **Ask** — the coach box: intent-first, returns a grounded answer *with visible confidence tier + sources* and next-step actions.
3. **Browse / verify** — direct, deterministic access to the Knowledge Packages for users who want the source of truth.

Every coached answer must show: the **confidence tier badge**, **source links** (which packages), and **one concrete next action** (deep-link into the product). Coaching that can't produce an action should say so rather than hallucinate one.

---

## 7. Implementation Strategy (phased, each independently deliverable)

| Phase | Name | Delivers | Depends on |
|---|---|---|---|
| **0** | Architecture | This ADD; schema + interface contracts approved | — |
| **1** | Minimal Viable Living Guide™ | `knowledge_packages/versions/chunks` tables, embedding pipeline (reuse existing), `match_knowledge()` RPC, hybrid retrieval, **Ask** box, provenance + confidence-tier display. Seeded with **People & Permissions** content. | Phase 0 |
| **2** | Context Awareness | Fuse current screen + role + Living Graph/Memory state into retrieval; ambient nudges; intent-first phrasing | Phase 1, Living Graph (exists) |
| **3** | Knowledge Intelligence | Confidence *score* engine, stale-gate on product version, contradiction detection, authoring/review workflow (governance), versioned immutability surfaced in UI | Phase 1 |
| **4** | Collective Intelligence | Analytics rollups, unmet-query clustering, Learned Patterns (anonymized, labeled), feedback-driven confidence evolution | Phase 3 |
| **5** | Self-Evolving Knowledge | AI-drafted candidate packages from clustered signals → human governance gate → publish; MCP retriever for autonomous agents | Phases 3–4 |

Each phase ships value alone: Phase 1 is a usable grounded coach for one domain; Phase 2 makes it contextual; Phase 3 makes it trustworthy at scale; Phases 4–5 make it self-improving. **No phase requires re-doing a prior phase** because the immutable-package + retriever-interface + provenance decisions are made in Phase 0–1.

---

## 8. First Module: People & Permissions — endorsed

**Why this is the right first module:**

1. **Highest demonstrated confusion + risk.** The last five commits on this branch are RBAC hardening (`contributor lockdown`, `can_manage_tasks`, RLS privilege-escalation closure). That history is direct evidence that *humans (and the team) find permissions hard* — exactly where guidance pays off most.
2. **Errors here are security-consequential.** Wrong guidance about Execution Map styling is cosmetic; wrong guidance about who can see/do what is a breach. High value of *correct* guidance.
3. **Bounded, stable, freshly-built.** Permissions semantics were just defined and hardened, so the knowledge is *accurate now* — ideal for minting **Verified** content. Bounded scope makes a clean MVP.
4. **Evergreen.** Roles/permissions questions recur across every tenant and every new user — durable ROI, unlike volatile feature areas.
5. **Natural confidence showcase.** It is the perfect place to prove the tier model: "✓ Verified — a Contributor can only edit their own tasks (RBAC policy, product v…)" is exactly the trust signal users need.

**Considered alternative:** Onboarding / Execution Map (first-run reach). Rejected as *first* because it is more volatile (UX still evolving per the memory of recent restructures) and lower-stakes than permissions. It is the strong **second** module.

---

## 9. Architecture Decisions & Trade-offs (ADR-style)

| Decision | Chosen | Alternative | Trade-off accepted |
|---|---|---|---|
| Knowledge store | Supabase/pgvector behind `KnowledgeRetriever` interface | Dedicated vector DB (Pinecone/Weaviate) now | Slightly less scale headroom; gain: one RLS perimeter, one ops surface, cheap future swap |
| Package versioning | Immutable append-only | Mutable rows + history table | More rows; gain: auditability, answer reproducibility |
| Chunks/embeddings | Derived, rebuildable | Authoritative storage | Re-index cost; gain: free model/chunk-strategy upgrades |
| Prompts | In code, version logged to data | Prompts in DB | Less runtime editability; gain: review + tests + reproducibility |
| Retrieval | Hybrid (vector + lexical RRF) | Pure vector | More index maintenance; gain: exact-term precision for product vocabulary |
| Multilingual | Row-per-language | One multilingual blob | More rows; gain: retrieval precision + in-language answers |
| Tenant ↔ global | Hard boundary + governed promotion | Free ingestion of tenant data | Slower corpus growth; gain: no cross-tenant leakage |
| Embedding model | `text-embedding-3-small` 1536 | `-3-large` 3072 now | Lower ceiling per-vector; gain: corpus consistency, lower cost, per-corpus upgrade path retained |

---

## 10. Cost & Performance

- **Embedding cost** is controlled by `content_hash` idempotency (only changed chunks re-embed) — the codebase already uses this hashing pattern.
- **Curated corpus is small** (bounded product knowledge × languages × chunks). At MVP this is thousands of vectors — negligible HNSW cost.
- **Generation cost** governed by `gpt-4o-mini`-class default (house default), escalating model only when confidence/complexity warrants; every call metered in `ai_runs` (`cost_usd`, `tokens_*`) — cost observability already exists.
- **Latency:** hybrid retrieval over a small HNSW index is single-digit ms; the generation call dominates. Cache frequent (query_hash → answer) pairs in the runtime cache for common questions.

---

## 11. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Building a 4th knowledge silo; concept drift vs Project Memory / Living Graph | High | §1 definition discipline; separate `match_knowledge()` RPC; shared substrate, distinct corpus |
| R2 | Cross-tenant leakage via similarity search | High | Global corpus is `organization_id IS NULL`; tenant retrieval bounded by RLS; governed promotion only |
| R3 | Confidence theater (numbers users can't trust) | High | Tier-first UI, visible sources, stale-gate, honest "I don't have a verified answer" |
| R4 | Stale knowledge served as Verified after product change | High | `product_version_max` + auto-stale gate + re-review requirement |
| R5 | Re-embedding cost on every edit | Medium | `content_hash` idempotency; chunks derived from immutable versions |
| R6 | Vector DB lock-in / future migration pain | Medium | `KnowledgeRetriever` interface; `embedding_model`/`dims` stored per chunk |
| R7 | Prompt drift / unreproducible answers | Medium | Prompts in code + `prompt_version` persisted on every `knowledge_answers` row |
| R8 | Analytics bloating the corpus | Medium | Append-only `guide_events`, never embedded; rollups separate |
| R9 | Authoring bottleneck (no content = no value) | Medium | Phase 1 seeds People & Permissions; Phase 4 unmet-query clustering prioritizes authoring |
| R10 | Language scaling beyond en/es | Low–Med | `language` as data from day one |

---

## 12. Assumptions

- The existing AI provider abstraction (`AiProvider`, `runAi`, `ai_runs`) and embedding utility remain the canonical AI surface.
- Supabase prod project `ocopmlnkvidvmxgiwvxw` is the target; migrations follow the existing dated convention.
- Product knowledge is bounded (thousands of packages, not millions); millions implies telemetry, which is out of scope for vectorization.
- A governance/authoring role can be expressed within the current RBAC model (likely PMO/admin-tier capability).
- English + Spanish are the launch languages; the model must not hardcode them.

---

## 13. Unresolved Questions (for stakeholders)

1. **Who authors and reviews Verified knowledge?** Internal product team only, or also tenant admins for Organization Policy? (Affects governance UI scope.)
2. **Is there a near-term need for autonomous agents** to consume the Guide (Phase 5 MCP), or is the human coach the only consumer for 12 months? (Affects how early we harden the retriever contract — recommend hardening it in Phase 1 regardless.)
3. **Reranker:** do we adopt a hosted reranker in Phase 1, or defer until retrieval quality data justifies it? (Recommend defer to Phase 3.)
4. **Tenant overlays:** will tenants override/extend global packages at launch, or is that a later phase? (Recommend later; design the schema for it now via nullable `organization_id`.)
5. **Support tickets as a signal** (listed as future) — is there a ticketing source to integrate, or is this aspirational? (Schema accommodates it; no Phase-1 dependency.)

---

## 14. Final Recommendation & Readiness

### Classification: **READY WITH CHANGES**

The Living Guide™ is the right strategic bet and fits ProjectOps360°'s existing stack unusually well. It is **not ready to build as originally framed** because the original framing risks a knowledge silo, weak provenance, and confidence-as-UI. With the changes below, it becomes a decade-durable subsystem.

### Required modifications before implementation begins

1. **Adopt the corpus-not-silo boundary** (§1): Living Guide = curated product/domain knowledge; it *consumes* Project Memory and Living Graph at answer time and never absorbs them. Add a dedicated `match_knowledge()` RPC; do not overload `match_documents()`.
2. **Make Knowledge Package versions immutable and append-only** (§3, Q13), with `is_current` pointer and `superseded_by`.
3. **Treat chunks/embeddings as derived/rebuildable**, storing `content_hash`, `embedding_model`, `embedding_dims` per chunk (Q10, Q6).
4. **Persist provenance + confidence on every answer** (`knowledge_answers` linked to `ai_runs`), including `prompt_version` and exact KP versions (Q15, Q18).
5. **Adopt the tier + score confidence model** with a mandatory human-review gate for Verified and an automatic stale-gate on product version (§4).
6. **Hybrid indexing** (HNSW + tsvector/GIN) from Phase 1 (Q9).
7. **Model `language` as data**, row-per-language for body/chunks/embeddings (Q12).
8. **Hard multi-tenant boundary**: global corpus `organization_id IS NULL`, governed/anonymized promotion only; never vectorize the Q20 exclusion list.
9. **Define the `KnowledgeRetriever` interface in Phase 1** so the vector store is swappable and future agents share one contract (Q11, Q18).
10. **Analytics in append-only `guide_events`**, never embedded (Q19, Q20).
11. **Confirm the first module is People & Permissions** and seed Phase 1 with reviewed, Verified content for it (§8).

Once these eleven modifications are accepted and reflected in the Phase 1 schema and interfaces, the project is **READY TO BUILD**.

> **Do not begin implementation until §14 modifications are approved.**
