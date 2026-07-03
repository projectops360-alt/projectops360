// ============================================================================
// ProjectOps360° — LGRE Phase 4 / Task 6
// PERFORMANCE OBSERVABILITY — realtime pipeline counters (pure, privacy-safe)
// ============================================================================
// An in-memory, numeric-only counter aggregator for the realtime pipeline. It
// records COUNTS and DURATIONS only — never task titles, team members, event
// bodies, or any tenant identifier — so a snapshot can be logged or surfaced
// without leaking unauthorized data. Pure data structure + reducer functions;
// the caller owns the instance lifecycle (per consumer mount).
// ============================================================================

/** Every observable counter in the realtime pipeline. All values are numbers. */
export interface RealtimePerfCounters {
  // Subscription / channel.
  subscriptionCount: number;
  activeChannelCount: number;
  reconnectCount: number;
  duplicateSubscriptionPrevented: number;
  permissionLossCount: number;

  // Notices / recalculation.
  noticeCount: number;
  dedupedNoticeCount: number;
  rejectedNoticeCount: number;
  recalcRequestCount: number;
  recalcFallbackCount: number;

  // Delta / sync.
  deltaCount: number;
  fullResyncCount: number;
  maxDeltaSizeFallbackCount: number;
  staleCount: number;
  freshRecoveryCount: number;

  // Priority policy.
  criticalPreservedCount: number;
  skippedNonCriticalCount: number;

  // Rendering.
  renderUpdateCount: number;
  renderBatchTotal: number; // running sum of batch sizes (avg = /renderUpdateCount)
  largeGraphWarningCount: number;

  // Errors.
  errorCount: number;
  recoverableErrorCount: number;
  warningCount: number;

  // Durations (ms) — last + running totals for averaging.
  lastRecalcDurationMs: number | null;
  recalcDurationTotalMs: number;
  recalcDurationSamples: number;
  lastRenderLatencyMs: number | null;
  renderLatencyTotalMs: number;
  renderLatencySamples: number;
}

export function createRealtimePerfCounters(): RealtimePerfCounters {
  return {
    subscriptionCount: 0,
    activeChannelCount: 0,
    reconnectCount: 0,
    duplicateSubscriptionPrevented: 0,
    permissionLossCount: 0,
    noticeCount: 0,
    dedupedNoticeCount: 0,
    rejectedNoticeCount: 0,
    recalcRequestCount: 0,
    recalcFallbackCount: 0,
    deltaCount: 0,
    fullResyncCount: 0,
    maxDeltaSizeFallbackCount: 0,
    staleCount: 0,
    freshRecoveryCount: 0,
    criticalPreservedCount: 0,
    skippedNonCriticalCount: 0,
    renderUpdateCount: 0,
    renderBatchTotal: 0,
    largeGraphWarningCount: 0,
    errorCount: 0,
    recoverableErrorCount: 0,
    warningCount: 0,
    lastRecalcDurationMs: null,
    recalcDurationTotalMs: 0,
    recalcDurationSamples: 0,
    lastRenderLatencyMs: null,
    renderLatencyTotalMs: 0,
    renderLatencySamples: 0,
  };
}

/** A live observability recorder wrapping mutable counters. */
export interface RealtimePerfObservability {
  counters: RealtimePerfCounters;
  incr(key: RealtimeCounterKey, by?: number): void;
  recordRecalcDuration(ms: number): void;
  recordRenderLatency(ms: number, batchSize: number): void;
  /** Fold a flush result's coalescing outcome into the counters. */
  recordFlush(input: {
    batchSize: number;
    hadCritical: boolean;
    coalescedNonCritical: number;
  }): void;
  snapshot(): RealtimePerfSnapshot;
  reset(): void;
}

/** Keys that can be plainly incremented via `incr`. */
export type RealtimeCounterKey = Exclude<
  {
    [K in keyof RealtimePerfCounters]: RealtimePerfCounters[K] extends number ? K : never;
  }[keyof RealtimePerfCounters],
  | "lastRecalcDurationMs"
  | "lastRenderLatencyMs"
  | "recalcDurationTotalMs"
  | "recalcDurationSamples"
  | "renderLatencyTotalMs"
  | "renderLatencySamples"
  | "renderBatchTotal"
>;

/** Privacy-safe, aggregated snapshot with derived averages. */
export interface RealtimePerfSnapshot extends RealtimePerfCounters {
  avgRecalcDurationMs: number | null;
  avgRenderLatencyMs: number | null;
  avgRenderBatchSize: number | null;
}

export function createRealtimePerfObservability(
  counters: RealtimePerfCounters = createRealtimePerfCounters(),
): RealtimePerfObservability {
  const clamp = (n: number) => (Number.isFinite(n) && n >= 0 ? n : 0);

  return {
    counters,
    incr(key, by = 1) {
      counters[key] = clamp((counters[key] as number) + by);
    },
    recordRecalcDuration(ms) {
      const v = clamp(ms);
      counters.lastRecalcDurationMs = v;
      counters.recalcDurationTotalMs += v;
      counters.recalcDurationSamples += 1;
    },
    recordRenderLatency(ms, batchSize) {
      const v = clamp(ms);
      counters.lastRenderLatencyMs = v;
      counters.renderLatencyTotalMs += v;
      counters.renderLatencySamples += 1;
      counters.renderUpdateCount += 1;
      counters.renderBatchTotal += clamp(batchSize);
    },
    recordFlush({ batchSize, hadCritical, coalescedNonCritical }) {
      counters.deltaCount += 1;
      if (hadCritical) counters.criticalPreservedCount += clamp(batchSize);
      counters.skippedNonCriticalCount += clamp(coalescedNonCritical);
    },
    snapshot() {
      return {
        ...counters,
        avgRecalcDurationMs:
          counters.recalcDurationSamples > 0
            ? counters.recalcDurationTotalMs / counters.recalcDurationSamples
            : null,
        avgRenderLatencyMs:
          counters.renderLatencySamples > 0
            ? counters.renderLatencyTotalMs / counters.renderLatencySamples
            : null,
        avgRenderBatchSize:
          counters.renderUpdateCount > 0
            ? counters.renderBatchTotal / counters.renderUpdateCount
            : null,
      };
    },
    reset() {
      Object.assign(counters, createRealtimePerfCounters());
    },
  };
}
