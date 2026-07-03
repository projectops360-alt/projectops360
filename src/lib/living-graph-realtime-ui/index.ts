// ============================================================================
// ProjectOps360° — Realtime Living Graph UI · Barrel (pure consumer library)
// ============================================================================
// The presentation-safe consumer of the Task 4 hierarchy-safe delta/sync
// contract. No DB, no raw events, no realtime subscription, no graph-truth
// recalculation — display adapters/selectors/reducers only.
// ============================================================================

export * from "./view-model";
export * from "./snapshot-adapter";
export * from "./expansion-reducer";
export * from "./visibility-selector";
export * from "./sync-state";
export * from "./layout";
// NOTE: load-snapshot.ts is server-only (Supabase) — imported directly by the
// server page, deliberately NOT re-exported here so the client barrel stays
// free of DB/server dependencies.
