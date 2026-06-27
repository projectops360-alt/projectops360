# 08 — Roadmap

Sequenced by leverage and risk. This is a product roadmap, not a sprint plan. Each item maps
to capabilities (CAP-xxx) and, where architectural, ADRs.

## Now (next, highest leverage)

1. **Stabilize the Product Brain (this phase).** Adopt registries + ADRs + AI rules as the
   working process. *(meta / ADR-007)*
2. **Investigate RBAC & Team regressions (REG-001..003) and the `master` vs `feat/rythm`
   security divergence (CAP-028).** Decide ADR-008. *Security-critical, blocks trust.*
3. **Execution Status Engine — wire it (CAP-016, ADR-006).** Move from Prototype to
   Implemented: tests → Living Graph node semantics (fix REG-006) → Isabella explanation.

## Next

4. **Resource Capacity Intelligence depth (CAP-009, ADR-003):** forecast, burnout,
   over/under-allocation insight, reconcile `lib/capacity` vs `lib/labor` (ADR-009). *(doc 13)*
5. **Living Graph as navigation/impact surface (CAP-005, ADR-002):** consume status engine +
   capacity; connect issues/decisions/comms; Isabella node explanations. *(doc 12)*
6. **Executive Command Center (CAP-015, doc 14):** consolidate health/status/capacity/risk
   into one executive surface.

## Later

7. **AI Workforce multi-expert (CAP-004)** and Isabella acting on live data.
8. **Communication & Financial Intelligence (CAP-026/027).**
9. **Issue Management as a first-class entity (CAP-018, ADR-011).**
10. **Workforce digital twin & simulation (CAP-009 advanced).**

## Cleanup / debt (parallel track)
- `rhythm` vs `rythm` consolidation (ADR-010).
- Test coverage for engines lacking `__tests__` (critical-path, status engine, capacity service).

> Re-order only with rationale recorded here. Priorities are derived from the registries and
> the regression log, not from any single conversation.
