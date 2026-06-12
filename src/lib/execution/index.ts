// ============================================================================
// ProjectOps360° — Universal Execution Domain
// ============================================================================
// One execution intelligence model for every project type.
//
// Pure domain logic (testable, no I/O):
//   constants.ts      — project types + universal status mapping
//   modules.ts        — module visibility per project type
//   critical-path.ts  — CPM engine (forward/backward pass, float, constraints)
//   readiness.ts      — universal task readiness score + blockers
//   health.ts         — Project Health Engine
//   templates.ts      — typed project template catalog
//
// Persistence services (server-side):
//   critical-path-service.ts — recalculate + write back + snapshot
//   template-service.ts      — instantiate a template into real rows
//   material-extraction.ts   — drawing extractions → material candidates
// ============================================================================

export * from "./constants";
export * from "./modules";
export * from "./critical-path";
export * from "./readiness";
export * from "./health";
export * from "./templates";
