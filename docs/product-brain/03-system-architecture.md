# 03 — System Architecture

## Tech stack (verified from repo)

- **Framework:** Next.js (App Router), React, TypeScript, `next-intl` (en/es).
- **Bundler:** Turbopack. **Package manager:** npm (canonical).
- **Backend data:** Supabase (Postgres + RLS + `pgvector` + Storage + RPCs/Edge).
  - Prod project: `ocopmlnkvidvmxgiwvxw` (org `gbubmgyeymcclwgezkkj`).
- **AI:** OpenAI (extraction, embeddings, answers) via `src/lib/ai`; AI runs audited in `ai_runs`.
- **Hosting:** Vercel — `projectops360.vercel.app`. GitHub→Vercel auto-deploy on `master`
  (production) and on feature branches (preview).
- **Repo:** `github.com/projectops360-alt/projectops360`, default branch `master`.

## Layered architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRESENTATION                                                         │
│  Next.js App Router pages + client components (src/app, src/components)│
│  Living Graph (React Flow), dashboards, Isabella hologram, forms      │
├─────────────────────────────────────────────────────────────────────┤
│  AI WORKFORCE / EXPLANATION                                          │
│  Knowledge OS (RAG over curated corpus) · Isabella persona ·          │
│  deterministic explanation builders (health, readiness, status)      │
├─────────────────────────────────────────────────────────────────────┤
│  DOMAIN ENGINES (pure functions over fetched data)                   │
│  execution/ (health, readiness, critical-path, status-engine*)       │
│  capacity/ · labor/ · graph/ (living-graph analysis) · reports/       │
│  roadmap/ (progress, status-mappings) · sync/                        │
├─────────────────────────────────────────────────────────────────────┤
│  SERVER ACTIONS / SERVICES                                           │
│  per-route actions.ts · command-center/service · import-intelligence │
│  · memory/ · knowledge-os/ · charter/ · delivery/                    │
├─────────────────────────────────────────────────────────────────────┤
│  DATA (Supabase Postgres, RLS-protected, multi-tenant by org)        │
│  ~110 tables · process_nodes/edges (graph) · pgvector indexes        │
└─────────────────────────────────────────────────────────────────────┘
```
`*` = `status-engine` is a Prototype (written, not yet wired). See doc 18.

## Key architectural patterns

1. **Pure domain engines.** Engines (`health.ts`, `readiness.ts`, `critical-path.ts`,
   `capacity/service.ts`, `graph/living-graph-analysis.ts`) are pure functions over
   already-fetched data. Callers batch-load per project. This is the canonical pattern and
   the one the Execution Status Engine follows.
2. **Multi-tenant isolation.** Every business table is `organization_id`-scoped with RLS.
   Project boundary is additionally guarded at the app layer.
3. **Process Intelligence substrate.** `process_nodes` + `process_edges` materialize project
   events into a graph that the Living Graph renders and analyzes (longest-path critical
   path, cycles, bottlenecks, etc.).
4. **Bilingual everywhere.** `I18nField = {en, es}`; explanations are deterministic and
   bilingual so the AI narrates a single source of truth.
5. **Evidence-first.** Findings (health, readiness, variance) carry `evidence_entity_ids`.
6. **AI grounded, never fabricated.** Knowledge OS answers only from retrieved knowledge;
   honest "no verified answer" when nothing is retrieved.

## Multi-tenancy & auth

- `organizations` → `organization_members` → `profiles` (1:1 with `auth.users`).
- `getOrgContext()` (`src/lib/auth`) is the canonical context accessor on `master`.
- **RBAC note:** a richer PMO/PM/Team RBAC system was built on `feat/rythm` but `master`
  runs a permissive org-context model. This divergence is a known risk — see
  [09-technical-debt.md](09-technical-debt.md) and `REG` entries.

## Known structural duplication

- **`rhythm` vs `rythm`:** two meeting-related modules/routes coexist (`/rhythm` = Rhythm
  Center calendar/meetings; `/rythm` = Rythm Meeting Intelligence). This is intentional
  history but a naming hazard — see [09-technical-debt.md](09-technical-debt.md).
