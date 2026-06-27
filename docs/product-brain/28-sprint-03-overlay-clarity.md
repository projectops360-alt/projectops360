# 28 — Sprint #3: Living Graph Overlay Clarity & Intelligence

Make every advanced Living Graph overlay **self-explanatory, evidence-based, and actionable**.
Every overlay must answer three questions: **(1) What am I looking at? (2) Why is this node here?
(3) What should I do next?** If it can't, it isn't ready to be shown as an intelligence view.

> Scope guard: no new engines, no decorative overlays, no AI-invented relationships. This sprint
> adds a **deterministic clarity layer** over the existing overlays.

---

## Decision (binding)
- Each overlay has a **metadata record** (`src/lib/graph/overlay-metadata.ts`): purpose, data
  requirements, empty-state, incomplete-data message, overlay-specific legend, recommended level,
  user action, related PI doc, and `canExplainWithIsabella`.
- A compact **overlay clarity card** (`overlay-info.tsx`) renders this on the canvas for the
  advanced overlays — lightweight, dismissible, collapses to a chip (never steals graph space).
- **Empty / incomplete states are explicit and deterministic** (`resolveOverlayState`): no overlay
  silently shows a faded/disconnected graph without saying why and what to do.
- **Isabella may narrate this metadata** (ADR-005) but must never invent risks, SOP candidates,
  variance values, history, simulation results, dependencies, or baselines.

## The five advanced overlays
| Overlay | What it is | Data it needs | Empty/incomplete guidance | User action |
|---------|-----------|---------------|---------------------------|-------------|
| **Risk View** | Risks + the work they threaten | risks, risk→task/milestone links, severity, status | "Some risks aren't linked to tasks/milestones yet" | Link risks to affected work |
| **SOP Candidate View** | Repeatable, well-evidenced work that could become an SOP | completed work, evidence, repeated patterns | "Detected from repeated patterns; not yet a formal process" | Review / formalize / dismiss |
| **Variance View** | Plan vs actual/forecast deviation | baseline, current/actual, variance | "Requires a baseline" → CTA **Open Delivery Framework** | Corrective action or re-baseline |
| **Timeline Playback** | How the project changed over time | events, status/milestone changes, snapshots | "Requires project history" | Replay the project's evolution |
| **What-if Simulation** | Impact of a change before applying it | dependencies, dates, critical path (capacity opt.) | "Pick a node to simulate — **estimate only, nothing changes**" | Test a scenario, then optionally apply |

## Determinism & safety
- Signals are computed from the displayed graph (risk nodes, SOP scores, variance metadata,
  events, simulation state) — never fabricated.
- **What-if Simulation never changes real project data** until the user explicitly applies it; the
  card always labels results "simulation only."
- Overlay-specific legends replace ambiguity with concrete colour meanings per view.

## What was intentionally NOT changed
Overlay engines/semantics, capacity/AI logic, the Workforce/Labor layers, Critical Path,
Waiting-vs-Blocked, Focus Mode (Sprint #2), and the Sprint #1 Workboard/Roadmap changes — all
intact (280 tests green).

## Refinements (2026-06-27)
- **Overlay metadata** now also carries **`recommendedLayout`** (Part G complete): each overlay
  declares its best level + layout.
- **Timeline real-history detection:** the empty state ("requires project history") now triggers
  when events span **< 2 distinct days** (`countDistinctEventDays`) — a one-shot import has no
  evolution to replay, so we never show fake playback (PD-004).
- **What-if sandbox labels:** the simulation block always shows **"Simulation only — no project
  data changed"** and an explicit **"Apply simulation is not available yet"** (PD-005) — the
  deterministic what-if never mutates real data and there is no apply path yet.
- **Already shipped earlier:** Focus Mode (Sprint #2, [doc 27](27-sprint-02-living-graph-focus.md)),
  Variance baseline empty state, Risk/SOP disconnected-node explanations (this doc).
- **Honest follow-up:** Risk/SOP *node-level* detail enrichment (severity/probability/owner/source
  in the node panel) needs the risk/SOP record fields mapped into graph node metadata — not yet
  done; the disconnected-node *explanations* and counts are in place.

## Protection rule
An overlay that cannot answer "what am I looking at / why is this node here / what next" is not an
intelligence view and must show a useful empty/incomplete state rather than a confusing graph.
