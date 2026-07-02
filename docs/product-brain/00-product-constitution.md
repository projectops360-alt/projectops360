# 00 — ProjectOps360° Product Constitution

> **Authoritative reference** for ProjectOps360° architecture and product direction. Consolidates all
> approved Phase 0 and Phase 1 decisions into one source of truth. Where this document and any other
> doc/prompt/chat conflict, **this Constitution wins for direction**, and the executable guards
> (`regression-test-map.md`, `contracts.ts`) win for *behavior*. Ratified before the Event Log
> Foundation (Phase 2).
>
> **Status legend per capability:** **[IMPLEMENTED]** in production · **[APPROVED-DESIGN]** ratified,
> not built · **[FUTURE]** directional. This separation is binding — no one may present design as
> shipped.

---

## 1. Platform Vision
ProjectOps360° is an **AI-native Project Intelligence Platform**: not a task list, but a **living
process** you can see, question, reason about, and continuously improve. Projects generate events →
events reveal flow → flow reveals friction → friction reveals root causes → root causes reveal
improvements → improvements make future projects smarter.

## 2. Product Philosophy
- **Different views, same truth.** Every surface (Workboard, Living Graph, Dashboards, Reports,
  Portfolio, Isabella) shows the same business fact from the same canonical owner.
- **Evidence over opinion.** Deterministic engines compute facts; AI explains, compares, recommends —
  never invents.
- **Knowledge over data.** The product understands *how* work flowed, not only *what* happened.
- **Action over observation.** Every surface exists to support a decision, action, or explanation.
- **Corrected behavior must remain corrected.** No feature is done if it silently degrades something.

## 3. Canonical Source of Truth (binding principle)
**One owner per business fact.** Consumers (Living Graph, Workboard, Dashboards, Reports, Isabella)
**never** reconstruct facts, **never** query canonical tables where a resolver exists, **never**
compute business truth. Proven by **CAP-001 [IMPLEMENTED]**: the Living Graph milestone census now
derives from `roadmap_tasks` via `computeMilestoneTaskCensus`, not from `process_nodes`.
Canonical owners (abridged): tasks → `roadmap_tasks`; milestones → `milestones`; execution status →
`status-engine.ts` (ADR-006); metrics/health → `project-rollup-engine.ts` + `task-activity.ts`
(REG-010); critical path → `lib/execution/critical-path.ts` (single owner; retire the client
longest-path duplicate); capacity → `lib/capacity/service.ts`. **The Living Graph is always a
projection; the Projection Engine never owns business data.**

## 4. Project Event Graph (PEG) — [APPROVED-DESIGN]
The **operational memory**: an append-only ledger of immutable, past-tense **fact events**. A subject's
state (task, risk, RFI) is **reconstructed** from its events; corrections are compensating events,
never edits. Universal Event Envelope: `eventId · seq · org/project · category/type · subject ·
verb · actor · occurredAt/recordedAt · causality{causedBy,correlationId,sagaId} · provenance ·
confidence · impact · payload`. Core taxonomy (22 categories) + industry event packs. Seed exists:
`emit-event.ts` [IMPLEMENTED, ~8 event types]. **Phase 2 builds this foundation.**

## 5. Project Knowledge Graph (PKG) — [FUTURE]
A **deterministic projection of the PEG**: canonical entity-nodes with state, provenance, confidence,
and typed relationships (a disambiguated ontology replacing the overloaded `caused`/`enabled`).
Substrate ready: `embedding vector(1536)` + HNSW on `process_nodes`; Knowledge OS (`match_knowledge`,
`product_intelligence`) [IMPLEMENTED for Isabella corpus].

## 6. Projection Engine — [APPROVED-DESIGN]
Server-side layer of **pure resolvers**: `resolveX(ownerScope, ctx) → Projection<T>{data, meta}`. It
OWNS projection contracts/resolvers/metadata/validation/consistency/freshness; it NEVER owns business
data, ledger, KG, AI reasoning, runtime state, UI, or permission policy. Every projection carries
`ProjectionMetadata` (sourceOwner, sourceVersion, projectionVersion, freshnessStatus, syncStatus,
confidence, evidenceRefs, warnings, permissionScope). First resolver already lives: the CAP-001
census. **Rule:** a resolver reads owners only, never another projection or raw tables from a view.

## 7. Living Graph Engine — [APPROVED-DESIGN over IMPLEMENTED base]
Evolves from client-heavy analytics to a **pure visualization/interaction/explanation layer** that
consumes the Projection/Runtime/Intelligence engines. It OWNS presentation only (layout, viewport,
selection, hover, animation, density, navigation, interaction state). It NEVER owns or computes
milestone counts, progress, project/process health, critical path, execution status, risks, resources.
Data model separates Business/Projection/Runtime/Presentation/Interaction. Protected behavior
[IMPLEMENTED]: blocked≠waiting (REG-006/008), Saved Layouts presentation-only (UX-007), edge tooltip
read-only + source-phase scoped (UX-008 + CAP-001 follow-up), header==indicators. Rendering is behind
a **Rendering Adapter** (React Flow today, replaceable).

