// ============================================================================
// Phase 3 · Task 4 — Milestone Flow Metrics Calculator guards
// ============================================================================
// Protects PEG-MPF-FLOW-METRICS: deterministic closed/open segment durations
// (open ONLY via explicit analysisAsOf — no Date.now), negative-duration safety,
// time-bucket aggregation, composition percentages (documented denominator),
// flow efficiency, transition planned/actual/elapsed durations, confidence capping,
// evidence dedup, read-only (no mutation), and engine integration (metrics present,
// health still unsupported). No DB write-path / process tables.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calculateMilestoneTransitionMetrics,
  calculateMilestoneSegmentDuration,
  aggregateMilestoneFlowTimeBuckets,
  calculateMilestoneFlowPercentages,
  calculateMilestoneFlowEfficiency,
  calculateMilestoneTransitionDurationMetrics,
  determineMilestoneMetricConfidence,
  mergeMilestoneFlowMetricEvidence,
  calculateMilestoneSegmentDurationMetrics,
  createMilestoneProcessFlowEngine,
  MpfUnsupportedOperationError,
  MPF_CONFIG_VERSION,
  type BuiltMilestoneFlowSegment,
  type BuiltMilestoneTransition,
  type MilestoneFlowMilestoneRef,
  type MilestoneFlowProjectScope,
  type MilestoneFlowInputContract,
  type MilestoneFlowAccessContext,
  type MilestoneFlowEventRef,
} from "@/lib/milestone-flow";

const ORG = "org-1";
const PROJ = "proj-1";
const SCOPE: MilestoneFlowProjectScope = { organizationId: ORG, projectId: PROJ };
const DAY = 24 * 60 * 60 * 1000;

function seg(overrides: Partial<BuiltMilestoneFlowSegment> & { segmentId: string; type: BuiltMilestoneFlowSegment["type"] }): BuiltMilestoneFlowSegment {
  return {
    transitionId: "tr1",
    startedAt: null,
    endedAt: null,
    durationMs: null,
    frictionType: null,
    evidence: [{ kind: "fact", eventId: "e-" + overrides.segmentId, confidence: "high" }],
    sourceEventId: null,
    closingEventId: null,
    semanticCategories: [],
    confidence: "high",
    notes: "",
    isOpenEnded: false,
    ...overrides,
  };
}

function transition(segments: BuiltMilestoneFlowSegment[], overrides: Partial<BuiltMilestoneTransition> = {}): BuiltMilestoneTransition {
  return {
    transitionId: "tr1",
    scope: SCOPE,
    sourceMilestoneId: "m1",
    targetMilestoneId: "m2",
    startedAt: null,
    completedAt: null,
    state: { status: "active", currentSegmentType: null, isBlocked: false, lastEventAt: null },
    segments,
    evidenceEventIds: [],
    orderedEventIds: [],
    confidence: "high",
    createdByEngineVersion: "v",
    configVersion: MPF_CONFIG_VERSION,
    ...overrides,
  };
}

