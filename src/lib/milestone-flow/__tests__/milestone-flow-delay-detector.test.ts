// ============================================================================
// Phase 3 · Task 5 — Milestone Flow Delay Detector guards
// ============================================================================
// Protects PEG-MPF-DELAY-DETECTION: blocker/waiting/decision/approval detection
// from Task 3 segments + Task 4 metric durations (never recomputed, no Date.now);
// open vs resolved status; detection severity (NOT health); confidence capping;
// evidence dedup/preservation; unknown-segment skipping; read-only (no mutation);
// engine integration (findings present, health still unsupported). Also asserts
// the Task 4 pre-flight: unknown segments stay represented.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  detectMilestoneFlowDelays,
  detectMilestoneTransitionDelays,
  detectBlockerFindings,
  detectWaitingTimeFindings,
  detectDecisionDelayFindings,
  detectApprovalDelayFindings,
  determineMilestoneFlowFindingStatus,
  determineMilestoneFlowFindingSeverity,
  determineMilestoneFlowFindingConfidence,
  mergeMilestoneFlowFindingEvidence,
  calculateMilestoneTransitionMetrics,
  aggregateMilestoneFlowTimeBuckets,
  calculateMilestoneSegmentDurationMetrics,
  createMilestoneProcessFlowEngine,
  MpfUnsupportedOperationError,
  MPF_CONFIG_VERSION,
  type BuiltMilestoneFlowSegment,
  type BuiltMilestoneTransition,
  type MilestoneFlowTransitionMetrics,
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

function seg(o: Partial<BuiltMilestoneFlowSegment> & { segmentId: string; type: BuiltMilestoneFlowSegment["type"] }): BuiltMilestoneFlowSegment {
  return {
    transitionId: "tr1",
    startedAt: null,
    endedAt: null,
    durationMs: null,
    frictionType: null,
    evidence: [{ kind: "fact", eventId: "e-" + o.segmentId, confidence: "high" }],
    sourceEventId: "e-" + o.segmentId,
    closingEventId: null,
    semanticCategories: [],
    confidence: "high",
    notes: "",
    isOpenEnded: false,
    ...o,
  };
}

function transition(segments: BuiltMilestoneFlowSegment[], o: Partial<BuiltMilestoneTransition> = {}): BuiltMilestoneTransition {
  return {
    transitionId: "tr1",
    scope: SCOPE,
    sourceMilestoneId: "m1",
    targetMilestoneId: "m2",
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    state: { status: "active", currentSegmentType: null, isBlocked: false, lastEventAt: null },
    segments,
    evidenceEventIds: [],
    orderedEventIds: [],
    confidence: "high",
    createdByEngineVersion: "v",
    configVersion: MPF_CONFIG_VERSION,
    ...o,
  };
}

/** Build Task 4 metrics for a transition (real calculator, not fabricated). */
function metricsFor(t: BuiltMilestoneTransition): MilestoneFlowTransitionMetrics {
  return calculateMilestoneTransitionMetrics(t);
}

describe("blocker detection", () => {
  it("detects a resolved blocker from a closed blocked segment", () => {
    const t = transition([
      seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-05T00:00:00.000Z", closingEventId: "unblock" }),
    ]);
    const f = detectBlockerFindings(t, metricsFor(t))[0];
    expect(f.findingType).toBe("blocker");
    expect(f.status).toBe("resolved");
    expect(f.durationMs).toBe(3 * DAY);
    expect(f.isOpen).toBe(false);
  });

  it("detects an open blocker from an open-ended blocked segment", () => {
    const t = transition([
      seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: null, isOpenEnded: true }),
    ]);
    const f = detectBlockerFindings(t, metricsFor(t))[0];
    expect(f.status).toBe("open");
    expect(f.isOpen).toBe(true);
    expect(f.durationMs).toBeNull(); // open, no analysisAsOf → unknown duration
  });
});