## 8. Graph Mode Engine — [APPROVED-DESIGN]
**One engine, unlimited modes as plugins.** A `GraphMode` declares required resolvers/runtime/layers/
layouts/overlays/panels/commands/permissions — **never business logic**. Independent **visual layers**
(Health/Risk/Resource/Capacity/CriticalPath/Process/Knowledge/AI/Runtime/…) compose. Mode switching is
instant (reuses store + projections + runtime; no rebuild/relayout/reload). Standard modes: Live,
Project Execution, PM, PMO, Executive, Portfolio, Process, Critical Path, Risk, Resource, Capacity,
Timeline, Audit, Digital Twin, Knowledge, Isabella Explanation. Includes Historical Projection + Time
Machine (supplied by the Projection Engine, visualized by the Mode Engine).

## 9. Process Intelligence Engine (PIE) — [APPROVED-DESIGN]
Deterministic engine over the PEG + owners that fuses PM · BPM · Process Mining · Lean/Six Sigma ·
Theory of Constraints · CPM/Critical Chain · OpEx · Digital Twin analytics. Computes flow (cycle/lead/
wait/idle/touch), rework/loops, handoffs, bottlenecks, constraints, conformance (declared vs actual),
variants, Process Health Score, milestone-to-milestone flow, predictions, and evidence-backed
recommendations feeding a Learning Loop. It produces **derived intelligence**, never a source of truth.
Every metric traces to source events; every recommendation carries evidence + confidence.

## 10. PM & PMO Decision Centers — [APPROVED-DESIGN over IMPLEMENTED seeds]
Dashboards are **execution cockpits**, not widget walls. Every section supports a decision/action/
explanation, consumes Projection/Process/Prediction resolvers, and shows a **Trust Bar** (lastUpdated,
freshness, source, confidence, evidenceCount, warnings, sync). PM = one active project day-to-day;
PMO = many projects as an operating system; Executive = business impact without task noise. Role-scoped
(RBAC). Seeds [IMPLEMENTED]: deterministic PM briefing (`briefing-engine`, REG-013), portfolio briefing
(`portfolio-engine`), Project Status card (REG-015/UX-009). Includes Recommendation/Action Center,
Alert/Escalation model, Decision Queue, Approval Queue (over-approval + bottleneck detection).

## 11. Isabella Governance (binding)
Isabella is a **consumer**, never an owner. She MAY explain/summarize/compare/recommend/predict/coach.
She MUST consume Projection metadata + evidenceRefs + Knowledge Graph + Runtime context, **never infer
from the UI**. Every statement **cites evidence** and **classifies itself** as Fact · Inference ·
Prediction · Recommendation · Uncertainty, and declares freshness/confidence. She MUST NEVER claim a
number without a source, a cause without `causedBy`, a portfolio comparison without normalization, a
prediction without horizon+confidence, or certainty on weak evidence. (ADR-005.) Isabella experience
[IMPLEMENTED]: conversation, screen intelligence, project briefing (REG-013), welcome hero (REG-014).

## 12. AI-Native Project Execution™ Classification — [IMPLEMENTED]
A canonical project type (`ai_native_execution`) alongside software/construction/etc. **Identify-only**:
selectable, stored, displayed; **no** AI workflows, provider integrations, or behavior change. Acts as a
**feature flag** for future AI-native capabilities. Owner: `ProjectType` in `src/types/execution.ts`.

## 13. Task AI Execution Record (TAER) — [PARTIAL IMPLEMENTED + FUTURE]
The AI execution trail per task (prompt used, context, AI tool/model, version, timestamp, reviewer
notes, approval, follow-up, files changed, lessons learned). Core fields exist on `roadmap_tasks`
(`prompt_body`, `prompt_context`, `ai_tool_target`, `prompt_version`, `last_prompt_sent_at`) and are
now exposed as a **scoped "AI Execution" section** for software/AI-native projects only
(UX-014 amended / PD-013, [IMPLEMENTED]). Future: dedicated append-only TAER entity + response/approval/
lessons fields, consumed by the PIE as process events and visualized by a Graph Mode. Append-only;
prompt metadata never a generic field for all tasks (UX-014 default-hidden, scoped-visible).

## 14. Regression Protection Framework (binding) — [IMPLEMENTED apparatus]
The product's #1 failure is re-breaking solved problems; **documentation did not stop it — executable
guards do.** No REG-### is closed without a test that fails if it returns (`regression-test-map.md`).
Protection spans 15 layers (business → domain → PEG → PKG → runtime → projection → living graph → UX →
AI → performance → security → data integrity → portfolio → process → audit). CI (typecheck + test:run +
build) + strict branch protection on `master`. Stop-Gate integrities before merge: Business ·
Architectural · Projection · Knowledge · AI · Performance · Regression.

