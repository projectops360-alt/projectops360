# Process Interpretation Engine — Architecture (PI-006)

> Status: **Designed** (this document) — implementation lands in PI-007 (timeline
> reconstruction), PI-008 (pattern detection) and later sprint-12 tasks.
>
> Audience: contributors implementing interpretation features on top of the
> Living Graph (PI-001…PI-005).

---

## 1. Purpose

The Living Graph records *what happened* (process_nodes) and *how things relate*
(process_edges). The Process Interpretation Engine answers *what it means*:

- **Narratives** — human-readable explanations of process behavior
  ("Milestone M3 stalled for 6 days because two blocked tasks fed into it").
- **Patterns** — recurring structures worth knowing about
  (stable handoff chains, repeated segments → SOP candidates).
- **Deviations** — departures from the expected flow
  (skipped steps, rework loops, stalled nodes, missing evidence).

The engine is **deterministic-first, AI-second**: structured detection is pure
TypeScript over graph data; the AI (OpenAI, via the existing `runAi` pipeline)
is only used to turn structured findings into polished natural language. This
keeps results reproducible, cheap, and available even when the AI is down.

---

## 2. Data Flow

```
┌────────────────────┐   ┌─────────────────────┐   ┌──────────────────────┐   ┌─────────────────────┐
│  1. Graph access   │ → │ 2. Pattern /        │ → │ 3. AI interpretation │ → │ 4. Narrative +      │
│  (traversal RPCs / │   │    deviation        │   │    (optional,        │   │    ProcessInsight    │
│  direct selects)   │   │    extraction       │   │    runAi / GPT-4o)   │   │    assembly          │
└────────────────────┘   └─────────────────────┘   └──────────────────────┘   └─────────────────────┘
        │                        │                         │                          │
  process_nodes            ProcessPattern[]          ProcessNarrative           ProcessInsight[]
  process_edges            ProcessDeviation[]        (or deterministic          → cache (keyed by
  extract_subgraph         (pure TS, no AI)           fallback template)           graph signature)
  get_process_timeline                                                          → InterpretationResponse
  find_path / detect_cycles
```

Step by step:

1. **Graph access** — the engine receives a `GraphSlice` (nodes + edges). The
   caller decides the scope: whole project (direct selects, as the Living Graph
   page already does), a neighborhood (`extract_subgraph` RPC), or an explicit
   node set. Timeline ordering uses `get_process_timeline`; loop evidence uses
   `detect_cycles`.
2. **Pattern / deviation extraction** — registered `PatternDetector` and
   `DeviationDetector` implementations run over the slice. Each detector is a
   pure function: same input ⇒ same output. They reuse the analysis primitives
   already shipped in `src/lib/graph/living-graph-analysis.ts` (adjacency,
   reachability, longest path, cycle detection, bottleneck scoring).
3. **AI interpretation** — for each finding (or batch of findings) the
   `NarrativeGenerator` builds a compact structured prompt (finding JSON +
   minimal node context, never raw embeddings) and calls **`runAi`** with a new
   prompt type. `runAi` already handles ai_runs logging, token/cost accounting
   and failure capture, so the engine adds nothing to that layer.
4. **Narrative + insight assembly** — detector output + narrative are merged
   into `ProcessInsight` records, stamped with the **graph signature** used for
   cache invalidation, and returned via `InterpretationResponse`.

---

## 3. Core Interfaces

All data types live in `src/types/process-intelligence.ts` (added by PI-006).
Engine implementations will live under `src/lib/interpretation/` (PI-007/008).

```ts
/** Scope of graph data handed to the engine. */
interface GraphSlice {
  nodes: ProcessNode[];
  edges: ProcessEdge[];
}

/** Orchestrator: full pipeline for one request. */
interface ProcessInterpreter {
  interpret(request: InterpretationRequest, slice: GraphSlice): Promise<InterpretationResponse>;
}

/** Finds recurring structures. Pure and deterministic. */
interface PatternDetector {
  readonly id: string;                       // e.g. "rework-loop"
  readonly category: ProcessInsightCategory; // usually "pattern" | "sop_opportunity" | "bottleneck"
  detect(slice: GraphSlice): ProcessPattern[];
}

/** Finds departures from expected flow. Pure and deterministic. */
interface DeviationDetector {
  readonly id: string;                       // e.g. "stalled-node"
  detect(slice: GraphSlice): ProcessDeviation[];
}

/** Converts structured findings into human-readable text. */
interface NarrativeGenerator {
  generate(
    finding: ProcessPattern | ProcessDeviation,
    context: NarrativeContext, // locale, project label, node labels
  ): Promise<ProcessNarrative>; // falls back to deterministic templates on AI failure
}
```

