# CAP-045 — Living Graph Process Mining Layer · Foundation Baseline

> **Frozen foundation baseline** for the Living Graph Process Mining Layer. This document
> freezes the approved vision, scope boundaries, non-goals, adopted decisions, design
> principles, hypotheses, and guardrails of **Etapa 1 — Research & Concept Definition
> (July 2026)** — recorded **before** any architecture change, schema, or code.
>
> **Plan traceability:** implementation plan `ProjectOps360_Import_Plan_v1` · **Phase 1 ·
> Task P1-T1** — "Freeze vision, non-goals and foundation baseline" (consolidates original
> Stages 1–2 tasks **S1-T1** and **S1-T3**).
> **Source of the frozen content:** *ProjectOps360 Process Mining Layer — Etapa 1, Research &
> Concept Definition, julio 2026* (Product Owner research output).
>
> **Capability:** CAP-045 ([registry](../05-capability-registry.md)) · **Decision:**
> [PD-015](../30-product-decision-log.md) · **Status of capability:** Documented (concept
> only — no code, no schema, no UI).

---

## Approval block

| Field | Value |
|---|---|
| **Approval status** | ⏳ **Pending Product Owner approval** |
| **Approver** | Efrain Prada — Product Owner (pending) |
| **Approval date** | — |
| **Effect** | This baseline governs all subsequent Process Mining Layer phases. Later phases (ontology, event audit, conceptual design, implementation) **may not begin** until this baseline is Approved. Any change to the frozen content below requires a new Product Owner decision recorded in the [Product Decision Log](../30-product-decision-log.md). |

---

## 1. Vision (frozen)

Turn the Living Graph into a **connected, temporal, and learning representation of how a
project is managed**: Observe → Reconstruct → Compare → Detect → Explain → Correct →
Measure → Learn.

**Product declaration (canonical, original Spanish):**

> "La capa que reconstruye y analiza, por módulo, cómo se ejecutan realmente los procesos de
> project management; compara el comportamiento observado con modelos contextuales, detecta
> bottlenecks, rework y desviaciones, conecta los hallazgos con evidencia dentro de Living
> Graph y permite medir si las acciones de mejora producen mejores resultados."

*(English rendering, non-canonical: the layer that reconstructs and analyzes, per module, how
project-management processes are actually executed; compares observed behavior against
contextual models, detects bottlenecks, rework, and deviations, connects findings to evidence
inside the Living Graph, and makes it possible to measure whether improvement actions produce
better outcomes.)*

**Problem.** ProjectOps360 shows the current state (tasks, risks, milestones, decisions,
budget, blockers), but the current state does not explain the **trajectory** that produced it.
The layer must distinguish active work from waiting / blocking / approval / validation /
rework, reconstruct the real sequence of events, compare against a contextual expected model,
identify frequent paths / exceptions / loops, relate deviations to their impact, and transform
historical evidence into actionable findings.

**Guiding principle.** Analyze **locally per module** and connect **globally through the
Living Graph**.

**Identity.**
- Architectural name: **Living Graph Process Mining Layer**.
- Short name: **Process Mining Layer**.
- User-facing name: **Process Intelligence** when simplification is needed.
- It lives **inside the Living Graph** (it is not an isolated top-level module), with
  navigation **Living Graph → Process Mining Layer → module → case**, covering: Risks,
  Blockers, Decisions, Requirements, Changes, Milestones, Tasks, Project Closure.

## 2. Scope included (frozen)

- Project-management processes executed and recorded **inside ProjectOps360** (own modules
  and authorized integrations).
- Process discovery, variant analysis, performance mining, and conformance checking.
- Cycle, waiting, blocking, approval, validation, and rework times.
- Findings connected to evidence and Living Graph objects.
- Conversational interpretation via **Isabella** with verifiable grounding.
- Analysis initially **project-scoped**; portfolio-scoped in future stages.

