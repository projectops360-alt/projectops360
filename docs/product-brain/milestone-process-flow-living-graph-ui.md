# Milestone Process Flow — Living Graph UI Consumer (Phase 3, Task 8)

> Companion to the [MPF Engine Architecture](./milestone-process-flow-engine-architecture.md)
> and the [MPF Engine Constitution](./milestone-process-flow-engine-constitution.md).
> Regression id: **PEG-MPF-LIVING-GRAPH-UI-CONSUMER**.

## What it is

The first UI surface for the Milestone Process Flow Engine: a project-scoped view
that shows **how execution flows between milestones** — transitions (corridors),
flow segments, metrics, delay/rework/bottleneck/propagation findings, transition
health, and the Isabella evidence packet — all derived by the engine (Tasks 1–7).

**Engine First:** the UI is a **consumer**. Every piece of intelligence on screen
comes from `buildMilestoneFlowProjection`. The UI formats, filters, and drills
into engine output; it derives nothing.

## What it intentionally does NOT do

- No transition/segment rebuilding, no metric recalculation, no health
  classification, no delay/rework/bottleneck/propagation detection in UI.
- No Isabella natural-language generation, no LLM/AI API call of any kind.
- No Projection Engine Runtime (no persistence/invalidation of projections —
  the projection is built read-only per request).
- No canonical mutation: never writes `project_event_log` (SELECT only), never
  touches `process_nodes` / `process_edges`, never emits PEG events for viewing.
- No permissive fallback: any auth/scope failure renders a safe unauthorized
  state with **no data**.

## Files

| File | Responsibility |
|---|---|
| `src/lib/milestone-flow-ui/load-projection.ts` | Smallest safe **read-only server adapter**: org context → tenant-validated project → SELECT milestones + `project_event_log` → map to engine refs → run the engine. Deny-by-default (`unauthorized` on invalid id / unauthenticated / cross-org). Empty data → the engine's safe empty projection. |
| `src/lib/milestone-flow-ui/selectors.ts` | **Pure display selectors**: `buildMilestoneFlowViewModel` (formats the projection — durations, evidence counts, dedup; type-only engine imports), `filterMilestoneFlowTransitions` (presentation filters, never mutate), `formatDurationMs` / `formatRatioAsPercent`. |
| `src/components/milestone-flow/milestone-flow-view.tsx` | Client view: observability strip, presentation filters, transition corridor cards (milestone anchors + health badge + proportional segment bar), selection state, empty states. |
| `src/components/milestone-flow/transition-detail-panel.tsx` | Detail sections: health, segments, metrics, findings, Isabella packet preview, evidence drill-down. |
| `src/components/milestone-flow/style-maps.ts` | Pure vocabulary→Tailwind lookups; unknown values fall back to the neutral style (the UI can never look healthier than the engine reported). |
| `src/app/[locale]/(app)/projects/[projectId]/execution-map/milestone-flow/page.tsx` | Server route: loads the projection, builds the view-model server-side, renders unauthorized/error states safely. |
| `.../milestone-flow/loading.tsx` | Locale-independent skeleton. |

## Placement / routing

`/projects/[projectId]/execution-map/milestone-flow` — a sibling of the Living
Graph subpage (`execution-map/living-graph`), reachable from the Execution Map
tab bar ("Milestone Flow" / "Flujo entre Hitos"). Project-scoped, locale-aware,
inside the authenticated app layout. No new top-level nav item (UX-006 grouped
nav untouched).

## Engine outputs consumed

`transitions` (+ segments), `metricsByTransition`, `findingsByTransition`,
`reworkFindingsByTransition`, `bottleneckFindingsByTransition`,
`constraintPropagationFindings`, `healthSummariesByTransition`,
`isabellaEvidencePacketsByTransition`, `dataQualityFlags`, `observability`.

## How things are visualized

- **Transitions:** corridor cards — source milestone → target milestone anchors,
  health badge + confidence, transition status, primary reason code, uncertainty
  and warning chips, finding counts.
- **Segments:** a proportional corridor bar (widths lay out engine-calculated
  durations; unknown-duration segments render as fixed hatched slices so
  uncertainty stays visible) + a per-segment list (type, dates, engine duration,
  open-ended flag, confidence, evidence count).
- **Metrics:** planned/actual/elapsed durations + time buckets (active, waiting,
  blocked, decision/approval delay, rework, unknown), total known segment time,
  flow efficiency, segment counters, completeness, confidence. **Null renders as
  "Unknown"** — never hidden, never fabricated.
- **Findings:** delay findings (type/status/severity/confidence/duration/evidence),
  rework findings (rework + trigger type), bottleneck findings (**always labeled
  Candidate**; `possible` status labeled Possible; structural candidates marked),
  constraint propagation (origin/affected direction, **possible stays possible**).
