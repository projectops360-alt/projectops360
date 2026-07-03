// ============================================================================
// Phase 4 · Task 6 — Living Graph Realtime PERFORMANCE / THROTTLING /
// OBSERVABILITY safeguards (LGRE-PERFORMANCE-THROTTLING-OBSERVABILITY-SAFEGUARDS)
// ============================================================================
// Protects: throttle/debounce/batch coalescing, dedup-to-latest with final
// state preserved, priority-aware critical-update policy (critical bypasses
// throttle and is NEVER silently dropped; skipped non-critical is COUNTED),
// bounded reconnect backoff, large-graph warning + Expand-all guard, max-delta
// full_resync fallback, and privacy-safe observability counters. All primitives
// are pure and client-free (import boundary): no canonical mutation, no
// project_event_log write, no process_nodes/process_edges.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  // budget
  LGRE_PERFORMANCE_DEFAULTS,
  resolvePerfBudget,
  // critical policy
  isCriticalEventType,
  isCriticalNotice,
  LGRE_NON_CRITICAL_EVENT_TYPES,
  // scheduler
  createUpdateSchedulerState,
  enqueueUpdate,
  decideFlush,
  drainScheduler,
  forceFlush,
  // reconnect
  planReconnect,
  reconnectDelayMs,
  shouldStopReconnecting,
  // large graph + delta size
  assessGraphLoad,
  decideDeltaSize,
  // observability
  createRealtimePerfObservability,
} from "../index";
import type { LivingGraphChangeNotice } from "../types";

const budget = resolvePerfBudget();

function notice(over: Partial<LivingGraphChangeNotice>): LivingGraphChangeNotice {
  return {
    noticeId: "n1",
    source: "project_event_graph",
    organizationId: "org-1",
    projectId: "proj-1",
    eventId: "e1",
    eventType: "TaskUpdated",
    sequence: 1,
    occurredAt: "2026-07-03T00:00:00.000Z",
    invalidationTags: [],
    lifecycleClass: "fact",
    isCompensatingEvent: false,
    ...over,
  } as LivingGraphChangeNotice;
}

// ── Budget ────────────────────────────────────────────────────────────────────
describe("performance budget", () => {
  it("inherits the Task-1 delta operation budget (single source of truth)", () => {
    expect(LGRE_PERFORMANCE_DEFAULTS.maxDeltaOperations).toBe(200);
  });

  it("clamps unsafe overrides so a safeguard can never be disabled", () => {
    const b = resolvePerfBudget({
      maxBatchSize: 0,
      maxDeltaOperations: 0,
      reconnectBackoffMinMs: -5,
      reconnectMaxAttempts: 0,
    });
    expect(b.maxBatchSize).toBeGreaterThanOrEqual(1);
    expect(b.maxDeltaOperations).toBeGreaterThanOrEqual(1);
    expect(b.reconnectBackoffMinMs).toBeGreaterThanOrEqual(100);
    expect(b.reconnectMaxAttempts).toBeGreaterThanOrEqual(1);
    expect(b.reconnectBackoffMaxMs).toBeGreaterThanOrEqual(b.reconnectBackoffMinMs);
  });
});

// ── Critical policy ─────────────────────────────────────────────────────────
describe("critical-update policy", () => {
  it("treats task/subtask/milestone status changes as critical", () => {
    expect(isCriticalEventType("TaskStatusChanged")).toBe(true);
    expect(isCriticalEventType("TaskMoved")).toBe(true);
    expect(isCriticalEventType("SubtaskCompleted")).toBe(true);
    expect(isCriticalEventType("MilestoneAchieved")).toBe(true);
    expect(isCriticalEventType("TaskBlocked")).toBe(true);
    expect(isCriticalEventType("TaskDependencyAdded")).toBe(true);
  });

  it("allows only explicitly cosmetic event types to be throttled", () => {
    expect(isCriticalEventType("TaskUpdated")).toBe(false);
    expect(isCriticalEventType("TaskAssigned")).toBe(false);
    expect(LGRE_NON_CRITICAL_EVENT_TYPES.has("SubtaskUpdated")).toBe(true);
  });

  it("is fail-safe: unknown/empty event types are critical (never silently dropped)", () => {
    expect(isCriticalEventType(null)).toBe(true);
    expect(isCriticalEventType(undefined)).toBe(true);
    expect(isCriticalEventType("SomethingNewWeDoNotKnow")).toBe(true);
  });

  it("escalates a cosmetic event to critical when it carries a status/topology tag", () => {
    expect(isCriticalNotice(notice({ eventType: "TaskUpdated", invalidationTags: ["task:status:x"] }))).toBe(true);
    expect(isCriticalNotice(notice({ eventType: "TaskUpdated", isCompensatingEvent: true }))).toBe(true);
    expect(isCriticalNotice(notice({ eventType: "TaskUpdated", invalidationTags: ["task:label:x"] }))).toBe(false);
  });
});

