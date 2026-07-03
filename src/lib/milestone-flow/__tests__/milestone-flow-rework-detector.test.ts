// ============================================================================
// Phase 3 · Task 6A — Milestone Flow Rework Detector (standalone) guards
// ============================================================================
// Protects PEG-MPF-REWORK-DETECTION: the rework-only public API
// (detectMilestoneFlowReworkFindings) over Task 3 segments + Task 4 metrics —
// rework/trigger typing, open/resolved/partial status, duration READ from metrics
// (no Date.now), confidence capping, evidence dedup, read-only. Rework's deeper
// behavior is also covered by the advanced-detectors suite (PEG-MPF-ADVANCED-DETECTION);
// this suite pins the standalone entry point that Task 6A specifies.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  detectMilestoneFlowReworkFindings,
  validateMilestoneReworkDetectionInput,
  determineMilestoneReworkType,
  determineMilestoneReworkTriggerType,
  calculateMilestoneTransitionMetrics,
  MpfMissingProjectScopeError,
  MPF_CONFIG_VERSION,
  type BuiltMilestoneFlowSegment,
  type BuiltMilestoneTransition,
  type MilestoneFlowProjectScope,
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
const run = (t: BuiltMilestoneTransition) =>
  detectMilestoneFlowReworkFindings({ scope: SCOPE, transitions: [t], metricsByTransition: { [t.transitionId]: metricsFor(t) } });

describe("standalone rework detection entry point", () => {
  it("detects rework across all transitions and keys by transition", () => {
    const t = transition([seg({ segmentId: "r", type: "rework", semanticCategories: ["work"], startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-04T00:00:00.000Z" })]);
    const res = run(t);
    expect(res.reworkFindingsByTransition["tr1"]).toHaveLength(1);
    expect(res.findings[0].reworkType).toBe("task_reopened");
    expect(res.findings[0].triggerType).toBe("reopened_work");
    expect(res.findings[0].durationMs).toBe(2 * DAY); // read from Task 4 metrics
  });

  it("trigger type mirrors rework type", () => {
    expect(determineMilestoneReworkTriggerType(seg({ segmentId: "a", type: "rework", semanticCategories: ["approval"] }))).toBe("rejected_approval");
    expect(determineMilestoneReworkType(seg({ segmentId: "d", type: "rework", semanticCategories: ["decision"] }))).toBe("decision_reversal");
  });

  it("open rework stays open; closed rework resolves", () => {
    const open = run(transition([seg({ segmentId: "r", type: "rework", semanticCategories: ["work"], startedAt: "2026-01-02T00:00:00.000Z", endedAt: null, isOpenEnded: true })]));
    expect(open.findings[0].status).toBe("open");
    const closed = run(transition([seg({ segmentId: "r", type: "rework", semanticCategories: ["work"], startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-04T00:00:00.000Z", closingEventId: "c" })]));
    expect(closed.findings[0].status).toBe("resolved");
  });

  it("empty transitions return empty rework findings", () => {
    expect(run(transition([])).findings).toEqual([]);
  });

  it("does not mutate transitions or metrics", () => {
    const t = transition([seg({ segmentId: "r", type: "rework", semanticCategories: ["work"], startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-04T00:00:00.000Z" })]);
    const m = metricsFor(t);
    const tSnap = JSON.parse(JSON.stringify(t));
    const mSnap = JSON.parse(JSON.stringify(m));
    detectMilestoneFlowReworkFindings({ scope: SCOPE, transitions: [t], metricsByTransition: { tr1: m } });
    expect(t).toEqual(tSnap);
    expect(m).toEqual(mSnap);
  });

  it("validates input structurally", () => {
    expect(() =>
      validateMilestoneReworkDetectionInput({ scope: { organizationId: ORG } as never, transitions: [], metricsByTransition: {} }),
    ).toThrow(MpfMissingProjectScopeError);
  });
});
