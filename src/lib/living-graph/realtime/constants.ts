// ============================================================================
// ProjectOps360° — Living Graph Realtime Engine · Constants (Phase 4, Task 1)
// ============================================================================
// The CLOSED vocabularies of the Living Graph Realtime Engine (LGRE): version
// identity, change sources, subscription topics, recalculation targets, delta
// operations, sync instructions, connection/fallback states, freshness, access
// scopes, and error codes. Every union type is DERIVED from these frozen arrays
// so the taxonomy has exactly one source of truth (mirrors the MPF Engine
// constants pattern in src/lib/milestone-flow/constants.ts).
//
// Pure + deterministic. No DB, no AI, no UI. The LGRE is a READ-ONLY consumer
// of approved canonical/projection outputs — it never mutates canonical truth,
// never writes project_event_log, and never touches process_nodes or
// process_edges. See docs/product-brain/living-graph-realtime-engine-constitution.md.
// ============================================================================

/** Engine version — bump when a change alters derived output for the same input. */
export const LGRE_ENGINE_VERSION = "0.1.0-foundation" as const;

/** Configuration version — versions the policy set (coalescing, budgets) that shapes output. */
export const LGRE_CONFIG_VERSION = "2026.07-phase4-task1" as const;

// ── Change sources ────────────────────────────────────────────────────────────

/** Where a change notice can legitimately originate. Constitution §7. */
export const LGRE_CHANGE_SOURCES = [
  "project_event_graph", // append-only project_event_log INSERT notification
  "projection_recompute", // an upstream projection/engine finished recomputing
  "canonical_revalidation", // canonical owner data revalidated (e.g. server action)
  "manual_refresh", // an authorized user asked for an explicit refresh
] as const;

// ── Subscription topics ───────────────────────────────────────────────────────

/** What a consumer may subscribe to. Topics map to invalidation-tag families. */
export const LGRE_SUBSCRIPTION_TOPICS = [
  "project_events", // new Project Event Graph events for the scoped project
  "projection_invalidation", // invalidation tags emitted by the ingestion service
  "capacity_signals", // Resource Capacity / workforce layer changes
  "milestone_flow", // MPF Engine projection refreshes
] as const;

// ── Recalculation model ───────────────────────────────────────────────────────

/** What part of the graph view-model a plan asks to recompute (via existing engines). */
export const LGRE_RECALC_TARGETS = [
  "node_status", // node state via the Execution Status Engine rules
  "edge_evidence", // edge task census / tooltip evidence (REG-018 resolver)
  "overlay", // an analysis overlay (risk/rework/bottleneck/workforce/…)
  "summary_counts", // header/summary counts (same resolver as nodes — REG-008)
  "workforce_layer", // resource/labor capacity layer (REG-007)
  "milestone_flow_layer", // MPF Living Graph consumer model
  "full_graph", // rebuild the whole projection for the scope
] as const;

/** Why a recalculation plan was produced (auditable, closed set). */
export const LGRE_RECALC_REASONS = [
  "no_change", // nothing to do — an explicit, honest no-op
  "event_appended", // one or more PEG events arrived
  "invalidation_tag_matched", // an invalidation tag targeted this scope
  "upstream_projection_refreshed", // an engine published a newer projection
  "manual_refresh_requested",
  "selective_recalculation_not_implemented", // foundation fallback: full rebuild
  // ── Task 3 (Incremental Recalculation Service) ──
  "dependency_path_propagation", // schedule change propagated downstream
  "unattributable_change", // notice could not be attributed → safe full rebuild
  "partial_budget_exceeded", // affected area too large → full rebuild is safer
  "snapshot_index_unavailable", // no index to attribute against → full rebuild
] as const;

// ── Delta / sync model ────────────────────────────────────────────────────────

/**
 * The ONLY operations a delta may carry. Deltas describe graph DATA changes —
 * never layout, never node positions (saved layouts are presentation-only and
 * client-owned, UX-007 / PD-008).
 */
export const LGRE_DELTA_OPERATIONS = [
  "upsert_node",
  "remove_node",
  "upsert_edge",
  "remove_edge",
  "patch_overlay",
  "patch_summary",
] as const;

/** What a consumer must do with a delta, given its local base version. */
export const LGRE_SYNC_INSTRUCTIONS = [
  "noop", // consumer already has this snapshot version
  "apply_delta", // consumer base matches — apply operations in order
  "full_resync", // base mismatch / too stale — fetch a full snapshot
] as const;

// ── Connection / fallback / freshness ─────────────────────────────────────────

/** Realtime channel connection states a consumer can be in. */
export const LGRE_CONNECTION_STATES = [
  "connecting",
  "live",
  "degraded_polling",
  "offline_snapshot",
] as const;

/** Delivery modes, in strict degradation order. Constitution §14. */
export const LGRE_FALLBACK_MODES = [
  "realtime", // live subscription delivering change notices
  "polling", // interval polling of snapshot versions
  "manual_refresh", // user-triggered refresh only (last resort)
] as const;