describe("waiting / decision / approval detection", () => {
  it("detects waiting time (null duration when unknown)", () => {
    const t = transition([seg({ segmentId: "w", type: "waiting", startedAt: "2026-01-02T00:00:00.000Z", endedAt: null, isOpenEnded: true })]);
    const f = detectWaitingTimeFindings(t, metricsFor(t))[0];
    expect(f.findingType).toBe("waiting_time");
    expect(f.durationMs).toBeNull();
  });

  it("detects a resolved decision delay when the segment closed", () => {
    const t = transition([seg({ segmentId: "d", type: "decision_delay", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-04T00:00:00.000Z", closingEventId: "made" })]);
    const f = detectDecisionDelayFindings(t, metricsFor(t))[0];
    expect(f.findingType).toBe("decision_delay");
    expect(f.status).toBe("resolved");
    expect(f.durationMs).toBe(2 * DAY);
  });

  it("detects an open approval delay when unresolved", () => {
    const t = transition([seg({ segmentId: "a", type: "approval_delay", startedAt: "2026-01-02T00:00:00.000Z", endedAt: null, isOpenEnded: true })]);
    const f = detectApprovalDelayFindings(t, metricsFor(t))[0];
    expect(f.findingType).toBe("approval_delay");
    expect(f.status).toBe("open");
  });

  it("does not generate a finding for an unknown segment", () => {
    const t = transition([seg({ segmentId: "u", type: "unknown", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-03T00:00:00.000Z" })]);
    const { findings, warnings } = detectMilestoneTransitionDelays(t, metricsFor(t));
    expect(findings).toHaveLength(0);
    expect(warnings.some((w) => w.code === "UNKNOWN_SEGMENT_SKIPPED")).toBe(true);
  });
});

describe("status / severity / confidence", () => {
  it("status: open when open-ended, unknown when no evidence", () => {
    expect(determineMilestoneFlowFindingStatus(seg({ segmentId: "s", type: "blocked", isOpenEnded: true }), undefined)).toBe("open");
    expect(determineMilestoneFlowFindingStatus(seg({ segmentId: "s", type: "blocked", evidence: [] }), undefined)).toBe("unknown");
  });

  it("severity is detection severity from duration, capped when confidence unknown; null duration → unknown", () => {
    expect(determineMilestoneFlowFindingSeverity({ durationMs: 20 * DAY, findingType: "blocker", confidence: "high" })).toBe("critical");
    expect(determineMilestoneFlowFindingSeverity({ durationMs: 4 * DAY, findingType: "blocker", confidence: "high" })).toBe("medium");
    expect(determineMilestoneFlowFindingSeverity({ durationMs: null, findingType: "blocker", confidence: "high" })).toBe("unknown");
    // Confidence unknown downgrades one level (critical → high).
    expect(determineMilestoneFlowFindingSeverity({ durationMs: 20 * DAY, findingType: "blocker", confidence: "unknown" })).toBe("high");
  });

  it("severity is not mapped to health status vocabulary", () => {
    const sev = determineMilestoneFlowFindingSeverity({ durationMs: 20 * DAY, findingType: "blocker", confidence: "high" });
    expect(["critical", "high", "medium", "low", "unknown"]).toContain(sev);
    expect(["healthy", "degraded", "blocked", "at_risk"]).not.toContain(sev);
  });

  it("confidence capped by weak/backfilled evidence and unknown duration", () => {
    expect(determineMilestoneFlowFindingConfidence({ evidence: [{ kind: "fact", eventId: "e", confidence: "high" }], segmentConfidence: "high", durationMs: 1000 })).toBe("high");
    expect(determineMilestoneFlowFindingConfidence({ evidence: [{ kind: "fact", eventId: "e", confidence: "high" }], segmentConfidence: "medium", metricConfidence: "medium", durationMs: null })).toBe("low");
    expect(determineMilestoneFlowFindingConfidence({ evidence: [], segmentConfidence: "high", durationMs: 1000 })).toBe("unknown");
  });
});

describe("evidence", () => {
  it("preserves and deduplicates evidence refs", () => {
    const dup = { kind: "fact" as const, eventId: "same", confidence: "high" as const };
    const merged = mergeMilestoneFlowFindingEvidence([dup], [dup], [{ kind: "fact", eventId: "other", confidence: "medium" }]);
    expect(merged).toHaveLength(2);
  });

  it("finding carries segment evidence event ids", () => {
    const t = transition([seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-05T00:00:00.000Z", closingEventId: "unblock", evidence: [{ kind: "fact", eventId: "blockEvt", confidence: "high" }] })]);
    const f = detectBlockerFindings(t, metricsFor(t))[0];
    expect(f.sourceEventIds).toContain("blockEvt");
    expect(f.evidenceRefs.length).toBeGreaterThan(0);
  });
});

describe("metric consumption + preflight (Task 4 unknown representation)", () => {
  it("uses Task 4 metric duration (no Date.now)", () => {
    const t = transition([seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-05T00:00:00.000Z", closingEventId: "u" })]);
    const m = metricsFor(t);
    const f = detectBlockerFindings(t, m)[0];
    expect(f.durationMs).toBe(m.segmentDurations.find((s) => s.segmentId === "b")!.segmentDurationMs);
  });

  it("Task 4 still represents unknown segments (unknownTimeMs + unknownSegmentCount)", () => {
    const unknownSeg = seg({ segmentId: "u", type: "unknown", startedAt: "2026-01-01T00:00:00.000Z", endedAt: "2026-01-02T00:00:00.000Z" });
    const durations = calculateMilestoneSegmentDurationMetrics([unknownSeg]);
    const buckets = aggregateMilestoneFlowTimeBuckets(durations);
    expect(buckets.unknownTimeMs).toBe(1 * DAY);
    const m = metricsFor(transition([unknownSeg]));
    expect(m.counters.unknownSegmentCount).toBe(1);
  });

  it("missing metrics → warning, not crash", () => {
    const t = transition([seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-05T00:00:00.000Z", closingEventId: "u" })]);
    const { findings, warnings } = detectMilestoneTransitionDelays(t, undefined);
    expect(findings).toHaveLength(1);
    expect(findings[0].durationMs).toBeNull(); // no metrics → unknown duration
    expect(warnings.some((w) => w.code === "MISSING_METRICS_FOR_TRANSITION")).toBe(true);
  });
});

describe("read-only + safety", () => {
  it("empty transitions return empty findings", () => {
    const t = transition([]);
    expect(detectMilestoneTransitionDelays(t, metricsFor(t)).findings).toEqual([]);
  });

  it("does not mutate transitions, segments, or metrics", () => {
    const t = transition([seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-05T00:00:00.000Z", closingEventId: "u" })]);
    const m = metricsFor(t);
    const tSnap = JSON.parse(JSON.stringify(t));
    const mSnap = JSON.parse(JSON.stringify(m));
    detectMilestoneFlowDelays({ scope: SCOPE, transitions: [t], metricsByTransition: { tr1: m } });
    expect(t).toEqual(tSnap);
    expect(m).toEqual(mSnap);
  });

  it("detector code never imports the event write-path, process tables, or Date.now", () => {
    const dir = join(process.cwd(), "src/lib/milestone-flow");
    for (const f of ["delay-detector.ts", "delay-detector-types.ts", "blocker-detector.ts"]) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
      expect(code).not.toMatch(/emitProjectEvent|from\s+["']@\/lib\/events\/ingestion["']/);
      expect(code).not.toMatch(/process_nodes|process_edges/);
      expect(code).not.toMatch(/Date\.now/);
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
  function evt(id: string, type: string, at: string, milestoneId?: string, subjectType = "task", subjectId = "s"): MilestoneFlowEventRef {
    return { eventId: id, eventType: type, eventCategory: "t", occurredAt: at, subjectType, subjectId, fromState: null, toState: null, lifecycleClass: "BUSINESS_EVENT", confidence: 0.95, isCompensatingEvent: false, milestoneId: milestoneId ?? null };
  }
  const fixedNow = () => new Date("2026-07-02T10:00:00.000Z");

  it("buildMilestoneFlowProjection includes findingsByTransition", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const events = [
      evt("e-start", "TaskStarted", "2026-01-12T00:00:00.000Z", "m2"),
      evt("e-block", "TaskBlocked", "2026-01-15T00:00:00.000Z", "m2"),
      evt("e-unblock", "TaskUnblocked", "2026-01-18T00:00:00.000Z", "m2"),
      evt("e-done", "MilestoneAchieved", "2026-01-30T00:00:00.000Z", undefined, "milestone", "m2"),
    ];
    const out = engine.buildMilestoneFlowProjection(input([M1, M2], events));
    const trId = out.projection.transitions[0].transitionId;
    expect(out.projection.findingsByTransition).toBeDefined();
    const findings = out.projection.findingsByTransition![trId];
    expect(findings.some((f) => f.findingType === "blocker")).toBe(true);
    expect(typeof out.observability.blockerFindingCount).toBe("number");
    // Health remains unknown.
    expect(Object.keys(out.projection.healthByTransition)).toHaveLength(0);
  });

  it("classifyTransitionHealth remains not implemented", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const t = transition([]);
    const m = engine.calculateFlowMetrics(t);
    expect(() => engine.classifyTransitionHealth(t, m)).toThrow(MpfUnsupportedOperationError);
  });

  it("empty input returns empty findings", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const out = engine.buildMilestoneFlowProjection(input([], []));
    expect(out.projection.findingsByTransition).toEqual({});
  });
});