## 3. Non-goals (excluded — frozen)

- Analyzing external operational processes (order-to-cash, purchase-to-pay).
- Selecting libraries, algorithms, or definitive infrastructure.
- Designing physical tables or migrations.
- Modifying production or altering existing workflows.
- Creating automatic predictions or prescriptive actions.
- Evaluating individual productivity or creating people rankings (**process — not
  surveillance**).
- Preparing the implementation roadmap (not authorized at Etapa 1 exit).

## 4. Adopted decisions (D-01 … D-08, frozen)

| ID | Decision |
|----|----------|
| **D-01** | The capability is named **Process Mining Layer**. |
| **D-02** | It lives **inside the Living Graph**. |
| **D-03** | Analysis is **per module**, not global by default. |
| **D-04** | Cross-module connections exist as **contextual drill-through**. |
| **D-05** | The experience avoids unnecessary academic terminology. |
| **D-06** | **Risk-to-Resolution** is the primary candidate for the first pilot. Process priority: Risks (1) · Blockers (2) · Decisions (3) · Requirements (4) · Change Control (5) · Milestones (6) · Tasks (7) · Closure (8). |
| **D-07** | No implementation is prepared until the **ontology, event audit, and conceptual design** are complete. |
| **D-08** | Isabella consumes **governed, read-only** analysis tools in the first phase. |

## 5. Design principles (P1 … P10, frozen)

| ID | Principle |
|----|-----------|
| **P1** | Event data as evidence. |
| **P2** | Question-driven analysis. |
| **P3** | Modular first. |
| **P4** | Purposeful abstraction. |
| **P5** | Contextual conformance. |
| **P6** | Deterministic metrics — verifiable services; Isabella does not invent metrics or causes. |
| **P7** | Human validation — a deviation is not automatically a cause or a violation. |
| **P8** | Continuous intelligence. |
| **P9** | Traceability — every conclusion navigates down to events, objects, metrics, and evidence. |
| **P10** | Process — not surveillance. |

## 6. Hypotheses to validate (H1 … H7) — **pending, NOT facts**

| ID | Hypothesis | Validation vehicle |
|----|------------|--------------------|
| **H1** | Per-module analysis beats an integral map | Prototype UX + stakeholder review |
| **H2** | Living Graph can be the navigation layer without duplicating objects | Architecture review |
| **H3** | Risk-to-Resolution has the structure and value for the first pilot | Data audit + pilot scoring |
| **H4** | An object-centric model (OCEL 2.0) represents relationships better than a flat log | Event model prototype |
| **H5** | Initial value will come from waits, rework, and simple deviations | MVP measurement |
| **H6** | Isabella improves with queryable deterministic results | Grounded Q&A tests |
| **H7** | Current historical quality allows partial analyses but will require additional capture | Audit trail inventory |

## 7. Guardrails (frozen)

| Risk | Guardrail |
|------|-----------|
| Spaghetti graph | Modular filtering and progressive disclosure. |
| Incomplete history | Data-readiness score; never invent transitions. |
| Rigid model | Mandatory / Recommended / Contextual rules per context. |
| False causality | Separate observation, hypothesis, explanation, and validated cause. |
| Individual surveillance | Aggregation, RBAC, focus on processes. |
| Visible technical complexity | PM language; Isabella as interpreter. |
| Architectural duplication | Living Graph as container; existing canonical objects. |

## 8. Etapa 1 exit state (frozen as-is)

**Defined:** problem, vision, location, scope and non-goals, prioritized processes,
principles and guardrails, hypotheses.

**Pending (NOT approved at Etapa 1 exit):** physical architecture · data readiness (pending
audit) · implementation plan.

**Open questions transferred to the following phases (12 — verbatim, canonical Spanish,
from the Etapa 1 source document §15):**

