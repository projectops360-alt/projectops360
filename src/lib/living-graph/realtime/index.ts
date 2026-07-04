// ============================================================================
// ProjectOps360° — Living Graph Realtime Engine (Phase 4) · Barrel
// ============================================================================

export * from "./constants";
export * from "./types";
export * from "./errors";
export * from "./security";
export * from "./observability";
export * from "./contracts";
export * from "./engine";
export * from "./subscription-types";
export * from "./notice-mapper";
export * from "./subscription-manager";
export * from "./recalculation-types";
export * from "./recalculation-attribution";
export * from "./recalculation-result";
export * from "./recalculation-service";
export * from "./delta-types";
export * from "./delta-builder";
export * from "./delta-store";
// Phase 4 / Task 6 — realtime performance, throttling & observability safeguards.
export * from "./performance-budget";
export * from "./critical-update";
export * from "./update-scheduler";
export * from "./reconnect-backoff";
export * from "./large-graph";
export * from "./perf-observability";
export * from "./observability-summary";
// NOTE: the DB transport adapter (supabase-transport.ts) is deliberately NOT
// re-exported: callers wire it explicitly with an authenticated client, so the
// pure core keeps zero transitive client-library dependencies (LGRE-FOUNDATION
// import-boundary guard).
