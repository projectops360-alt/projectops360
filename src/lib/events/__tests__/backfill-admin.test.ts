// ============================================================================
// Phase 2 — Backfill Runner & Console guards (RBAC + quality/replay reports)
// ============================================================================

import { describe, it, expect } from "vitest";
import { canRunBackfill } from "@/lib/events/backfill-access";
import {
  computeQualityReport, computeReplayReadiness, computeOrgMemoryReport,
} from "@/lib/events/backfill-reports";
import type { BackfillReport } from "@/lib/events/backfill";

function report(over: Partial<BackfillReport> = {}): BackfillReport {
  return {
    backfillBatchId: "b", projectId: "p", organizationId: "o",
    startedAt: "", completedAt: "", status: "completed",
    sourceModulesProcessed: ["roadmap_tasks", "milestones"],
    eventsCreated: 10, eventsSkipped: 2, eventsFailed: 0,
    byType: { TaskCreated: 6, MilestoneCreated: 4 },
    confidenceDistribution: { high: 6, medium: 4, low: 0 },
    confidenceStats: { count: 10, sum: 8.4, min: 0.6, max: 0.9 },
    explicitEvents: 6, inferredEvents: 4,
    unsupportedSources: [], warnings: [], errorSummary: [],
    ...over,
  };
}

describe("canRunBackfill (RBAC)", () => {
  it("allows org owners and admins", () => {
    expect(canRunBackfill({ role: "owner", email: "a@x.io" })).toBe(true);
    expect(canRunBackfill({ role: "admin", email: "a@x.io" })).toBe(true);
  });
  it("denies members and viewers by default", () => {
    expect(canRunBackfill({ role: "member", email: "a@x.io" })).toBe(false);
    expect(canRunBackfill({ role: "viewer", email: "a@x.io" })).toBe(false);
  });
  it("allows a platform-admin allowlisted email regardless of role", () => {
    process.env.BACKFILL_ADMIN_EMAILS = "ops@x.io, sre@x.io";
    expect(canRunBackfill({ role: "member", email: "ops@x.io" })).toBe(true);
    expect(canRunBackfill({ role: "member", email: "other@x.io" })).toBe(false);
    delete process.env.BACKFILL_ADMIN_EMAILS;
  });
});

describe("computeQualityReport", () => {
  it("derives explicit/inferred % and avg/min/max confidence", () => {
    const q = computeQualityReport(report());
    expect(q.totalEvents).toBe(10);
    expect(q.explicitPct).toBe(60);
    expect(q.inferredPct).toBe(40);
    expect(q.averageConfidence).toBe(0.84);
    expect(q.lowestConfidence).toBe(0.6);
    expect(q.highestConfidence).toBe(0.9);
    expect(q.duplicateSuppression).toBe(2);
  });
});

describe("computeReplayReadiness", () => {
  it("scores high with tasks + milestones + strong confidence", () => {
    const r = computeReplayReadiness(report());
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.label).toBe("replay_ready");
  });
  it("scores low / insufficient with no reconstructed history", () => {
    const empty = report({ eventsCreated: 0, eventsSkipped: 0, byType: {}, sourceModulesProcessed: [], confidenceStats: { count: 0, sum: 0, min: 1, max: 0 }, explicitEvents: 0, inferredEvents: 0, confidenceDistribution: { high: 0, medium: 0, low: 0 } });
    const r = computeReplayReadiness(empty);
    expect(r.label).toBe("insufficient");
    expect(r.reasons.join(" ")).toMatch(/No historical events/);
  });
});

describe("computeOrgMemoryReport", () => {
  it("aggregates projects and ranks top contributors", () => {
    const a = report({ projectId: "A", eventsCreated: 20 });
    const b = report({ projectId: "B", eventsCreated: 5 });
    const org = computeOrgMemoryReport([a, b]);
    expect(org.projectsProcessed).toBe(2);
    expect(org.totalEvents).toBe(25);
    expect(org.topContributors[0]?.projectId).toBe("A");
    expect(org.organizationalDnaReady).toBe(false);
  });
});
