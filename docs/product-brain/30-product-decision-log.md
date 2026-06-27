# 30 — Product Decision Log

The canonical ledger of product decisions from the product-owner review of Workboard, Critical
Path, the Living Graph, and its advanced overlays. Each decision is binding and overrides
conversation/prompt history ([ADR-000](adrs/ADR-000-product-intelligence-source-of-truth.md)).

Status legend: **Shipped** (live in prod) · **Partial** (some of the decision shipped) · **Decided**
(recorded, not yet built).

---

## PD-001 — Critical Path lives inside the Living Graph
- **Decision:** Critical Path is computed and shown in the **Living Graph** — the single source of
  truth. **Reason:** the graph already represents dependencies, milestones, execution status,
  downstream impact, blockers, waiting states, risks, and flow, so it is the correct surface.
- **Rule:** Roadmap/Execution Map must NOT maintain a separate Critical Path engine, and must NOT
  show a "coming soon" placeholder when Critical Path already exists in the Living Graph. It may
  provide an **entry point** (Project → Execution Map → Living Graph → Critical Path overlay).
- **Status: Shipped** — Sprint #1 ([doc 26](26-sprint-01-operational-clarity.md)); the Execution
  Map tab now deep-links to `…/living-graph?overlay=criticalPath`. CAP-005/CAP-023, ADR-002.

## PD-002 — Workboard task card ownership
- **Decision:** Workboard cards must show **assignee avatar/initials (when available) · name ·
  role (when available)**, or **"Unassigned"** when there is no owner. **Reason:** a PM must know
  who owns each task without opening the detail panel — operationally required, not decorative.
- **Rule:** real assignment data only; never invent a name; a failed lookup → "Unassigned".
- **Status: Shipped** — Sprint #1 + follow-up (2026-06-27): the card shows **avatar (or initials)
  · name · role**, with **"Unassigned"** when no owner and **"Assigned user unavailable"** when an
  owner id resolves to no name. Role comes from `project_team_members.project_role` (person) or
  `resources.resource_type` (group); avatar from `profiles.avatar_url`. Names resolved via the
  admin client (RLS-safe, cross-org). Real data only. CAP-020,
  [doc 26](26-sprint-01-operational-clarity.md). Helper `src/lib/roadmap/task-owner.ts` (unit-tested).

## PD-003 — Variance View requires a baseline
- **Decision:** Variance View shows real variance only when an approved **baseline** exists
  (baseline/planned vs current/actual/forecast). **Rule:** do NOT invent variance values.
- **Empty state:** "Variance View requires a project baseline. Create or approve a baseline first
  to compare planned vs actual performance." (with a CTA to the Delivery Framework).
- **Status: Shipped** — Sprint #3 overlay clarity ([doc 28](28-sprint-03-overlay-clarity.md));
  deterministic empty/incomplete states in `overlay-metadata.ts`.

## PD-004 — Timeline Playback requires real history
- **Decision:** Timeline Playback is based on **real** project events, status history, audit logs,
  Project Memory events, dependency changes, or graph snapshots. **Rule:** do NOT show fake playback.
- **Empty state:** "Timeline Playback requires project history. Start capturing task changes,
  decisions, risks, dependencies, and Project Memory events to enable playback."
- **Status: Shipped** (clarity/empty state) — Sprint #3 ([doc 28](28-sprint-03-overlay-clarity.md)).

## PD-005 — What-if Simulation is sandbox-first
- **Decision:** What-if Simulation may change variables (delay task, move milestone, change
  dependency, reassign, reduce availability) **inside a sandbox**. **Rule:** no simulation may
  modify real project data unless the user **explicitly applies** it; results always labeled
  **"Simulation only — no project data changed."**
- **Status: Shipped** (the existing deterministic what-if + the Sprint #3 clarity card enforce the
  "estimate only, nothing changes" framing). [doc 28](28-sprint-03-overlay-clarity.md).

## PD-006 — Risk / SOP disconnected nodes must be explained
- **Decision:** Disconnected nodes in Risk View or SOP Candidate View must NEVER look like broken
  graph behavior.
  - Unlinked risk → "This risk is not linked to any task or milestone yet."
  - Unlinked SOP candidate → "Detected from repeatable work patterns but not linked to a formal
    process yet."
  - If caused by missing edges / layout bugs → fix edge generation / layout in implementation.
- **Status: Shipped** (explanations) — Sprint #3 overlay clarity card surfaces the incomplete state
  with disconnected counts ([doc 28](28-sprint-03-overlay-clarity.md)). Edge/layout bug-hunting is
  a follow-up if any disconnected nodes are found to be real bugs.

## PD-007 — Living Graph Focus Mode
- **Decision:** The Living Graph must include **Focus Mode** that maximizes the canvas, collapses
  secondary filters / large KPI blocks / legend (default collapsed), reduces toolbar noise, hides
  long helper text, keeps only essential controls, and exits easily. **Reason:** the Living Graph
  must be the protagonist of the page.
- **Status: Shipped** — Sprint #2 ([doc 27](27-sprint-02-living-graph-focus.md)); in-page Focus Mode
  toggle, Insights/Legend collapsed by default. ADR-002.

---

## Affected modules
Living Graph (CAP-005) · Workboard/Tasks (CAP-020) · Critical Path (CAP-023) · Risk Management
(CAP-017) · Variance/Process Intelligence · Timeline/History · What-if Simulation · Delivery
Framework (CAP-039, baseline) · Project Memory (CAP-006, history). See
[22-modules.md](22-modules.md).

## Follow-ups still open
- **PD-006:** verify any disconnected Risk/SOP nodes are explained-only, not edge/layout bugs.
- A standalone **Workboard** module doc and a **Variance/Baseline** module doc could be created when
  those areas next get focused work (today they live in the sprint docs + this log).