1. ¿Qué eventos y audit trails existen actualmente en cada módulo?
2. ¿Qué transiciones se sobrescriben y no pueden reconstruirse?
3. ¿Qué ontología exacta define cada proceso y sus excepciones?
4. ¿Qué parte del modelo debe alinearse con OCEL 2.0 y qué parte será propia?
5. ¿Cómo se representará concurrency en tareas y milestones?
6. ¿Qué modelos de referencia aplican a Agile, predictivo, híbrido, software y construcción?
7. ¿Cuál es el límite entre una desviación válida y una violación?
8. ¿Qué métricas son necesarias en tiempo real y cuáles pueden calcularse por batch?
9. ¿Cómo se versionarán los modelos esperados?
10. ¿Qué volumen de eventos y retención deberá soportar la plataforma?
11. ¿Qué información puede mostrarse a nivel project, portfolio y organization?
12. ¿Cómo se documentará la calidad y cobertura del análisis histórico?

## 9. Relationship to existing Product Brain art (extend & link — no parallel truth)

This baseline **converges with** — and must be realized through — direction already recorded
in the Product Brain. Nothing here creates a second source of truth:

- **[Product Constitution](../00-product-constitution.md) §9 — Process Intelligence Engine
  (PIE) [APPROVED-DESIGN]:** the deterministic engine that computes flow, rework/loops,
  bottlenecks, conformance, and variants over the PEG. The Process Mining Layer is the
  **product/UX capability** (concept stage) whose deterministic computation belongs to that
  engine direction — it does **not** define a competing engine. Constitution §15 already
  requires **ADR-030 Process Mining**; this baseline is the concept-stage input to that ADR.
- **Constitution §7/§8 — Living Graph consumer-only + Graph Mode Engine:** "lives inside the
  Living Graph" (D-02) means **navigation and presentation** (the anticipated "Process" graph
  mode), never computation inside the visualization layer. This matches H2 and the
  architectural-duplication guardrail.
- **Constitution §4 — Project Event Graph (PEG):** the event substrate this layer will need;
  the Etapa 1 event audit (H7 / plan Phase 2) aligns with PEG Phase 2.
- **[Milestone Process Flow Engine](../milestone-process-flow-engine-architecture.md)
  (implemented):** existing read-only process-flow analysis for milestones (transitions,
  rework, delays). Prior art for the Milestones process (priority 6 in D-06); the Process
  Mining Layer must consolidate with it, not fork it.
- **Isabella Process Intelligence**
  ([architecture](../isabella-process-intelligence-architecture.md)): existing
  diagnosis/root-cause/recommendation layers. D-08 (governed read-only tools) extends this
  consumption pattern.
- **[12-living-graph-strategy.md](../12-living-graph-strategy.md) / UX-007 (PD-008):** the
  Living Graph already exposes a "Process Mining" layout-mode label; naming will be
  reconciled when the layer ships a real surface.

**Naming note (recorded for the Product Owner):** the user-facing name "Process Intelligence"
(identity, §1) coexists with the internal "Product Intelligence" (Product Brain Center,
CAP-042) and the "Isabella Process Intelligence" engine docs. Accepted at baseline; revisit
at first user-facing surface if confusion appears.

## 10. What this document is NOT

Per the non-goals and D-07: this baseline authorizes **no** architecture, no schema, no
migration, no UI, no library selection, no predictions, and no implementation roadmap. It is
documentation and governance only.

## 11. Links

[05-capability-registry.md](../05-capability-registry.md) (CAP-045) ·
[30-product-decision-log.md](../30-product-decision-log.md) (PD-015) ·
[00-product-constitution.md](../00-product-constitution.md) (§4, §7–§9, §15) ·
[12-living-graph-strategy.md](../12-living-graph-strategy.md) ·
[00-index.md](../00-index.md)

## 12. Last reviewed

2026-07-10 — created (P1-T1, docs-only). Approval pending — see Approval block. The 12 open
questions of §8 were transcribed verbatim from the Etapa 1 source document (§15).