**Registry-based extensibility.** The interpreter holds arrays of detectors:

```ts
const PATTERN_DETECTORS: PatternDetector[] = [reworkLoopDetector, handoffChainDetector, repeatedSegmentDetector, …];
const DEVIATION_DETECTORS: DeviationDetector[] = [stalledNodeDetector, skippedStepDetector, missingEvidenceDetector, …];
```

Adding a new interpretation type = writing one detector (pure function) and,
optionally, one narrative template. No changes to the orchestrator, server
action, or response contract. New categories extend the
`ProcessInsightCategory` union.

---

## 4. Integration Points

### Input — Living Graph

| Source | Used for |
|---|---|
| `process_nodes` / `process_edges` selects | whole-project scope (≤1000 nodes, mirrors Living Graph page) |
| `extract_subgraph(project, entity_type, entity_id, depth)` | entity-scoped interpretation ("explain this task's neighborhood") |
| `get_process_timeline(project, from, to)` | chronological ordering + in/out degree (PI-007) |
| `detect_cycles(project)` | loop/rework evidence |
| `find_path(project, from, to)` | dependency narratives between two nodes |

### AI — OpenAI via the existing pipeline

- Calls go through **`runAi(orgContext, { promptType, templateVars, … })`**
  (`src/lib/ai/service.ts`) — never through a raw OpenAI client. This gives the
  engine ai_runs traceability, cost estimation and error capture for free.
- New prompt type **`process_interpretation`** is added to `AiPromptType` and
  `PROMPT_TEMPLATES` during implementation (PI-008). Template contract:
  - **system**: "You are a process-mining analyst… answer ONLY with JSON
    `{ summary, explanation, recommendation }` in the requested language."
  - **user**: rendered finding JSON + node labels + project name + locale.
- Default model **`gpt-4o`** for narrative quality; `gpt-4o-mini` acceptable
  for batch/low-stakes runs (configurable per request via `RunAiInput.model`).
- `jsonMode: true` — the narrative is parsed from `parsedJson`, validated with
  zod before use; invalid JSON ⇒ deterministic fallback.

### Output — ProcessInsight

`ProcessInsight` (see types) with `category` ∈
`"pattern" | "deviation" | "bottleneck" | "sop_opportunity"`. Insights carry:

- `evidence` (node/edge IDs) so the UI can highlight them in the Living Graph,
- `source` (the structured `ProcessPattern`/`ProcessDeviation` that produced it),
- `narrative` (with `generator: "ai" | "deterministic"`),
- `aiRunId` linking back to `ai_runs`,
- `graphSignature` for cache validation.

Consumers: Living Graph detail panel (replaces the PI-005 placeholder
insights), future insight feed (PI-020), SOP opportunity surfacing (PI-013).

---

## 5. Caching Strategy

Interpretation is expensive (AI tokens + latency), graph reads are cheap, so we
cache **interpretations**, not graph data.

**Graph signature** (cache key component):

```
signature = sha256(project_id : node_count : edge_count : max(nodes.updated_at) : max(edges.created_at))
```

Computable with one cheap aggregate query; any node/edge insert or update
changes it. No triggers or version columns are needed for v1.

**Storage** — `process_insights` table (migration lands with PI-008):

```
process_insights (
  id uuid pk,
  organization_id uuid, project_id uuid,
  category text, severity text, confidence numeric,
  title text, narrative jsonb, evidence jsonb, source jsonb,
  graph_signature text, locale text,
  ai_run_id uuid null, status text default 'new',
  detected_at timestamptz, created_at timestamptz
)
-- index: (project_id, graph_signature, locale)
```

**Read path**:

1. Compute current signature.
2. `SELECT … WHERE project_id = ? AND graph_signature = ? AND locale = ?`
   → cache **hit**: return stored insights (`fromCache: true`), zero AI calls.
3. Miss (graph changed) or `forceRefresh: true` → run the pipeline, persist new
   rows, return fresh (`fromCache: false`). Stale rows for the project are kept
   for history but excluded by the signature match; a periodic cleanup may
   delete rows older than 30 days.

**Scope note** — subgraph-scoped requests append the scope to the key
(`graph_signature : scopeHash`) so a project-level cache entry is never reused
for an entity-level question.

**TTL backstop** — even on signature match, entries older than 24 h are treated
as misses, so narrative copy improvements roll out without manual purges.

---

