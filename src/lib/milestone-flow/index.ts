// ============================================================================
// ProjectOps360° — Milestone Process Flow Engine (Phase 3)
// ============================================================================
// The MPF Engine derives how execution FLOWS between project milestones from the
// Project Event Graph. It is a READ-ONLY consumer of canonical truth: it never
// mutates project_event_log, process_nodes, or process_edges. Every derived
// conclusion is evidence-backed; the honest default is "unknown".
//
// Phase 3, Task 1 delivers the architecture + contract foundation only:
//   constants.ts      — frozen taxonomies + version identity
//   types.ts          — the full derived-intelligence type model
//   errors.ts         — typed, testable engine failures
//   security.ts       — deny-by-default access resolution (tenant isolation)
//   evidence.ts       — evidence refs + confidence aggregation helpers
//   observability.ts  — run context → immutable run summary
//   contracts.ts      — the 9 stable contracts future tasks implement
//   engine.ts         — a safe stub: valid EMPTY projection, never fake output
//
// Phase 3, Task 2 adds the event-semantics layer (interprets Project Event Graph
// events as milestone-flow signals; deterministic, provenance-aware, read-only):
//   event-semantics-types.ts — signal vocabularies + classification types
//   event-semantics-map.ts    — every canonical event → its flow meaning
//   event-semantics.ts        — pure classification / provenance / evidence fns
//
// See docs/product-brain/milestone-process-flow-engine-constitution.md,
// docs/product-brain/milestone-process-flow-engine-architecture.md, and
// docs/product-brain/milestone-process-flow-event-semantics.md.
// ============================================================================

export * from "./constants";
export * from "./types";
export * from "./errors";
export * from "./security";
export * from "./evidence";
export * from "./observability";
export * from "./contracts";
export * from "./engine";
export * from "./event-semantics-types";
export * from "./event-semantics-map";
export * from "./event-semantics";
