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
// NOTE: the DB transport adapter (supabase-transport.ts) is deliberately NOT
// re-exported: callers wire it explicitly with an authenticated client, so the
// pure core keeps zero transitive client-library dependencies (LGRE-FOUNDATION
// import-boundary guard).