/** Honest freshness states the UI must be able to disclose. Never fabricated. */
export const LGRE_FRESHNESS_STATES = [
  "live", // synced within the target freshness budget
  "coalescing", // notices received, delta pending inside the coalescing window
  "stale", // beyond the freshness budget without a sync
  "resync_required", // base version diverged — full resync needed
  "unknown", // no sync information available (safe default)
] as const;

/** The safe default: without sync information, freshness is Unknown. */
export const LGRE_DEFAULT_FRESHNESS = "unknown" as const;

// ── Recalculation results (Task 3) ────────────────────────────────────────────

/** How a recalculation result was produced. */
export const LGRE_RECALC_MODES = [
  "partial", // only the attributed affected subgraph was recomputed
  "full", // safe fallback: the whole scope was recomputed
  "noop", // nothing changed — explicit, honest no-op
] as const;

/** How an entity changed between the previous and recomputed graph. */
export const LGRE_ENTITY_CHANGE_KINDS = ["added", "updated", "removed"] as const;

/** Provenance-derived confidence of a recalculation result (weakest wins). */
export const LGRE_CONFIDENCE_LEVELS = ["high", "medium", "low", "unknown"] as const;

/** The safe default: without provenance information, confidence is Unknown. */
export const LGRE_DEFAULT_CONFIDENCE = "unknown" as const;

// ── Access scope ──────────────────────────────────────────────────────────────

/**
 * The visibility level a caller is exercising against the realtime engine.
 * Viewers/clients have NO realtime graph access by default (doc 12 §8).
 */
export const LGRE_ACCESS_SCOPES = ["team", "pm", "pmo", "admin"] as const;

// ── Performance budget (documented defaults; overridable via config) ──────────

export const LGRE_DEFAULT_PERFORMANCE_BUDGET = {
  /** Coalesce change notices inside this window before planning (ms). */
  coalescingWindowMs: 750,
  /** Above this many operations a delta must become a full_resync instruction. */
  maxDeltaOperations: 200,
  /** Target: a change is visible to a live consumer within this budget (ms). */
  targetFreshnessMs: 5_000,
  /** Polling cadence when degraded to polling mode (ms). */
  degradedPollingIntervalMs: 30_000,
  /** Pending-notice backpressure limit before forcing a full rebuild plan. */
  maxPendingNotices: 500,
  /** Consecutive channel failures before degrading realtime → polling. */
  maxRealtimeFailuresBeforePolling: 1,
  /** Consecutive failures before degrading polling → manual_refresh. */
  maxFailuresBeforeManualRefresh: 4,
  /**
   * Partial recalculation budget: when the attributed area exceeds this share
   * of the graph, a full rebuild is cheaper and safer than a partial one.
   */
  partialRebuildNodeRatio: 0.6,
} as const;

// ── Error codes ───────────────────────────────────────────────────────────────

/** Typed, testable engine failure codes. See errors.ts. */
export const LGRE_ERROR_CODES = [
  "MISSING_PROJECT_SCOPE",
  "MISSING_ORGANIZATION_SCOPE",
  "UNAUTHORIZED_REALTIME_ACCESS",
  "INVALID_SUBSCRIPTION_TOPIC",
  "INVALID_CHANGE_NOTICE",
  "STALE_BASE_VERSION",
  "DELTA_LIMIT_EXCEEDED",
  "SUBSCRIPTION_CHANNEL_FAILURE",
  "UNSUPPORTED_ENGINE_OPERATION",
  "UNKNOWN_ENGINE_FAILURE",
] as const;

// ── Frozen membership sets (runtime guards) ───────────────────────────────────

export const CHANGE_SOURCE_SET: ReadonlySet<string> = new Set(LGRE_CHANGE_SOURCES);
export const SUBSCRIPTION_TOPIC_SET: ReadonlySet<string> = new Set(LGRE_SUBSCRIPTION_TOPICS);
export const RECALC_TARGET_SET: ReadonlySet<string> = new Set(LGRE_RECALC_TARGETS);
export const DELTA_OPERATION_SET: ReadonlySet<string> = new Set(LGRE_DELTA_OPERATIONS);
export const SYNC_INSTRUCTION_SET: ReadonlySet<string> = new Set(LGRE_SYNC_INSTRUCTIONS);
export const CONNECTION_STATE_SET: ReadonlySet<string> = new Set(LGRE_CONNECTION_STATES);
export const FALLBACK_MODE_SET: ReadonlySet<string> = new Set(LGRE_FALLBACK_MODES);
export const FRESHNESS_STATE_SET: ReadonlySet<string> = new Set(LGRE_FRESHNESS_STATES);
export const LGRE_ACCESS_SCOPE_SET: ReadonlySet<string> = new Set(LGRE_ACCESS_SCOPES);
