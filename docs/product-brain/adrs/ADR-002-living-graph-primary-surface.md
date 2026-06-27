# ADR-002 — Living Graph is a primary intelligence and navigation surface

**Status:** Accepted · 2026-06-27

## Context
The Living Graph has at times been reduced to a decorative visualization. Its strategic
intent is much larger: it is the digital twin of the project and a navigation layer.

## Decision
The Living Graph is a **primary intelligence and navigation surface** — a visual digital
twin connected to people, resources, risks, issues, decisions, documents, meetings,
communication, and capacity. It is a relationship engine, an impact-analysis surface, and an
AI explanation surface — not only a chart.

## Consequences
- The graph must consume the Execution Status Engine (ADR-006) and Resource Capacity
  Intelligence (ADR-003), and be explainable by Isabella (ADR-005).
- Investments in the graph are strategic, not cosmetic; it should become a way to *navigate*
  the product, not just view it.
- Anti-pattern guard: any change that turns the graph back into a static picture must be
  justified by an ADR.

## What this prevents
- Re-decorating the graph while its intelligence role atrophies.
- Losing the graph's connections to capacity, status, and the AI layer (see REG-005).

## Related capabilities
CAP-005 Living Graph, CAP-009 Resource Capacity, CAP-015 Executive Command Center, CAP-016.

## Related modules
`lib/graph`, `components/graph`, `lib/capacity`, `lib/execution`.