describe("segment duration", () => {
  it("calculates a closed segment duration", () => {
    const r = calculateMilestoneSegmentDuration(seg({ segmentId: "s", type: "active_work", startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-03T00:00:00.000Z" }));
    expect(r.segmentDurationMs).toBe(2 * DAY);
    expect(r.durationCompleteness).toBe("complete");
  });

  it("calculates an open segment duration ONLY with explicit analysisAsOf", () => {
    const s = seg({ segmentId: "s", type: "blocked", startedAt: "2026-01-01T00:00:00.000Z", endedAt: null, isOpenEnded: true });
    const withAsOf = calculateMilestoneSegmentDuration(s, { analysisAsOf: "2026-01-02T00:00:00.000Z" });
    expect(withAsOf.segmentDurationMs).toBe(1 * DAY);
    expect(withAsOf.durationCompleteness).toBe("partial");
  });

  it("open segment without analysisAsOf → unknown duration + warning (no Date.now)", () => {
    const s = seg({ segmentId: "s", type: "blocked", startedAt: "2026-01-01T00:00:00.000Z", endedAt: null, isOpenEnded: true });
    const r = calculateMilestoneSegmentDuration(s);
    expect(r.segmentDurationMs).toBeNull();
    expect(r.durationCompleteness).toBe("unknown");
    expect(r.warnings.some((w) => w.code === "MISSING_ANALYSIS_AS_OF_FOR_OPEN_SEGMENT")).toBe(true);
  });

  it("negative segment duration → unknown + warning", () => {
    const r = calculateMilestoneSegmentDuration(seg({ segmentId: "s", type: "active_work", startedAt: "2026-01-05T00:00:00.000Z", endedAt: "2026-01-01T00:00:00.000Z" }));
    expect(r.segmentDurationMs).toBeNull();
    expect(r.warnings.some((w) => w.code === "INVALID_SEGMENT_DURATION")).toBe(true);
  });
});

describe("time buckets + percentages + efficiency", () => {
  const segments = [
    seg({ segmentId: "a", type: "active_work", startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-07T00:00:00.000Z" }), // 6d
    seg({ segmentId: "w", type: "waiting", startedAt: "2026-01-07T00:00:00.000Z", endedAt: "2026-01-08T00:00:00.000Z" }), // 1d
    seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-08T00:00:00.000Z", endedAt: "2026-01-09T00:00:00.000Z" }), // 1d
    seg({ segmentId: "d", type: "decision_delay", startedAt: "2026-01-09T00:00:00.000Z", endedAt: "2026-01-10T00:00:00.000Z" }), // 1d
    seg({ segmentId: "p", type: "approval_delay", startedAt: "2026-01-10T00:00:00.000Z", endedAt: "2026-01-11T00:00:00.000Z" }), // 1d
    seg({ segmentId: "r", type: "rework", startedAt: "2026-01-11T00:00:00.000Z", endedAt: "2026-01-12T00:00:00.000Z" }), // 1d
    seg({ segmentId: "h", type: "handoff", startedAt: "2026-01-12T00:00:00.000Z", endedAt: "2026-01-13T00:00:00.000Z" }), // 1d
    seg({ segmentId: "v", type: "review", startedAt: "2026-01-13T00:00:00.000Z", endedAt: "2026-01-14T00:00:00.000Z" }), // 1d
    seg({ segmentId: "x", type: "external_constraint", startedAt: "2026-01-14T00:00:00.000Z", endedAt: "2026-01-15T00:00:00.000Z" }), // 1d
    seg({ segmentId: "u", type: "unknown", startedAt: "2026-01-15T00:00:00.000Z", endedAt: "2026-01-16T00:00:00.000Z" }), // 1d
  ];
  const durations = calculateMilestoneSegmentDurationMetrics(segments);
  const buckets = aggregateMilestoneFlowTimeBuckets(durations);

  it("aggregates every segment type into its bucket", () => {
    expect(buckets.activeWorkTimeMs).toBe(6 * DAY);
    expect(buckets.waitingTimeMs).toBe(1 * DAY);
    expect(buckets.blockedTimeMs).toBe(1 * DAY);
    expect(buckets.decisionDelayTimeMs).toBe(1 * DAY);
    expect(buckets.approvalDelayTimeMs).toBe(1 * DAY);
    expect(buckets.reworkTimeMs).toBe(1 * DAY);
    expect(buckets.handoffTimeMs).toBe(1 * DAY);
    expect(buckets.reviewTimeMs).toBe(1 * DAY);
    expect(buckets.externalConstraintTimeMs).toBe(1 * DAY);
    expect(buckets.unknownTimeMs).toBe(1 * DAY);
    expect(buckets.totalKnownSegmentTimeMs).toBe(15 * DAY);
  });

  it("calculates composition percentages against totalKnownSegmentTimeMs", () => {
    const pct = calculateMilestoneFlowPercentages(buckets);
    expect(pct.denominator).toBe("totalKnownSegmentTimeMs");
    expect(pct.activeWorkPercent).toBe(40); // 6/15
  });

  it("calculates flow efficiency; null when denominator is zero", () => {
    expect(calculateMilestoneFlowEfficiency(buckets)).toBe(0.4);
    const empty = aggregateMilestoneFlowTimeBuckets([]);
    expect(calculateMilestoneFlowEfficiency(empty)).toBeNull();
    expect(calculateMilestoneFlowPercentages(empty).activeWorkPercent).toBeNull();
  });
});

describe("transition duration", () => {
  const mMap = new Map<string, MilestoneFlowMilestoneRef>([
    ["m1", { milestoneId: "m1", name: "m1", type: null, plannedDate: "2026-01-01T00:00:00.000Z", forecastDate: null, actualDate: "2026-01-02T00:00:00.000Z", ownerId: null, status: null }],
    ["m2", { milestoneId: "m2", name: "m2", type: null, plannedDate: "2026-01-11T00:00:00.000Z", forecastDate: null, actualDate: null, ownerId: null, status: null }],
  ]);

  it("calculates planned duration from planned milestone dates", () => {
    const { detail } = calculateMilestoneTransitionDurationMetrics(
      { sourceMilestoneId: "m1", targetMilestoneId: "m2", startedAt: null, completedAt: null },
      { milestones: mMap },
    );
    expect(detail.plannedDurationMs).toBe(10 * DAY);
  });

  it("calculates actual duration from started/completed and marks completeness", () => {
    const { detail } = calculateMilestoneTransitionDurationMetrics(
      { sourceMilestoneId: "m1", targetMilestoneId: "m2", startedAt: "2026-01-02T00:00:00.000Z", completedAt: "2026-01-09T00:00:00.000Z" },
      { milestones: mMap },
    );
    expect(detail.actualDurationMs).toBe(7 * DAY);
    expect(detail.isCompleted).toBe(true);
    expect(detail.durationCompleteness).toBe("complete");
  });

  it("handles missing planned/actual dates safely (warnings, not crash)", () => {
    const { detail, warnings } = calculateMilestoneTransitionDurationMetrics(
      { sourceMilestoneId: "mx", targetMilestoneId: "my", startedAt: null, completedAt: null },
      { milestones: new Map() },
    );
    expect(detail.plannedDurationMs).toBeNull();
    expect(detail.actualDurationMs).toBeNull();
    expect(warnings.some((w) => w.code === "MISSING_PLANNED_DATES")).toBe(true);
    expect(warnings.some((w) => w.code === "MISSING_ACTUAL_DATES")).toBe(true);
  });

  it("open transition elapsed uses analysisAsOf only", () => {
    const noAsOf = calculateMilestoneTransitionDurationMetrics(
      { sourceMilestoneId: "m1", targetMilestoneId: "m2", startedAt: "2026-01-02T00:00:00.000Z", completedAt: null },
      { milestones: mMap },
    );
    expect(noAsOf.detail.elapsedDurationMs).toBeNull();
    const asOf = calculateMilestoneTransitionDurationMetrics(
      { sourceMilestoneId: "m1", targetMilestoneId: "m2", startedAt: "2026-01-02T00:00:00.000Z", completedAt: null },
      { milestones: mMap, analysisAsOf: "2026-01-05T00:00:00.000Z" },
    );
    expect(asOf.detail.elapsedDurationMs).toBe(3 * DAY);
  });
});

describe("confidence + evidence", () => {
  it("caps confidence when unknown segments / open-without-asOf exist", () => {
    const evidence = [{ kind: "fact" as const, eventId: "e1", confidence: "high" as const }];
    expect(determineMilestoneMetricConfidence({ evidence, hasUnknownSegments: false, hasInvalidDurations: false, hasOpenWithoutAsOf: false })).toBe("high");
    expect(determineMilestoneMetricConfidence({ evidence, hasUnknownSegments: true, hasInvalidDurations: false, hasOpenWithoutAsOf: false })).toBe("low");
    expect(determineMilestoneMetricConfidence({ evidence: [], hasUnknownSegments: false, hasInvalidDurations: false, hasOpenWithoutAsOf: false })).toBe("unknown");
  });

  it("confidence never exceeds the weakest backfilled evidence", () => {
    const t = transition([
      seg({ segmentId: "s", type: "active_work", startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-02T00:00:00.000Z", confidence: "medium", evidence: [{ kind: "fact", eventId: "bf", confidence: "medium" }] }),
    ], { completedAt: "2026-01-02T00:00:00.000Z", startedAt: "2026-01-01T00:00:00.000Z" });
    const m = calculateMilestoneTransitionMetrics(t);
    expect(["medium", "low", "unknown"]).toContain(m.confidence);
    expect(m.confidence).not.toBe("high");
  });

  it("deduplicates evidence refs", () => {
    const dup = { kind: "fact" as const, eventId: "same", confidence: "high" as const };
    const merged = mergeMilestoneFlowMetricEvidence({ evidenceEventIds: [] }, [
      seg({ segmentId: "a", type: "active_work", evidence: [dup] }),
      seg({ segmentId: "b", type: "waiting", evidence: [dup] }),
    ]);
    expect(merged).toHaveLength(1);
  });
});

describe("read-only — no mutation", () => {
  it("does not mutate transitions or segments", () => {
    const segments = [seg({ segmentId: "s", type: "active_work", startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-02T00:00:00.000Z" })];
    const t = transition(segments, { startedAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-02T00:00:00.000Z" });
    const snap = JSON.parse(JSON.stringify(t));
    calculateMilestoneTransitionMetrics(t);
    expect(t).toEqual(snap);
  });

  it("calculator code never imports the event write-path or references process graph tables", () => {
    const dir = join(process.cwd(), "src/lib/milestone-flow");
    for (const f of ["metrics-calculator.ts", "metrics-calculator-types.ts"]) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
      expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\/ingestion["']/);
      expect(code).not.toMatch(/process_nodes|process_edges/);
      expect(code).not.toMatch(/Date\.now/); // replay-stable: no wall clock
    }
  });
});

describe("engine integration", () => {
  const M1: MilestoneFlowMilestoneRef = { milestoneId: "m1", name: "m1", type: null, plannedDate: "2026-01-01T00:00:00.000Z", forecastDate: null, actualDate: "2026-01-10T00:00:00.000Z", ownerId: null, status: null };
  const M2: MilestoneFlowMilestoneRef = { milestoneId: "m2", name: "m2", type: null, plannedDate: "2026-02-01T00:00:00.000Z", forecastDate: null, actualDate: null, ownerId: null, status: null };
  function access(): MilestoneFlowAccessContext {
    return { userId: "u1", organizationId: ORG, scope: "pm", authorizedProjectIds: [PROJ] };
  }
  function input(milestones: MilestoneFlowMilestoneRef[], events: MilestoneFlowEventRef[]): MilestoneFlowInputContract {
    return { scope: SCOPE, milestones, events, config: { configVersion: MPF_CONFIG_VERSION }, access: access() };
  }
  function evt(id: string, type: string, at: string, milestoneId?: string): MilestoneFlowEventRef {
    return { eventId: id, eventType: type, eventCategory: "t", occurredAt: at, subjectType: milestoneId ? "task" : "task", subjectId: "s", fromState: null, toState: null, lifecycleClass: "BUSINESS_EVENT", confidence: 0.95, isCompensatingEvent: false, milestoneId: milestoneId ?? null };
  }
  const fixedNow = () => new Date("2026-07-02T10:00:00.000Z");

  it("buildMilestoneFlowProjection includes metricsByTransition", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const events = [
      evt("e1", "TaskStarted", "2026-01-12T00:00:00.000Z", "m2"),
      evt("e2", "MilestoneAchieved", "2026-01-30T00:00:00.000Z"),
    ];
    events[1].subjectType = "milestone";
    events[1].subjectId = "m2";
    const out = engine.buildMilestoneFlowProjection(input([M1, M2], events));
    const trId = out.projection.transitions[0].transitionId;
    expect(out.projection.metricsByTransition[trId]).toBeDefined();
    expect(typeof out.observability.metricsCalculatedCount).toBe("number");
    // Health remains unknown (no health assessments).
    expect(Object.keys(out.projection.healthByTransition)).toHaveLength(0);
  });

  it("calculateFlowMetrics delegates to the calculator (no longer throws)", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const t = transition([seg({ segmentId: "s", type: "active_work", startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-02T00:00:00.000Z" })], { startedAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-01-02T00:00:00.000Z" });
    const m = engine.calculateFlowMetrics(t);
    expect(m.activeWorkTimeMs).toBe(DAY);
    expect(m.duration.actualDurationMs).toBe(DAY);
  });

  it("classifyTransitionHealth remains not implemented", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const t = transition([], {});
    const m = engine.calculateFlowMetrics(t);
    expect(() => engine.classifyTransitionHealth(t, m)).toThrow(MpfUnsupportedOperationError);
  });

  it("empty input returns safe empty metrics", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const out = engine.buildMilestoneFlowProjection(input([], []));
    expect(out.projection.metricsByTransition).toEqual({});
  });
});
