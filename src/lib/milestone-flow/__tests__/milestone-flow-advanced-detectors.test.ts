// ============================================================================
// Phase 3 · Task 6 — Advanced Detectors (rework / bottleneck / propagation)
// ============================================================================
// Protects PEG-MPF-ADVANCED-DETECTION: rework from rework segments (+ possible
// rework from scope/quality friction); bottleneck CANDIDATES gated by conservative
// criteria (NOT every delay); conservative, evidence-backed constraint propagation
// (never fabricated); severity is detection severity (not health); durations READ
// from Task 4 metrics (no Date.now); confidence capping; read-only; engine
// integration (advanced findings present, health still unsupported).
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  detectMilestoneFlowAdvancedFindings,
  detectMilestoneTransitionReworkFindings,
  detectMilestoneTransitionBottleneckFindings,
  detectMilestoneConstraintPropagationFindings,
  determineMilestoneReworkType,
  determineMilestoneBottleneckType,
  determineMilestonePropagationType,
  determineAdvancedFindingSeverity,
  mergeAdvancedFindingEvidence,
  detectMilestoneFlowDelays,
  calculateMilestoneTransitionMetrics,
  createMilestoneProcessFlowEngine,
  MpfUnsupportedOperationError,
  MPF_CONFIG_VERSION,
  type BuiltMilestoneFlowSegment,
  type BuiltMilestoneTransition,
  type MilestoneFlowDetectionFinding,
  type MilestoneFlowProjectScope,
  type MilestoneFlowInputContract,
  type MilestoneFlowAccessContext,
  type MilestoneFlowEventRef,
  type MilestoneFlowMilestoneRef,
} from "@/lib/milestone-flow";

const ORG = "org-1";
const PROJ = "proj-1";
const SCOPE: MilestoneFlowProjectScope = { organizationId: ORG, projectId: PROJ };
const DAY = 24 * 60 * 60 * 1000;

function seg(o: Partial<BuiltMilestoneFlowSegment> & { segmentId: string; type: BuiltMilestoneFlowSegment["type"] }): BuiltMilestoneFlowSegment {
  return {
    transitionId: "tr1", startedAt: null, endedAt: null, durationMs: null, frictionType: null,
    evidence: [{ kind: "fact", eventId: "e-" + o.segmentId, confidence: "high" }],
    sourceEventId: "e-" + o.segmentId, closingEventId: null, semanticCategories: [], confidence: "high",
    notes: "", isOpenEnded: false, ...o,
  };
}

function transition(segments: BuiltMilestoneFlowSegment[], o: Partial<BuiltMilestoneTransition> = {}): BuiltMilestoneTransition {
  return {
    transitionId: "tr1", scope: SCOPE, sourceMilestoneId: "m1", targetMilestoneId: "m2",
    startedAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-02-01T00:00:00.000Z",
    state: { status: "completed", currentSegmentType: null, isBlocked: false, lastEventAt: null },
    segments, evidenceEventIds: [], orderedEventIds: [], confidence: "high",
    createdByEngineVersion: "v", configVersion: MPF_CONFIG_VERSION, ...o,
  };
}

const metricsFor = (t: BuiltMilestoneTransition) => calculateMilestoneTransitionMetrics(t);

