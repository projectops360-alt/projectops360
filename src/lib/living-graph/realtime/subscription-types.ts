// ============================================================================
// ProjectOps360° — LGRE · Event Subscription Layer Types (Phase 4, Task 2)
// ============================================================================
// Additive-only extension of the Task 1 type model: the transport abstraction
// (so the manager is transport-agnostic and fully testable without a network),
// the read-only project_event_log row projection, listener/stream types, and
// the subscription observability event vocabulary.
//
// The subscription layer is a LISTENER: it converts approved upstream change
// feeds into read-only LivingGraphChangeNotice values. It never writes
// anywhere, never re-derives Project Event Graph logic, and never touches
// process_nodes/process_edges. Constitution §8.
// ============================================================================

import type {
  LivingGraphChangeNotice,
  LivingGraphSubscriptionHandle,
  LivingGraphRealtimeAccessDecision,
  LivingGraphRealtimeFallbackMode,
  LivingGraphSubscriptionRequest,
} from "./types";

// ── Transport abstraction ─────────────────────────────────────────────────────

/**
 * Normalized transport channel statuses (a Supabase Realtime adapter maps
 * SUBSCRIBED/TIMED_OUT/CHANNEL_ERROR/CLOSED onto these).
 */
export const LGRE_TRANSPORT_STATUSES = [
  "connected",
  "reconnecting",
  "channel_error",
  "closed",
] as const;

export type LivingGraphTransportStatus = (typeof LGRE_TRANSPORT_STATUSES)[number];

/**
 * Read-only projection of an APPENDED project_event_log row as a transport
 * delivers it. All fields are optional-by-shape because the transport payload
 * is untrusted until the notice mapper validates it.
 */
export interface ProjectEventLogRowLike {
  event_id?: unknown;
  organization_id?: unknown;
  project_id?: unknown;
  event_type?: unknown;
  event_category?: unknown;
  occurred_at?: unknown;
  sequence_number?: unknown;
  invalidation_tags?: unknown;
  event_lifecycle_class?: unknown;
  is_compensating_event?: unknown;
}

export interface LivingGraphTransportChannelParams {
  /** Stable channel key — one channel per (project, topics) subscription. */
  channelKey: string;
  organizationId: string;
  projectId: string;
  /** Called with each appended row (INSERT only — the ledger is append-only). */
  onEventRow: (row: ProjectEventLogRowLike) => void;
  onStatus: (status: LivingGraphTransportStatus) => void;
}

export interface LivingGraphTransportChannel {
  channelKey: string;
  close(): void;
}

/**
 * The transport a subscription manager listens through. Implementations MUST
 * be read-only listeners (the Supabase adapter subscribes to postgres_changes
 * INSERT on project_event_log, project-filtered, under RLS). Tests inject a
 * fake transport.
 */
export interface LivingGraphRealtimeTransport {
  openChannel(params: LivingGraphTransportChannelParams): LivingGraphTransportChannel;
}

// ── Notice stream (the typed output future layers consume) ───────────────────

/** A delivered notice with the subscription context it arrived through. */
export interface LivingGraphNoticeDelivery {
  subscriptionId: string;
  consumerId: string;
  notice: LivingGraphChangeNotice;
}

export type LivingGraphNoticeListener = (delivery: LivingGraphNoticeDelivery) => void;

// ── Observability events ──────────────────────────────────────────────────────

/** Closed vocabulary of subscription-layer observability events. */
export const LGRE_SUBSCRIPTION_OBSERVABILITY_KINDS = [
  "subscription_attached",
  "subscription_deduplicated",
  "subscription_released",
  "notice_delivered",
  "notice_rejected",
  "duplicate_notice_dropped",
  "transport_status_changed",
  "fallback_mode_changed",
  "reconnect_authorized",
  "permission_revoked_on_reconnect",
  "stale_subscription_detected",
] as const;

export type LivingGraphSubscriptionObservabilityKind =
  (typeof LGRE_SUBSCRIPTION_OBSERVABILITY_KINDS)[number];

export interface LivingGraphSubscriptionObservabilityEvent {
  kind: LivingGraphSubscriptionObservabilityKind;
  subscriptionId: string | null;
  organizationId: string | null;
  projectId: string | null;
  at: string; // ISO timestamp (injected clock)
  /** Small structured detail (reason, status, fallback mode, dedup key…). */
  detail: Readonly<Record<string, string | number | boolean | null>>;
}

export type LivingGraphSubscriptionObservabilityListener = (
  event: LivingGraphSubscriptionObservabilityEvent,
) => void;

// ── Manager surface (extends the Task 1 subscription contract) ───────────────

/** Result of a reconnect attempt (permission is re-checked before re-attach). */
export interface LivingGraphReconnectResult {
  subscriptionId: string;
  outcome: "reconnected" | "permission_revoked" | "not_found";
  decision: LivingGraphRealtimeAccessDecision | null;
}

export interface LivingGraphSubscriptionSnapshot {
  handle: LivingGraphSubscriptionHandle;
  fallbackMode: LivingGraphRealtimeFallbackMode;
  consecutiveFailures: number;
  lastActivityAt: string;
  noticesDelivered: number;
  noticesRejected: number;
  duplicatesDropped: number;
}

/**
 * Re-authorization hook used on every reconnect: callers pass a resolver that
 * reflects CURRENT permissions (fresh membership lookup). Returning a denied
 * decision detaches the subscription — permission loss never keeps a live feed.
 */
export type LivingGraphReauthorizeFn = (
  request: LivingGraphSubscriptionRequest,
) => LivingGraphRealtimeAccessDecision;

export const LGRE_SUBSCRIPTION_DEFAULTS = {
  /** No activity (notice or status) for this long ⇒ stale (degraded_polling). */
  staleAfterMs: 60_000,
  /** Bounded dedup memory per subscription (FIFO eviction). */
  maxSeenNoticeKeys: 1_000,
} as const;