- **Health:** status, confidence, primary + secondary machine reason codes,
  recommended action **category**, uncertainty notes, evidence/warning counts,
  machine-readable reason detail behind a disclosure. Never overridden.

## Causality guardrail (fallback dependency cause)

Task 6 conservatively maps unknown blocker causes to `dependency`. The classifier
(Task 7) marks that as `ambiguous_blocker_cause` and disallows the claim
`blocker_cause_is_dependency_confirmed`. The UI mirrors the exact engine rule
(`bottleneckType === "dependency" && confidence !== "high"` →
`isAmbiguousDependencyFallback`) and renders an explicit warning: *"the engine
conservatively defaults to dependency — NOT a confirmed dependency bottleneck."*
Guarded by selector + render tests.

## Isabella evidence packet preview

Structured sections only — **no prose is generated, Isabella is not called**:

- **Facts** — only refs carrying an `eventId`/`metricRef` (facts require evidence;
  the selector drops any without).
- **Inferences** — shown as inferences.
- **Predictions** — separate dashed section with an explicit "Prediction — not a
  fact" badge; never mixed with facts.
- **Recommendation** — action **category** chip only ("action category only — no
  generated advice").
- **Uncertainty** — always visible when present.
- **Allowed / Disallowed claims** — inspectable in a disclosure (AI trust +
  auditability surface).

## Evidence drill-down

Per transition: deduped union of health + finding + segment evidence refs,
each showing kind, event id / metric ref / note, and confidence. Raw ids live in
the drill-down, not the main view. When detail isn't available the UI says so
("references only") instead of fetching unauthorized data.

## RBAC / security

- Adapter: org context (existing auth) → project must exist in the caller's org
  (RLS-scoped query) → engine-side `resolveMilestoneFlowAccess` (deny-by-default,
  tenant-isolated). Any failure → `{ status: "unauthorized" }` with no payload.
- Unauthorized/error pages render generic messages — no evidence, scope, or
  cross-org detail leaks through empty states or errors.
- Client components import no data source (no supabase) — they receive only the
  server-built view-model.

## i18n

New `milestoneFlow` namespace in `messages/en.json` + `messages/es.json` (full
key parity, UX-012). All engine vocabularies (health statuses, segment types,
finding types, severities, confidence, reason codes, action categories,
uncertainty notes) are translated in both languages. Machine claim keys and
event ids render as code (audit surface, not prose).

## Tests (PEG-MPF-LIVING-GRAPH-UI-CONSUMER)

- `src/lib/milestone-flow-ui/__tests__/milestone-flow-ui-selectors.test.ts` —
  engine output consumed verbatim (transitions/segments/metrics/findings/health/
  packets), all 8 health statuses, honest nulls, candidate/possible labels,
  ambiguous dependency fallback, facts-require-evidence, claims inspectable,
  evidence dedup, filters pure + non-mutating, projection never mutated.
- `src/lib/milestone-flow-ui/__tests__/milestone-flow-ui-adapter.test.ts` —
  deny-by-default (invalid id / unauthenticated / cross-org → unauthorized, no
  data), read-only engine consumption, empty data → safe empty projection.
- `src/lib/milestone-flow-ui/__tests__/milestone-flow-ui-import-boundaries.test.ts` —
  no detector/calculator/builder internals imported, selectors type-only engine
  imports, client components never import the engine or supabase, no LLM/AI SDK,
  no canonical writes / PEG emission / `process_nodes` / `process_edges`.
- `src/components/milestone-flow/__tests__/milestone-flow-view.render.test.tsx` —
  server-render guards: anchors/transitions/health render, empty states
  (no milestones / no transitions / insufficient evidence), unknown metrics as
  "Unknown", candidate/possible labels, ambiguous-dependency warning, Isabella
  sections with prediction badge + claims, uncertainty visible, evidence
  drill-down, honest empty findings/packet states.

## Known limitations

- The projection is computed per request (no Projection Engine Runtime yet); very
  large event logs are capped at 5 000 events per run.
- Evidence drill-down shows references, not resolved event records (a future,
  authorized event-inspector could deep-link them).
- `analysisAsOf` is not passed, so open segments show unknown elapsed durations
  (replay-stable engine default) — an explicit "as of now" toggle is future work.
- Milestone predecessor links are derived from canonical `order_index` order
  (the same ordering the Execution Map uses); explicit predecessor data would be
  richer.

## Future improvements

Projection Engine Runtime (cache + invalidation tags), Living Graph overlay mode
(corridors drawn inside the existing graph canvas), Isabella conversational
consumption of the packets, PMO cross-project aggregation (respecting
`filterAuthorizedProjectIds`), event-record drill-down.
