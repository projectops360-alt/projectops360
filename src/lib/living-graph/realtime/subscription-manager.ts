// ============================================================================
// ProjectOps360° — LGRE · Event Subscription Manager (Phase 4, Task 2)
// ============================================================================
// Implements the Task 1 LivingGraphRealtimeSubscriptionContract: the ONLY
// component that listens to upstream change feeds (through an injected
// read-only transport) and converts them into typed, read-only
// LivingGraphChangeNotice values for the future recalculation and delta layers.
//
// Guarantees (guarded by LGRE-SUBSCRIPTION):
// - authorization BEFORE attachment; re-authorization on every reconnect —
//   permission loss detaches the feed (never a lingering live channel);
// - one channel per (consumer, scope, topics) — duplicates return the existing
//   handle, never a second channel;
// - at-least-once upstream → deduped downstream (bounded seen-key memory that
//   SURVIVES reconnects, so replayed rows never double-deliver);
// - wrong-scope/malformed rows are rejected and counted, never interpreted;
// - stale subscriptions are detected and degraded honestly (never fake "live");
// - every lifecycle step emits a structured observability event;
// - the manager never writes anywhere: no DB client, no event emission, no
//   canonical mutation — it is a listener between the transport and consumers.
// ============================================================================

import {
  decideLivingGraphFallback,
  validateSubscriptionRequest,
  isAcceptableChangeNotice,
} from "./engine";
import { resolveLivingGraphRealtimeAccess } from "./security";
import { LgreUnauthorizedAccessError } from "./errors";
import { mapProjectEventRowToNotice, noticeDedupKey } from "./notice-mapper";
import type { LivingGraphRealtimeSubscriptionContract } from "./contracts";
import { SUBSCRIPTION_TOPIC_SET } from "./constants";
import type {
  LivingGraphRealtimeTopic,
  LivingGraphSubscriptionRequest,
  LivingGraphSubscriptionHandle,
  LivingGraphRealtimeConnectionState,
  LivingGraphRealtimeFallbackMode,
} from "./types";
import {
  LGRE_SUBSCRIPTION_DEFAULTS,
  type LivingGraphRealtimeTransport,
  type LivingGraphTransportChannel,
  type LivingGraphTransportStatus,
  type ProjectEventLogRowLike,
  type LivingGraphNoticeListener,
  type LivingGraphSubscriptionObservabilityListener,
  type LivingGraphSubscriptionObservabilityKind,
  type LivingGraphReauthorizeFn,
  type LivingGraphReconnectResult,
  type LivingGraphSubscriptionSnapshot,
} from "./subscription-types";

// ── Internal record ───────────────────────────────────────────────────────────

interface SubscriptionRecord {
  handle: LivingGraphSubscriptionHandle;
  request: LivingGraphSubscriptionRequest;
  dedupKey: string;
  channel: LivingGraphTransportChannel | null;
  state: LivingGraphRealtimeConnectionState;
  fallbackMode: LivingGraphRealtimeFallbackMode;
  consecutiveFailures: number;
  lastActivityAt: number; // epoch ms (injected clock)
  seenNoticeKeys: Set<string>;
  seenNoticeOrder: string[]; // FIFO eviction
  noticesDelivered: number;
  noticesRejected: number;
  duplicatesDropped: number;
}

