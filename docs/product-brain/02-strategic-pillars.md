# 02 — Strategic Pillars

Every capability and feature must ladder up to one of these six pillars. If a proposed
feature maps to none of them, it needs an ADR before it is built.

---

## P1 — AI-First Execution
The product is operated *with* an AI workforce, not just decorated with AI. Isabella +
Knowledge OS sit at the center; the AI explains, recommends, and (eventually) acts.
- Anchors: Isabella, Knowledge OS, AI Workforce, AI Recommendations.
- ADR: [`ADR-001`](adrs/ADR-001-ai-first-execution-os.md), [`ADR-005`](adrs/ADR-005-isabella-primary-ai-interface.md).

## P2 — Living Intelligence (Digital Twin)
The project is represented as a single living model — the **Living Graph** — that is the
primary intelligence and navigation surface, not a side visualization.
- Anchors: Living Graph, Execution Status Engine, Critical Path, Impact Analysis.
- ADR: [`ADR-002`](adrs/ADR-002-living-graph-primary-surface.md), [`ADR-006`](adrs/ADR-006-independent-status-dimensions.md).

## P3 — Resource & Capacity Intelligence
The product understands the *workforce*: real capacity vs plan, overhead, utilization,
availability, and (future) burnout and forecasting.
- Anchors: Resource Capacity Intelligence, Labor Capacity, Workforce Health.
- ADR: [`ADR-003`](adrs/ADR-003-resource-capacity-intelligence.md).

## P4 — Execution Truth
Status shown to users must be deterministic and honest. Execution, Dependency, Health, and
Risk are **independent dimensions** that are never conflated.
- Anchors: Execution Status Engine, Project Health Engine, Readiness, Critical Path.
- ADR: [`ADR-006`](adrs/ADR-006-independent-status-dimensions.md).

## P5 — Institutional Memory
The product never forgets. Project knowledge (Project Memory) and product knowledge
(Knowledge OS + this Product Brain) are first-class, searchable substrates.
- Anchors: Project Memory, Project Scribe, Knowledge OS, Product Brain.
- ADR: [`ADR-004`](adrs/ADR-004-knowledge-os-substrate.md), [`ADR-007`](adrs/ADR-007-product-brain-is-source-of-truth.md).

## P6 — Governance & Adaptive Delivery
The product adapts how each project is executed (predictive/agile/hybrid) and enforces
governance, roles, and isolation.
- Anchors: Project Charter & Governance, Adaptive Delivery Framework, RBAC, Team Workspace.
- ADR: (to be written as governance decisions are formalized).

---

### Pillar coverage snapshot (see registry for detail)

| Pillar | Maturity (rough) | Biggest gap |
|--------|------------------|-------------|
| P1 AI-First Execution | Medium-High | Multi-expert AI Workforce; AI taking actions |
| P2 Living Intelligence | Medium-High | Graph as true navigation/impact surface |
| P3 Resource & Capacity | Medium | Forecast, burnout, simulation, digital twin |
| P4 Execution Truth | Low-Medium | Execution Status Engine not yet wired |
| P5 Institutional Memory | High | Cross-project memory, Product Brain adoption |
| P6 Governance & Delivery | Medium | RBAC parity on `master` (regression risk) |