## 15. ADR Catalog (approved/required)
ADR-002 Living Graph primary surface · ADR-005 Isabella primary AI interface · ADR-006 Independent
status dimensions · ADR-003/009 Resource Capacity. **Required by Phase 1:** ADR-013 Canonical Source of
Truth · ADR-014 Project Event Graph · ADR-015 Project Knowledge Graph · ADR-016 Projection Engine ·
ADR-017 Process Intelligence Engine · ADR-018 Predictive Process Intelligence · ADR-019 Learning Engine ·
ADR-020 Living Graph responsibilities (consumer-only) · ADR-021 AI governance · ADR-022 Engine
communication (no internal-state reads) · ADR-023 Knowledge governance · ADR-024 Graph Mode Engine ·
ADR-025 Mode Contract/Plugin isolation · ADR-026 Visual Layer System · ADR-027 Rendering Adapter ·
ADR-028 Historical/Time Machine · ADR-029 Process Health Score · ADR-030 Process Mining · ADR-031
Milestone Flow · ADR-032 Recommendation governance · ADR-033 Isabella dashboard governance · ADR-034
Portfolio Process Intelligence · ADR-035/036/037 PM/PMO/Projection dashboard contracts · ADR-038 Action
Center · ADR-039 Alert/Escalation · ADR-040 Freshness/Trust · ADR-041 Role-based dashboards.

## 16. Implementation Roadmap (order of least risk / highest leverage)
1. **Projection Engine M1** — `lib/projection-engine/` wrapping the existing census resolver as
   `Projection<T>`+metadata + a `no-direct-table-access` guard. *(Risk ~nil; anchors everything.)*
2. **PEG M1 (Phase 2)** — populate the event log (process fields: caseId/duration/causedBy) via
   `emit-event` + backfill + snapshots. *(Prerequisite for all process intelligence.)*
3. **Dashboard M1** — wrap `briefing-engine`/Project Status as `resolvePMDashboardProjection` + Trust Bar.
4. **Living Graph M1–M2** — normalized store in shadow; move `computeGraphHealth`/longest-path to the
   PIE (retire client duplicates); separate filter from layout; real virtualization.
5. **Graph Mode M1** — Rendering Adapter; layers; wrap current experience as "Live Execution Mode".
6. **PIE / Prediction / Recommendation / Learning Loop**, then **PKG**, then **Portfolio/Audit/Digital
   Twin**. Each phase: DoD (typecheck+test:run+build) + consistency/no-direct-access/evidence guards.

## 17. Engineering Principles (permanent)
Single Canonical Owner · Everything Event-Driven · Everything Explainable · Everything Traceable ·
Everything Observable · Everything Versioned · Every Projection Disposable · Knowledge over Data ·
Evidence over Opinion · AI Assists—Never Invents · Corrected Behavior Stays Corrected · No Engine Reads
Another Engine's Internal State · Communication only via Canonical Models / Published Events / Public
Contracts.

## 18. Guardrails (do-not-cross)
No view queries canonical tables where a resolver exists · no duplicated business logic in the UI · no
metric without source metadata · no AI insight without evidence/confidence · no stale data without a
warning · no projection becomes a source of truth · no engine mutates business data from rendering · no
protected contract (REG/UX) overridden silently — surface, decide, record (CLAUDE.md rule #4) · no
Spanglish (UX-012, EN/ES key-parity) · Workboard operable without browser zoom (UX-013).

## 19. Future Phases
- **Phase 2 — Event Log Foundation** (current): PEG schema + population + snapshots.
- **Phase 3 — Projection & Runtime**: Projection Engine + incremental Runtime + realtime deltas.
- **Phase 4 — Intelligence**: Process Intelligence + Prediction + Recommendation + Learning Loop.
- **Phase 5 — Experience**: Graph Modes + Decision Centers + Historical/Time Machine.
- **Phase 6 — Knowledge & Portfolio**: PKG + Portfolio/Program + Audit/Digital Twin + Graph Workspaces.

## 20. Risks & Open Decisions
- **R1** Building higher layers before the PEG/Projection Engine exist → duplicated logic (the CAP-001
  failure class). Mitigation: strict roadmap order; guards.
- **R2** Retiring client-side health/critical-path without visual regression.
- **R3** Unpopulated event strata (Issue/Budget/Risk owners; process fields) block intelligence.
- **R4** `living-graph-view.tsx` God component must be refactored before the incremental store.
- **R5** Two Vercel accounts + split GitHub↔domain deploy (operational, not product) — consolidate.
- **Open:** freshness push (realtime) vs pull (revalidate) until the Runtime Engine exists; `Case`
  granularity (project vs sub-case); `projectionVersion` global vs per-resolver; incremental vs batch
  process metrics; one owner to instantiate for Issue/Budget/Risk (strata C).

---

## 21. Ratification
This Constitution is the source of truth for architecture and product direction. Future implementation
tasks reference it. It contains **no conflicting principles**: implemented reality, approved design, and
future direction are labeled distinctly, and the executable guards remain the binding authority for
behavior. **Event Log Foundation (Phase 2) requirements must align with §4 and §16 before the
`project_event_log` schema is designed.**

**Last consolidated:** 2026-07 · Phase 0 + Phase 1 complete.
