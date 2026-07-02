# Milestone Transition & Flow Segment Builder (Phase 3, Task 3)

> Companion to the [MPF Engine Constitution](./milestone-process-flow-engine-constitution.md),
> [Architecture Note](./milestone-process-flow-engine-architecture.md), and
> [Event Semantics](./milestone-process-flow-event-semantics.md). Task 3 builds the
> first executable MPF **structure** — transition corridors and flow segments. It
> does **not** compute final metrics, final transition health, bottlenecks, or
> constraint propagation (later tasks), and builds no UI.

## What it does

Turns read-only milestone refs + Project Event Graph event refs (+ Task 2
semantics) into **milestone transition corridors** and the **flow segments**
inside them, with evidence refs and preliminary structural state. Pure,
deterministic, replay-stable, read-only over canonical truth.

## Files

| File | Responsibility |
|---|---|
| `src/lib/milestone-flow/transition-builder-types.ts` | `BuiltMilestoneTransition` / `BuiltMilestoneFlowSegment` (extend the Task 1 contract types additively), assignment + unassigned types, build result + stats, builder warning codes. |
| `src/lib/milestone-flow/flow-segment-builder.ts` | `buildFlowSegmentsForTransition`, `normalizeMilestoneFlowEventOrder`, `createMilestoneFlowSegmentId`. |
| `src/lib/milestone-flow/transition-builder.ts` | pairing, ordering, event assignment, preliminary state, and the main `buildMilestoneTransitions`. |
| `engine.ts` (updated) | `buildTransitionModel` / `buildFlowSegments` now delegate to the builder; `buildMilestoneFlowProjection` populates transitions + observability. Metrics/health stay deferred. |

## 1. How transition pairs are created

Milestones are ordered deterministically, then **consecutive** `source → target`
pairs are formed (m₁→m₂, m₂→m₃, …). Ordering rule (documented, in priority):

1. **By date** — `actualDate ?? forecastDate ?? plannedDate`, tie-broken by `milestoneId`.
2. **By predecessor chain** — when no dates exist but `predecessorMilestoneId`
   links do (topological, tie-broken by id).
3. **Neither** → order is genuinely unknown → **no transitions**, warning
   `MISSING_MILESTONE_ORDER`. Order is never invented.

A **single** milestone yields no pair (`SINGLE_MILESTONE_NO_TRANSITION`). Transition
ids are deterministic: `mpf_tr_<project>_<source|start>_to_<target>`.

## 2. How events are assigned to transitions

Per event, in order:

1. **Explicit milestone** (`event.milestoneId`, or a `milestone` subject) → the
   corridor whose **target** is that milestone, else whose **source** is that
   milestone. No match → unassigned (`UNASSIGNED_EVENT`).
2. **Timestamp within a corridor window** — `[source achieved, target achieved)`,
   where "achieved" comes from a milestone-closing event, else `actualDate`. A
   single containing window wins; overlaps pick the **narrowest** window
   (stable by transition id).
3. Invalid/missing timestamp with no explicit milestone → `MISSING_EVENT_TIMESTAMP`.
4. Otherwise → unassigned with reason. **Nothing is discarded silently** — every
   unassigned event is reported with a machine-readable reason.

## 3. How flow segments are built

Assigned events are ordered (`normalizeMilestoneFlowEventOrder`), then each event
is classified via **Task 2** `classifyMilestoneFlowEvent` (never re-derived). A new
segment begins whenever the semantic `flowSegmentType` changes — which naturally
opens `blocked` / `decision_delay` / `approval_delay` / `rework` segments and
**closes** them on the resolving event (which classifies as `active_work`). Each
segment carries `sourceEventId`, `closingEventId`, `semanticCategories`,
`evidence`, aggregate `confidence`, `notes`, and `isOpenEnded`. Segment types reuse
the Task 1 vocabulary. `durationMs` stays **null** — durations are the Metrics
Calculator's job.

## 4. Unknown / unassigned handling

Unknown event semantics → `unknown` segment (never dropped) + `UNKNOWN_EVENT_SEMANTICS`
warning. Missing order / missing timestamp / ambiguous relation / incomplete
boundary all become **warnings**, not fabricated certainty. A transition with no
target-achieved evidence stays **open** (`TRANSITION_BOUNDARY_INCOMPLETE`) — never
force-completed.

## 5. Backfill & compensating events

Provenance is preserved via Task 2 `buildMilestoneFlowEvidenceRefFromEvent`:
backfilled events are capped below `high`; compensating events are included as
**correction-aware** evidence (a note on the ref) and **never erase** the original
event's evidence — both appear in the segment's evidence list.

## 6. Preliminary transition state (NOT final health)

`classifyTransitionStateFromSegments` derives structural status only:
`pending` (no events) · `active` (running) · `completed` (target achieved) ·
`regressed` (rework after completion) · `unknown` (only unknown segments). This is
**not** health — the Health Classifier (later task) consumes segments to produce
evidence-backed health.

## Observability

Each run summary now includes `transitionCount`, `segmentCount`,
`unassignedEventCount`, `unknownSegmentCount`, `openTransitionCount`,
`completedTransitionCount`, plus warnings for missing order/timestamps, unassigned
events, unknown semantics, and incomplete boundaries.

## Intentionally NOT implemented (Task 3)

Final metrics (waiting/active/blocked/delay/rework durations), final transition
health, bottleneck classification, constraint propagation, Projection Runtime,
Isabella natural-language output, and all UI.

## How later tasks consume this

- **Metrics Calculator (next task)** — walks each transition's ordered segments
  and computes durations (`durationMs`), waiting/active/blocked/decision/approval/
  rework times, and flow efficiency, using segment `startedAt`/`endedAt`/`type`.
- **Health Classifier** — consumes segments + metrics + evidence to produce
  evidence-backed transition health (replacing the preliminary structural state).
- **Living Graph / Isabella / dashboards** remain **consumers** of these outputs;
  they must not re-derive transition or segment structure.