function subscriptionDedupKey(request: LivingGraphSubscriptionRequest): string {
  const topics = [...request.topics].sort().join(",");
  return `${request.consumerId}|${request.scope.organizationId}|${request.scope.projectId}|${topics}`;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export interface CreateLivingGraphSubscriptionManagerOptions {
  transport: LivingGraphRealtimeTransport;
  now?: () => Date;
  subscriptionIdSeed?: string;
  /** Fresh-permission resolver used on reconnect. Defaults to the static context. */
  reauthorize?: LivingGraphReauthorizeFn;
  staleAfterMs?: number;
  maxSeenNoticeKeys?: number;
}

export interface LivingGraphSubscriptionManager extends LivingGraphRealtimeSubscriptionContract {
  /** Typed notice stream for the future recalculation/delta layers. */
  onNotice(listener: LivingGraphNoticeListener): () => void;
  /** Structured observability event stream. */
  onObservability(listener: LivingGraphSubscriptionObservabilityListener): () => void;
  /** Re-authorize + re-attach one subscription (permission loss detaches it). */
  reconnect(subscriptionId: string): LivingGraphReconnectResult;
  /** Degrade subscriptions with no activity beyond the stale threshold. */
  sweepStale(): string[];
  getSubscription(subscriptionId: string): LivingGraphSubscriptionSnapshot | null;
  listSubscriptions(): LivingGraphSubscriptionSnapshot[];
}

export function createLivingGraphSubscriptionManager(
  options: CreateLivingGraphSubscriptionManagerOptions,
): LivingGraphSubscriptionManager {
  const now = options.now ?? (() => new Date());
  const reauthorize: LivingGraphReauthorizeFn =
    options.reauthorize ?? ((request) => resolveLivingGraphRealtimeAccess(request.access, request.scope));
  const staleAfterMs = options.staleAfterMs ?? LGRE_SUBSCRIPTION_DEFAULTS.staleAfterMs;
  const maxSeenNoticeKeys = options.maxSeenNoticeKeys ?? LGRE_SUBSCRIPTION_DEFAULTS.maxSeenNoticeKeys;

  const records = new Map<string, SubscriptionRecord>(); // by subscriptionId
  const byDedupKey = new Map<string, string>(); // dedupKey → subscriptionId
  const noticeListeners = new Set<LivingGraphNoticeListener>();
  const observabilityListeners = new Set<LivingGraphSubscriptionObservabilityListener>();
  let subscriptionCounter = 0;

  function newSubscriptionId(): string {
    subscriptionCounter += 1;
    return options.subscriptionIdSeed
      ? `lgre-sub-${options.subscriptionIdSeed}-${subscriptionCounter}`
      : `lgre-sub-${subscriptionCounter}`;
  }

  function emit(
    kind: LivingGraphSubscriptionObservabilityKind,
    record: SubscriptionRecord | null,
    detail: Record<string, string | number | boolean | null> = {},
  ): void {
    const event = Object.freeze({
      kind,
      subscriptionId: record?.handle.subscriptionId ?? null,
      organizationId: record?.request.scope.organizationId ?? null,
      projectId: record?.request.scope.projectId ?? null,
      at: now().toISOString(),
      detail: Object.freeze({ ...detail }),
    });
    for (const listener of observabilityListeners) listener(event);
  }

  function rememberNoticeKey(record: SubscriptionRecord, key: string): void {
    record.seenNoticeKeys.add(key);
    record.seenNoticeOrder.push(key);
    while (record.seenNoticeOrder.length > maxSeenNoticeKeys) {
      const evicted = record.seenNoticeOrder.shift();
      if (evicted) record.seenNoticeKeys.delete(evicted);
    }
  }

  function handleEventRow(record: SubscriptionRecord, row: ProjectEventLogRowLike): void {
    // A channel that outlived its subscription (late close callback) is stale:
    // never deliver through a released record.
    if (!records.has(record.handle.subscriptionId)) return;
    record.lastActivityAt = now().getTime();
    const notice = mapProjectEventRowToNotice(row);
    if (!notice) {
      record.noticesRejected += 1;
      emit("notice_rejected", record, { reason: "malformed_row" });
      return;
    }
    if (!isAcceptableChangeNotice(notice, record.request.scope)) {
      record.noticesRejected += 1;
      emit("notice_rejected", record, { reason: "wrong_scope", eventId: notice.eventId });
      return;
    }
    const key = noticeDedupKey(notice);
    if (record.seenNoticeKeys.has(key)) {
      record.duplicatesDropped += 1;
      emit("duplicate_notice_dropped", record, { dedupKey: key });
      return;
    }
    rememberNoticeKey(record, key);
    record.noticesDelivered += 1;
    const delivery = Object.freeze({
      subscriptionId: record.handle.subscriptionId,
      consumerId: record.request.consumerId,
      notice,
    });
    emit("notice_delivered", record, { eventId: notice.eventId, sequence: notice.sequence });
    for (const listener of noticeListeners) listener(delivery);
  }

  function handleTransportStatus(record: SubscriptionRecord, status: LivingGraphTransportStatus): void {
    if (!records.has(record.handle.subscriptionId)) return;
    record.lastActivityAt = now().getTime();
    const previousState = record.state;
    if (status === "connected") {
      record.consecutiveFailures = 0;
      record.state = "live";
    } else if (status === "reconnecting") {
      record.state = "connecting";
    } else {
      // channel_error / closed while we still hold the record ⇒ a failure.
      record.consecutiveFailures += 1;
      record.state = "degraded_polling";
    }
    record.handle = { ...record.handle, state: record.state };
    emit("transport_status_changed", record, { status, previousState, state: record.state });

    const nextFallback = decideLivingGraphFallback(record.state, record.consecutiveFailures);
    if (nextFallback !== record.fallbackMode) {
      record.fallbackMode = nextFallback;
      emit("fallback_mode_changed", record, {
        fallbackMode: nextFallback,
        consecutiveFailures: record.consecutiveFailures,
      });
    }
  }

  function openChannel(record: SubscriptionRecord): void {
    record.channel = options.transport.openChannel({
      channelKey: `lgre:${record.request.scope.projectId}:${record.handle.subscriptionId}`,
      organizationId: record.request.scope.organizationId,
      projectId: record.request.scope.projectId,
      onEventRow: (row) => handleEventRow(record, row),
      onStatus: (status) => handleTransportStatus(record, status),
    });
  }

  function detach(record: SubscriptionRecord): void {
    record.channel?.close();
    record.channel = null;
    records.delete(record.handle.subscriptionId);
    byDedupKey.delete(record.dedupKey);
  }

  function toSnapshot(record: SubscriptionRecord): LivingGraphSubscriptionSnapshot {
    return {
      handle: { ...record.handle },
      fallbackMode: record.fallbackMode,
      consecutiveFailures: record.consecutiveFailures,
      lastActivityAt: new Date(record.lastActivityAt).toISOString(),
      noticesDelivered: record.noticesDelivered,
      noticesRejected: record.noticesRejected,
      duplicatesDropped: record.duplicatesDropped,
    };
  }

  return {
    validateTopics(topics: readonly LivingGraphRealtimeTopic[]): boolean {
      return topics.length > 0 && topics.every((t) => SUBSCRIPTION_TOPIC_SET.has(t));
    },

    subscribe(request: LivingGraphSubscriptionRequest): LivingGraphSubscriptionHandle {
      validateSubscriptionRequest(request);
      const decision = resolveLivingGraphRealtimeAccess(request.access, request.scope);
      if (!decision.allowed) throw new LgreUnauthorizedAccessError(decision.reason);

      const dedupKey = subscriptionDedupKey(request);
      const existingId = byDedupKey.get(dedupKey);
      if (existingId) {
        const existing = records.get(existingId);
        if (existing) {
          emit("subscription_deduplicated", existing, { dedupKey });
          return { ...existing.handle };
        }
        byDedupKey.delete(dedupKey);
      }

      const record: SubscriptionRecord = {
        handle: {
          subscriptionId: newSubscriptionId(),
          consumerId: request.consumerId,
          scope: request.scope,
          topics: [...request.topics],
          state: "connecting",
          createdAt: now().toISOString(),
        },
        request,
        dedupKey,
        channel: null,
        state: "connecting",
        fallbackMode: "realtime",
        consecutiveFailures: 0,
        lastActivityAt: now().getTime(),
        seenNoticeKeys: new Set(),
        seenNoticeOrder: [],
        noticesDelivered: 0,
        noticesRejected: 0,
        duplicatesDropped: 0,
      };
      records.set(record.handle.subscriptionId, record);
      byDedupKey.set(dedupKey, record.handle.subscriptionId);
      openChannel(record);
      emit("subscription_attached", record, { topics: record.handle.topics.join(",") });
      return { ...record.handle };
    },

    unsubscribe(subscriptionId: string): void {
      const record = records.get(subscriptionId);
      if (!record) return; // idempotent release
      detach(record);
      emit("subscription_released", record, {});
    },

    reconnect(subscriptionId: string): LivingGraphReconnectResult {
      const record = records.get(subscriptionId);
      if (!record) return { subscriptionId, outcome: "not_found", decision: null };

      // Permission loss handling: re-check CURRENT permissions before re-attach.
      const decision = reauthorize(record.request);
      if (!decision.allowed) {
        emit("permission_revoked_on_reconnect", record, { reason: decision.reason });
        detach(record);
        return { subscriptionId, outcome: "permission_revoked", decision };
      }

      record.channel?.close();
      record.channel = null;
      record.state = "connecting";
      record.handle = { ...record.handle, state: "connecting" };
      // seenNoticeKeys survive on purpose: replayed rows after reconnect
      // (at-least-once) must not double-deliver.
      openChannel(record);
      emit("reconnect_authorized", record, { consecutiveFailures: record.consecutiveFailures });
      return { subscriptionId, outcome: "reconnected", decision };
    },

    sweepStale(): string[] {
      const cutoff = now().getTime() - staleAfterMs;
      const stale: string[] = [];
      for (const record of records.values()) {
        if (record.state === "live" && record.lastActivityAt < cutoff) {
          record.state = "degraded_polling";
          record.handle = { ...record.handle, state: "degraded_polling" };
          record.fallbackMode = "polling";
          stale.push(record.handle.subscriptionId);
          emit("stale_subscription_detected", record, {
            lastActivityAt: new Date(record.lastActivityAt).toISOString(),
          });
        }
      }
      return stale;
    },

    onNotice(listener: LivingGraphNoticeListener): () => void {
      noticeListeners.add(listener);
      return () => noticeListeners.delete(listener);
    },

    onObservability(listener: LivingGraphSubscriptionObservabilityListener): () => void {
      observabilityListeners.add(listener);
      return () => observabilityListeners.delete(listener);
    },

    getSubscription(subscriptionId: string): LivingGraphSubscriptionSnapshot | null {
      const record = records.get(subscriptionId);
      return record ? toSnapshot(record) : null;
    },

    listSubscriptions(): LivingGraphSubscriptionSnapshot[] {
      return [...records.values()].map(toSnapshot);
    },
  };
}