## 6. Error Handling & Graceful Degradation

Principle: **the engine never throws to its caller, and never returns nothing
when detectors found something.**

| Failure | Behavior |
|---|---|
| AI unavailable / `runAi` returns `failed` | Narrative falls back to deterministic templates (i18n strings, same approach as `buildNodeInsight` in PI-005). Insight is still produced with `narrative.generator = "deterministic"`; response sets `degraded: true`. |
| AI returns invalid JSON | Same deterministic fallback; raw output remains inspectable in `ai_runs.output_snapshot`. |
| One detector throws | Caught and logged; remaining detectors still run; detector id reported in `response.errors`. |
| Graph RPC fails | Retry once; then `status: "failed"` with empty insights and an error message — the server action maps this to the UI error state. |
| Empty graph / no findings | `status: "completed"`, `insights: []` — a valid, cacheable "all healthy" result. |
| Oversized graph (>1000 nodes) | Engine refuses whole-project scope and returns an error instructing subgraph scope (mirrors the Living Graph large-graph safeguard). |

Budget guard: a single request caps AI usage (default: 10 narratives max per
run, batched into one prompt where possible). Findings beyond the cap get
deterministic narratives.

---

## 7. Server Action API Contract

Implementation file (PI-008):
`src/app/[locale]/(app)/projects/[projectId]/actions/interpretation-actions.ts`

Follows the repo's server-action conventions: `"use server"`, org scoping via
`getOrgContext()`, zod input validation, plain serializable results, audit
logging.

```ts
"use server";

/** Run (or fetch cached) interpretation for a project or subgraph. */
export async function interpretProcessAction(
  input: InterpretationRequest,
): Promise<{ data: InterpretationResponse | null; error: string | null }>;

/** Lightweight cached-only read for page loads (never triggers AI). */
export async function getProcessInsightsAction(
  input: { projectId: string; locale: "en" | "es"; categories?: ProcessInsightCategory[] },
): Promise<{ data: ProcessInsight[] | null; error: string | null }>;

/** Mark an insight as acknowledged / dismissed (prepares PI-020). */
export async function updateInsightStatusAction(
  input: { insightId: string; projectId: string; status: "acknowledged" | "dismissed" },
): Promise<{ error: string | null }>;
```

Contract rules:

- `interpretProcessAction` is the **only** entry point that may spend AI tokens.
  It validates `projectId` ownership against the caller's organization before
  touching the graph.
- Errors are returned as message strings (`error`), never thrown — consistent
  with `updateTaskDatesAction` and the rest of the app.
- `InterpretationRequest.scope` selects the graph slice:
  - `{ kind: "project" }`
  - `{ kind: "subgraph", entityType, entityId, depth }` → `extract_subgraph`
  - `{ kind: "nodes", nodeIds }` → explicit set (used by the detail panel)
- Responses are fully serializable (no Maps/Sets/Dates — ISO strings only) so
  they can cross the server-action boundary untouched.

---

## 8. Sequence (typical UI flow)

```
Living Graph detail panel ─ click "Explain with AI"
  → interpretProcessAction({ projectId, scope: { kind: "nodes", nodeIds: [selected] }, locale })
    → getOrgContext() + zod validation
    → compute graph signature → cache lookup (process_insights)
    → MISS:
        → fetch slice (extract_subgraph / selects)
        → run PatternDetectors + DeviationDetectors   (pure TS)
        → NarrativeGenerator → runAi("process_interpretation", …)   [fallback: templates]
        → assemble ProcessInsight[], persist, return { fromCache: false }
    → HIT: return stored insights { fromCache: true }
  ← UI renders narrative + highlights evidence node/edge IDs on the canvas
```

---

## 9. Out of Scope (deferred)

- Streaming narratives (single JSON response is sufficient at current sizes).
- Cross-project pattern learning (needs an org-level corpus; revisit post-MVP).
- Embedding-based similarity for repeated-segment detection (PI-008 may start
  with exact/structural matching; `process_nodes.embedding` exists when needed).
- Insight push notifications (PI-020 actions/approvals build on `status`).

## 10. Follow-up Tasks

| Task | Builds |
|---|---|
| **PI-007** | Timeline reconstruction on `get_process_timeline` → feeds `parallel`/`phase` context into detectors |
| **PI-008** | Detector implementations + `process_interpretation` prompt + `process_insights` migration + server actions |
| PI-013 | SOP opportunity surfacing from `sop_opportunity` insights |
| PI-020 | Insight actions/approvals on top of `ProcessInsight.status` |