// ── Scheduler: throttle / debounce / batch / dedup ──────────────────────────
describe("update scheduler", () => {
  it("debounces a burst of non-critical updates into one flush and preserves the final state", () => {
    let s = createUpdateSchedulerState();
    s = enqueueUpdate(s, { key: "a", critical: false }, 0);
    s = enqueueUpdate(s, { key: "b", critical: false }, 100);
    // Before the debounce window elapses, nothing is due.
    expect(decideFlush(s, 200, budget).due).toBe(false);
    // After the window, it flushes both keys once.
    const d = decideFlush(s, 0 + budget.debounceWindowMs, budget);
    expect(d.due).toBe(true);
    const flushed = drainScheduler(s, budget.debounceWindowMs, d.reason);
    expect([...flushed.keys].sort()).toEqual(["a", "b"]);
    expect(flushed.hadCritical).toBe(false);
  });

  it("dedups same-key updates to the latest and counts collapsed intermediates", () => {
    let s = createUpdateSchedulerState();
    s = enqueueUpdate(s, { key: "a", critical: false }, 0);
    s = enqueueUpdate(s, { key: "a", critical: false }, 10);
    s = enqueueUpdate(s, { key: "a", critical: false }, 20);
    expect(s.pending.size).toBe(1);
    expect(s.coalescedNonCritical).toBe(2);
    const flushed = drainScheduler(s, 30);
    expect(flushed.keys).toEqual(["a"]);
    expect(flushed.coalescedNonCritical).toBe(2);
  });

  it("flushes a critical update IMMEDIATELY, bypassing throttle and debounce", () => {
    let s = createUpdateSchedulerState();
    // Simulate a very recent flush so throttle would otherwise block.
    s = { ...s, lastFlushAt: 0 };
    s = enqueueUpdate(s, { key: "task-1", critical: true }, 5);
    const d = decideFlush(s, 5, budget);
    expect(d.due).toBe(true);
    expect(d.reason).toBe("critical");
  });

  it("never demotes a key to non-critical once it has been critical", () => {
    let s = createUpdateSchedulerState();
    s = enqueueUpdate(s, { key: "t", critical: true }, 0);
    s = enqueueUpdate(s, { key: "t", critical: false }, 10);
    expect(s.hasCritical).toBe(true);
    expect([...s.pending.values()][0].critical).toBe(true);
  });

  it("throttles non-critical flushes: gate ready but spacing not elapsed defers", () => {
    let s = createUpdateSchedulerState();
    s = { ...s, lastFlushAt: 1000 };
    s = enqueueUpdate(s, { key: "a", critical: false }, 1000);
    // Debounce elapsed, but only 50ms since last flush (< throttleInterval).
    const t = 1000 + budget.debounceWindowMs;
    const withRecentFlush = { ...s, lastFlushAt: t - 50 };
    const d = decideFlush(withRecentFlush, t, budget);
    expect(d.due).toBe(false);
    expect(d.nextAttemptInMs).toBeGreaterThan(0);
  });

  it("flushes when the batch fills even before the debounce window", () => {
    let s = createUpdateSchedulerState();
    const small = resolvePerfBudget({ maxBatchSize: 3, debounceWindowMs: 10_000 });
    for (let i = 0; i < 3; i++) s = enqueueUpdate(s, { key: `k${i}`, critical: false }, 0);
    const d = decideFlush(s, 1, small);
    expect(d.due).toBe(true);
    expect(d.reason).toBe("batch_full");
  });

  it("force-flushes pending state on unmount so nothing is lost", () => {
    let s = createUpdateSchedulerState();
    s = enqueueUpdate(s, { key: "a", critical: false }, 0);
    const f = forceFlush(s, 5);
    expect(f?.keys).toEqual(["a"]);
    expect(forceFlush(createUpdateSchedulerState(), 5)).toBeNull();
  });
});

