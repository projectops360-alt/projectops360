# Project Knowledge Objects

## Purpose

Project Knowledge Objects are governed, project-scoped knowledge captured from operational evidence. They are distinct from the Knowledge OS: the Knowledge OS curates product guidance, while this layer persists knowledge learned inside a specific organization and project.

## Canonical types

The layer supports exactly seven types: Finding, Pattern, Best Practice, Lesson Learned, Recommendation, Prediction, and Root Cause.

## Lifecycle

Every object begins as `proposed`. Only an organization owner or admin may move the current version from `proposed` to `validated`, then from `validated` to `active`. Direct activation is forbidden. Validation and activation require supporting evidence with known confidence and append an actor, timestamp, rationale, version, and status transition to history.

A correction never overwrites a historical version. Revision appends a new immutable version, resets the current version to `proposed`, and preserves any previously active version until the revision is separately validated and activated.

## Evidence and provenance

Every version requires confidence, a confidence rationale, structured provenance, and at least one evidence reference. Evidence may point to a canonical project event, project object, document, metric, engine finding, or external reference. Canonical event references are verified against the same organization and project before persistence.

Milestone Process Flow findings can be promoted only through `mapMpfFindingToKnowledgeProposal`. The mapping is deterministic and idempotent and always produces a `finding` proposal. Derived engine output never becomes validated or active automatically.

## Access and service boundary

RLS is deny-by-default. Organization members may read objects in their organization; authenticated clients cannot insert, update, or delete lifecycle storage directly. Mutations run through service-role-only RPCs after actor membership and role validation. Application consumers use `KnowledgeLayerService` or the server entrypoints rather than querying storage directly.

## P3-T3 boundary

This capability does not define graph node types, relationship types, graph projection rules, graph validation, or Living Graph navigation. Those remain in P3-T3. This migration never writes `process_nodes`, `process_edges`, or `knowledge_packages`.
