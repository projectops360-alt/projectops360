# capabilities/

Deep-dive documents for individual capabilities. The canonical summary lives in
[`../05-capability-registry.md`](../05-capability-registry.md); create a file here
(`CAP-0XX-name.md`) when a capability becomes a focus of work and needs more depth than the
registry row.

**Each capability deep-dive should cover:** full description, business value, current
implementation (file-level), data model, surfaces/APIs, dependencies, known gaps, known
regressions, roadmap, and links to specs/ADRs.

Recovery docs that already serve this purpose at the top level:
- Living Graph → [`../12-living-graph-strategy.md`](../12-living-graph-strategy.md)
- Resource Capacity → [`../13-resource-capacity-intelligence.md`](../13-resource-capacity-intelligence.md)
- Execution Status Engine → [`../18-execution-status-engine.md`](../18-execution-status-engine.md)

Deep-dives in this folder:
- **CAP-045 Living Graph Process Mining Layer** →
  [`CAP-045-process-mining-layer-foundation-baseline.md`](CAP-045-process-mining-layer-foundation-baseline.md)
  — frozen Etapa 1 foundation baseline (P1-T1 / PD-015).
- **CAP-045 · Risk-to-Resolution ontology** →
  [`CAP-045-process-mining-layer-ontology-risk-to-resolution.md`](CAP-045-process-mining-layer-ontology-risk-to-resolution.md)
  — canonical PM ontology & lifecycle semantic contract (P1-T2 / PD-016).