// ── Reconnect backoff ───────────────────────────────────────────────────────
describe("reconnect backoff", () => {
  it("grows exponentially and clamps to the max", () => {
    expect(reconnectDelayMs(1, budget)).toBe(budget.reconnectBackoffMinMs);
    expect(reconnectDelayMs(2, budget)).toBe(budget.reconnectBackoffMinMs * 2);
    expect(reconnectDelayMs(99, budget)).toBe(budget.reconnectBackoffMaxMs);
  });

  it("gives up after the configured max attempts (degrade, not tight loop)", () => {
    const b = resolvePerfBudget({ reconnectMaxAttempts: 3 });
    expect(shouldStopReconnecting(2, b)).toBe(false);
    expect(shouldStopReconnecting(3, b)).toBe(true);
    const plan = planReconnect(2, b); // planning the 3rd attempt
    expect(plan.attempt).toBe(3);
    expect(plan.giveUp).toBe(true);
  });
});

// ── Large graph + max delta ─────────────────────────────────────────────────
describe("large-graph + max-delta safeguards", () => {
  it("classifies normal / heavy / large by threshold", () => {
    expect(assessGraphLoad({ nodeCount: 10, edgeCount: 5 }, budget).level).toBe("normal");
    const heavy = assessGraphLoad(
      { nodeCount: Math.ceil(budget.largeGraphNodeThreshold * 0.8), edgeCount: 0 },
      budget,
    );
    expect(heavy.level).toBe("heavy");
    expect(heavy.warn).toBe(true);
    const large = assessGraphLoad(
      { nodeCount: budget.largeGraphNodeThreshold, edgeCount: 0 },
      budget,
    );
    expect(large.isLarge).toBe(true);
    expect(large.level).toBe("large");
  });

  it("keeps a delta within budget incremental, and forces full_resync when oversized", () => {
    const ok = decideDeltaSize({ nodeOps: 10, edgeOps: 10 }, budget);
    expect(ok.withinBudget).toBe(true);
    expect(ok.requiresFullResync).toBe(false);
    const big = decideDeltaSize(
      { nodeOps: budget.maxDeltaOperations, edgeOps: 1 },
      budget,
    );
    expect(big.withinBudget).toBe(false);
    expect(big.requiresFullResync).toBe(true);
  });
});

// ── Observability ───────────────────────────────────────────────────────────
describe("observability counters", () => {
  it("records counts, durations, averages and flush outcomes", () => {
    const obs = createRealtimePerfObservability();
    obs.incr("subscriptionCount");
    obs.incr("noticeCount", 3);
    obs.incr("reconnectCount");
    obs.incr("staleCount");
    obs.incr("errorCount");
    obs.incr("warningCount");
    obs.recordRecalcDuration(12);
    obs.recordRecalcDuration(8);
    obs.recordRenderLatency(4, 5);
    obs.recordFlush({ batchSize: 5, hadCritical: true, coalescedNonCritical: 2 });

    const snap = obs.snapshot();
    expect(snap.subscriptionCount).toBe(1);
    expect(snap.noticeCount).toBe(3);
    expect(snap.reconnectCount).toBe(1);
    expect(snap.staleCount).toBe(1);
    expect(snap.avgRecalcDurationMs).toBe(10);
    expect(snap.lastRenderLatencyMs).toBe(4);
    expect(snap.deltaCount).toBe(1);
    expect(snap.criticalPreservedCount).toBe(5);
    expect(snap.skippedNonCriticalCount).toBe(2);
  });

  it("snapshot is numeric-only (no tenant/task/team identifiers leak)", () => {
    const obs = createRealtimePerfObservability();
    obs.incr("noticeCount");
    for (const v of Object.values(obs.snapshot())) {
      expect(v === null || typeof v === "number").toBe(true);
    }
  });
});

// ── Import boundary (no canonical mutation, no DB client, no process graph) ──
describe("import boundary", () => {
  it("Task-6 safeguard modules never touch canonical truth, a DB client, or the process graph", () => {
    const dir = join(process.cwd(), "src/lib/living-graph/realtime");
    const files = [
      "performance-budget.ts",
      "critical-update.ts",
      "update-scheduler.ts",
      "reconnect-backoff.ts",
      "large-graph.ts",
      "perf-observability.ts",
    ];
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
        .join("\n");
      expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\/(ingestion|dual-write)["']|from\s+["']@\/lib\/graph\/emit-event["']/);
      expect(code).not.toMatch(/process_nodes|process_edges/);
      expect(code).not.toMatch(/supabase|createAdminClient|createClient|service_role/i);
      expect(code).not.toMatch(/project_event_log/);
      expect(code).not.toMatch(/graph-layout-storage|localStorage/);
    }
  });
});
