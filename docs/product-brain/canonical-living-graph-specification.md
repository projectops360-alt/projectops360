# Canonical Living Graph Specification

**Specification:** `projectops360-canonical-graph`  
**Version:** `1.0.0`

## Six layers

1. **Object** — project records and external references.
2. **Relationship** — typed, validated connections between canonical nodes.
3. **Event** — immutable canonical events and their recorded chronology.
4. **Knowledge** — read-only projections of governed Project Knowledge Objects.
5. **Intelligence** — derived findings, metrics and intelligence signals.
6. **Prediction** — explicitly predictive signals and scenarios.

## Semantic classes

- `temporal`: recorded or deterministically projected order only. Temporal proximity never implies causality.
- `causal`: explicit recorded causality with evidence and provenance.
- `compensation`: explicit correction or compensation links.
- `association`: object references, supporting evidence, contradictory evidence and context.
- `derived_intelligence`: derived findings and analytical relationships with evidence and provenance.

The executable source of truth is `src/lib/graph/canonical-graph-spec.ts`, which enumerates node families, relationship families, allowed source-target pairs and evidence/provenance requirements.

## Knowledge projection

The Knowledge view reads `project_knowledge_object_current` and the evidence records for each current version under authenticated RLS. It preserves the Knowledge Object type, lifecycle status, current/active version, confidence, provenance and evidence references. The graph cannot create, revise, validate or activate knowledge.

Knowledge and evidence nodes use deterministic identifiers. Supporting, contradictory, contextual and derived relationships are projected without persistence in `process_nodes` or `process_edges`. Source evidence can navigate to the canonical event audit or the applicable project area.

The user-facing Knowledge view applies progressive disclosure over that complete canonical projection.
It initially renders only Knowledge Objects. Selecting one object reveals only its evidence, grouped
by evidence type and relationship role. Grouping is presentation-only: it does not change, delete, or
merge canonical evidence. Evidence associations never render as process transitions or causal claims.

## Validation

`validateCanonicalGraph` rejects cross-tenant or cross-project entities, duplicate or unstable identifiers, unknown families, dangling endpoints, invalid source-target pairs, incorrect relationship classes, missing evidence and missing required provenance. Invalid projections render an honest unavailable state and never fall back to operational nodes.

## Isolation from existing behavior

Milestones, Activities and Events retain their existing loaders, layouts, realtime behavior and process analyses. The Knowledge view is a separate read-only display graph. Knowledge nodes and edges never feed critical path, bottleneck, cycle, workforce or process-discovery analyses for operational views.