describe("rework detection", () => {
  it("detects rework from a rework segment (task_reopened)", () => {
    const t = transition([seg({ segmentId: "r", type: "rework", semanticCategories: ["work"], startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-04T00:00:00.000Z" })]);
    const f = detectMilestoneTransitionReworkFindings(t, metricsFor(t))[0];
    expect(f.reworkType).toBe("task_reopened");
    expect(f.triggerType).toBe("reopened_work");
    expect(f.durationMs).toBe(2 * DAY);
    expect(f.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("determines rework type from semantic categories", () => {
    expect(determineMilestoneReworkType(seg({ segmentId: "a", type: "rework", semanticCategories: ["approval"] }))).toBe("approval_rejection");
    expect(determineMilestoneReworkType(seg({ segmentId: "d", type: "rework", semanticCategories: ["decision"] }))).toBe("decision_reversal");
    expect(determineMilestoneReworkType(seg({ segmentId: "v", type: "rework", semanticCategories: ["document"] }))).toBe("deliverable_revision");
  });

  it("detects POSSIBLE rework from scope-change / quality friction on non-rework segments", () => {
    const scope = detectMilestoneTransitionReworkFindings(transition([seg({ segmentId: "s", type: "unknown", frictionType: "scope_change", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-03T00:00:00.000Z" })]), undefined)[0];
    expect(scope.reworkType).toBe("scope_change");
    expect(scope.status).toBe("possible");
    const defect = detectMilestoneTransitionReworkFindings(transition([seg({ segmentId: "q", type: "unknown", frictionType: "quality", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-03T00:00:00.000Z" })]), undefined)[0];
    expect(defect.reworkType).toBe("defect_or_quality_failure");
  });

  it("does not recalculate duration (reads Task 4 metric)", () => {
    const t = transition([seg({ segmentId: "r", type: "rework", semanticCategories: ["work"], startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-04T00:00:00.000Z" })]);
    const m = metricsFor(t);
    const f = detectMilestoneTransitionReworkFindings(t, m)[0];
    expect(f.durationMs).toBe(m.segmentDurations.find((s) => s.segmentId === "r")!.segmentDurationMs);
  });
});

// Build Task 5 delay findings the real way (through the detector).
function delayFindingsFor(t: BuiltMilestoneTransition): MilestoneFlowDetectionFinding[] {
  return detectMilestoneFlowDelays({ scope: SCOPE, transitions: [t], metricsByTransition: { [t.transitionId]: metricsFor(t) } }).findingsByTransition[t.transitionId];
}

describe("bottleneck candidate detection", () => {
  it("detects a candidate from a long blocker (long_duration)", () => {
    const t = transition([seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-12T00:00:00.000Z", closingEventId: "u" })]); // 10d > 7d
    const { findings } = detectMilestoneTransitionBottleneckFindings(t, metricsFor(t), delayFindingsFor(t));
    const b = findings.find((x) => x.bottleneckType === "dependency")!;
    expect(b).toBeDefined();
    expect(b.candidateReason).toContain("long_duration");
  });

  it("detects a structural candidate from repeated decision delays", () => {
    const t = transition([
      seg({ segmentId: "d1", type: "decision_delay", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-03T00:00:00.000Z", closingEventId: "m1" }),
      seg({ segmentId: "d2", type: "decision_delay", startedAt: "2026-01-05T00:00:00.000Z", endedAt: "2026-01-06T00:00:00.000Z", closingEventId: "m2" }),
    ]);
    const { findings } = detectMilestoneTransitionBottleneckFindings(t, metricsFor(t), delayFindingsFor(t));
    const b = findings.find((x) => x.bottleneckType === "decision")!;
    expect(b.occurrenceCount).toBe(2);
    expect(b.isStructuralCandidate).toBe(true);
    expect(b.candidateReason).toContain("repeated_occurrence");
  });

  it("does NOT classify a short single waiting delay as a bottleneck", () => {
    const t = transition([seg({ segmentId: "w", type: "waiting", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-03T00:00:00.000Z", closingEventId: "x" })]); // 1d, single
    const { findings } = detectMilestoneTransitionBottleneckFindings(t, metricsFor(t), delayFindingsFor(t));
    expect(findings.find((x) => x.bottleneckType === "unknown")).toBeUndefined();
  });

  it("bottleneck severity is detection severity, not health", () => {
    const t = transition([seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-20T00:00:00.000Z", closingEventId: "u" })]);
    const { findings } = detectMilestoneTransitionBottleneckFindings(t, metricsFor(t), delayFindingsFor(t));
    expect(["critical", "high", "medium", "low", "unknown"]).toContain(findings[0].severity);
    expect(["healthy", "degraded", "blocked", "at_risk"]).not.toContain(findings[0].severity);
  });

  it("preserves Task 5 evidence and maps bottleneck type", () => {
    expect(determineMilestoneBottleneckType({ findingType: "approval_delay" } as MilestoneFlowDetectionFinding)).toBe("approval");
    const t = transition([seg({ segmentId: "a", type: "approval_delay", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-12T00:00:00.000Z", closingEventId: "g", evidence: [{ kind: "fact", eventId: "apprEvt", confidence: "high" }] })]);
    const { findings } = detectMilestoneTransitionBottleneckFindings(t, metricsFor(t), delayFindingsFor(t));
    expect(findings[0].evidenceRefs.some((e) => e.eventId === "apprEvt")).toBe(true);
  });

  it("empty delay findings → warning, empty bottlenecks (no crash)", () => {
    const t = transition([]);
    const { findings, warnings } = detectMilestoneTransitionBottleneckFindings(t, metricsFor(t), []);
    expect(findings).toEqual([]);
    expect(warnings.some((w) => w.code === "MISSING_DELAY_FINDINGS_FOR_BOTTLENECK_DETECTION")).toBe(true);
  });
});

describe("severity primitive", () => {
  it("repeated occurrences and long duration raise severity; unknown when unsized/unrepeated", () => {
    expect(determineAdvancedFindingSeverity({ durationMs: 20 * DAY, confidence: "high" })).toBe("critical");
    expect(determineAdvancedFindingSeverity({ durationMs: null, occurrenceCount: 1, confidence: "high" })).toBe("unknown");
    expect(determineAdvancedFindingSeverity({ durationMs: null, occurrenceCount: 3, confidence: "high" })).not.toBe("unknown");
  });
});

describe("constraint propagation (conservative, evidence-backed)", () => {
  it("detects propagation when a shared event links two transitions", () => {
    const up = transition([seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: null, isOpenEnded: true, evidence: [{ kind: "fact", eventId: "shared", confidence: "high" }], sourceEventId: "shared" })], { transitionId: "up", targetMilestoneId: "m2", completedAt: null });
    const down = transition([seg({ segmentId: "w", type: "waiting", startedAt: "2026-01-10T00:00:00.000Z", endedAt: null, isOpenEnded: true, evidence: [{ kind: "fact", eventId: "shared", confidence: "high" }], sourceEventId: "shared" })], { transitionId: "down", targetMilestoneId: "m3", completedAt: null });
    const findings = { up: delayFindingsFor(up), down: delayFindingsFor(down) };
    const { findings: props } = detectMilestoneConstraintPropagationFindings([up, down], { up: metricsFor(up), down: metricsFor(down) }, findings, SCOPE);
    expect(props.length).toBeGreaterThan(0);
    expect(props[0].originTransitionId).toBe("up");
    expect(props[0].affectedTransitionId).toBe("down");
    expect(props[0].evidenceRefs.some((e) => e.eventId === "shared")).toBe(true);
  });

  it("does NOT fabricate propagation without linkage", () => {
    const a = transition([seg({ segmentId: "x", type: "active_work", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-03T00:00:00.000Z", evidence: [{ kind: "fact", eventId: "ea", confidence: "high" }], sourceEventId: "ea" })], { transitionId: "a", targetMilestoneId: "m2" });
    const b = transition([seg({ segmentId: "y", type: "active_work", startedAt: "2026-01-04T00:00:00.000Z", endedAt: "2026-01-05T00:00:00.000Z", evidence: [{ kind: "fact", eventId: "eb", confidence: "high" }], sourceEventId: "eb" })], { transitionId: "b", targetMilestoneId: "m3" });
    const { findings } = detectMilestoneConstraintPropagationFindings([a, b], { a: metricsFor(a), b: metricsFor(b) }, { a: delayFindingsFor(a), b: delayFindingsFor(b) }, SCOPE);
    expect(findings).toEqual([]);
  });

  it("sequential unresolved constraint → possible / low confidence", () => {
    const up = transition([seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: null, isOpenEnded: true, evidence: [{ kind: "fact", eventId: "eup", confidence: "high" }], sourceEventId: "eup" })], { transitionId: "up", targetMilestoneId: "m2", completedAt: null });
    const down = transition([seg({ segmentId: "w", type: "waiting", startedAt: "2026-01-10T00:00:00.000Z", endedAt: null, isOpenEnded: true, evidence: [{ kind: "fact", eventId: "edown", confidence: "high" }], sourceEventId: "edown" })], { transitionId: "down", targetMilestoneId: "m3", completedAt: null });
    const { findings } = detectMilestoneConstraintPropagationFindings([up, down], { up: metricsFor(up), down: metricsFor(down) }, { up: delayFindingsFor(up), down: delayFindingsFor(down) }, SCOPE);
    const possible = findings.find((f) => f.status === "possible");
    expect(possible).toBeDefined();
    expect(possible!.confidence === "low" || possible!.confidence === "unknown").toBe(true);
  });

  it("determines propagation type from the origin finding", () => {
    expect(determineMilestonePropagationType({ findingType: "approval_delay" } as MilestoneFlowDetectionFinding)).toBe("approval");
    expect(determineMilestonePropagationType(undefined)).toBe("direct_dependency");
  });
});

describe("read-only + evidence + no Date.now", () => {
  it("dedups evidence", () => {
    const dup = { kind: "fact" as const, eventId: "same", confidence: "high" as const };
    expect(mergeAdvancedFindingEvidence([dup], [dup])).toHaveLength(1);
  });

  it("does not mutate transitions, metrics, or delay findings", () => {
    const t = transition([seg({ segmentId: "b", type: "blocked", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-12T00:00:00.000Z", closingEventId: "u" })]);
    const m = metricsFor(t);
    const df = delayFindingsFor(t);
    const tSnap = JSON.parse(JSON.stringify(t));
    const mSnap = JSON.parse(JSON.stringify(m));
    const dfSnap = JSON.parse(JSON.stringify(df));
    detectMilestoneFlowAdvancedFindings({ scope: SCOPE, transitions: [t], metricsByTransition: { tr1: m }, findingsByTransition: { tr1: df } });
    expect(t).toEqual(tSnap);
    expect(m).toEqual(mSnap);
    expect(df).toEqual(dfSnap);
  });

  it("advanced detector code never imports write-path / process tables / Date.now", () => {
    const dir = join(process.cwd(), "src/lib/milestone-flow");
    for (const f of ["advanced-detection.ts", "advanced-detection-shared.ts", "advanced-detection-types.ts", "rework-detector.ts", "bottleneck-detector.ts", "constraint-propagation-detector.ts"]) {
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
  const access = (): MilestoneFlowAccessContext => ({ userId: "u1", organizationId: ORG, scope: "pm", authorizedProjectIds: [PROJ] });
  const input = (ms: MilestoneFlowMilestoneRef[], ev: MilestoneFlowEventRef[]): MilestoneFlowInputContract => ({ scope: SCOPE, milestones: ms, events: ev, config: { configVersion: MPF_CONFIG_VERSION }, access: access() });
  const evt = (id: string, type: string, at: string, milestoneId?: string, subjectType = "task", subjectId = "s"): MilestoneFlowEventRef => ({ eventId: id, eventType: type, eventCategory: "t", occurredAt: at, subjectType, subjectId, fromState: null, toState: null, lifecycleClass: "BUSINESS_EVENT", confidence: 0.95, isCompensatingEvent: false, milestoneId: milestoneId ?? null });
  const fixedNow = () => new Date("2026-07-02T10:00:00.000Z");

  it("buildMilestoneFlowProjection includes advanced findings; health stays unknown", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const events = [
      evt("e-start", "TaskStarted", "2026-01-12T00:00:00.000Z", "m2"),
      evt("e-reopen", "TaskReopened", "2026-01-15T00:00:00.000Z", "m2"),
      evt("e-done", "MilestoneAchieved", "2026-01-30T00:00:00.000Z", undefined, "milestone", "m2"),
    ];
    const out = engine.buildMilestoneFlowProjection(input([M1, M2], events));
    expect(out.projection.reworkFindingsByTransition).toBeDefined();
    expect(out.projection.bottleneckFindingsByTransition).toBeDefined();
    expect(Array.isArray(out.projection.constraintPropagationFindings)).toBe(true);
    expect(typeof out.observability.reworkFindingCount).toBe("number");
    expect(Object.keys(out.projection.healthByTransition)).toHaveLength(0);
  });

  it("classifyTransitionHealth remains not implemented", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const t = transition([]);
    const m = engine.calculateFlowMetrics(t);
    expect(() => engine.classifyTransitionHealth(t, m)).toThrow(MpfUnsupportedOperationError);
  });

  it("empty input returns empty advanced findings", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const out = engine.buildMilestoneFlowProjection(input([], []));
    expect(out.projection.reworkFindingsByTransition).toEqual({});
    expect(out.projection.constraintPropagationFindings).toEqual([]);
  });
});
