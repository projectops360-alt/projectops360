// ============================================================================
// Phase 3 · Task 7 — Transition Health & Isabella Evidence Packets guards
// ============================================================================
// Protects PEG-MPF-TRANSITION-HEALTH-ISABELLA-EVIDENCE: conservative health
// classification across every status; machine reason codes; confidence capping +
// unknown on weak evidence; explicit uncertainty; Isabella packets with
// facts(require evidence)/inferences/predictions(never facts)/recommendations
// (categories only)/uncertainties + allowed/disallowed claim guardrails; a
// fallback dependency bottleneck is never confirmed causal; NO LLM, NO Date.now,
// NO UI, read-only; engine populates health + packets; classifyTransitionHealth
// no longer throws.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyMilestoneTransitionHealth,
  classifySingleMilestoneTransitionHealth,
  determineMilestoneTransitionHealthStatus,
  determineMilestoneTransitionHealthReasonCodes,
  determineMilestoneTransitionHealthConfidence,
  determineMilestoneRecommendedActionCategory,
  buildIsabellaMilestoneFlowEvidencePacket,
  buildAllowedAndDisallowedIsabellaClaims,
  buildIsabellaMilestoneFlowFacts,
  createMilestoneProcessFlowEngine,
  MPF_CONFIG_VERSION,
  type BuiltMilestoneTransition,
  type BuiltMilestoneFlowSegment,
  type MilestoneFlowDetectionFinding,
  type MilestoneFlowReworkFinding,
  type MilestoneFlowBottleneckFinding,
  type MilestoneFlowHealthMetricsView,
  type MilestoneTransitionHealthClassificationInput,
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
    transitionId: "tr1", startedAt: "2026-01-02T00:00:00.000Z", endedAt: "2026-01-04T00:00:00.000Z", durationMs: null, frictionType: null,
    evidence: [{ kind: "fact", eventId: "e-" + o.segmentId, confidence: "high" }], sourceEventId: "e-" + o.segmentId, closingEventId: null,
    semanticCategories: [], confidence: "high", notes: "", isOpenEnded: false, ...o,
  };
}
function transition(o: Partial<BuiltMilestoneTransition> = {}): BuiltMilestoneTransition {
  return {
    transitionId: "tr1", scope: SCOPE, sourceMilestoneId: "m1", targetMilestoneId: "m2",
    startedAt: "2026-01-01T00:00:00.000Z", completedAt: "2026-02-01T00:00:00.000Z",
    state: { status: "completed", currentSegmentType: null, isBlocked: false, lastEventAt: null },
    segments: [seg({ segmentId: "a", type: "active_work" })], evidenceEventIds: [], orderedEventIds: [], confidence: "high",
    createdByEngineVersion: "v", configVersion: MPF_CONFIG_VERSION, ...o,
  };
}
const goodMetrics: MilestoneFlowHealthMetricsView = { efficiency: { flowEfficiencyRatio: 0.95 }, totalKnownSegmentTimeMs: 10 * DAY, timeBuckets: { unknownTimeMs: 0 }, confidence: "high" };

function delayFinding(o: Partial<MilestoneFlowDetectionFinding> & { findingType: MilestoneFlowDetectionFinding["findingType"] }): MilestoneFlowDetectionFinding {
  return {
    findingId: "f-" + o.findingType, transitionId: "tr1", projectId: PROJ, organizationId: ORG,
    status: "resolved", severity: "low", confidence: "high",
    startedAt: null, endedAt: null, durationMs: DAY, isOpen: false, sourceSegmentIds: ["a"], sourceEventIds: ["ev"],
    evidenceRefs: [{ kind: "fact", eventId: "ev", confidence: "high" }], metricRefs: [], semanticCategories: [], calculationNotes: [], warnings: [], ...o,
  };
}
function reworkFinding(o: Partial<MilestoneFlowReworkFinding> = {}): MilestoneFlowReworkFinding {
  return {
    findingId: "rw", transitionId: "tr1", projectId: PROJ, organizationId: ORG, status: "resolved", severity: "medium", confidence: "high",
    startedAt: null, endedAt: null, durationMs: 2 * DAY, isOpen: false, reworkType: "task_reopened", triggerType: "reopened_work",
    sourceSegmentIds: ["r"], sourceEventIds: ["ev"], evidenceRefs: [{ kind: "fact", eventId: "ev", confidence: "high" }],
    metricRefs: [], semanticCategories: [], affectedEntityRefs: [], calculationNotes: [], warnings: [], ...o,
  };
}
function bottleneckFinding(o: Partial<MilestoneFlowBottleneckFinding> = {}): MilestoneFlowBottleneckFinding {
  return {
    findingId: "bn", transitionId: "tr1", projectId: PROJ, organizationId: ORG, bottleneckType: "decision", status: "resolved",
    severity: "high", confidence: "high", durationMs: 8 * DAY, occurrenceCount: 2, affectedSegmentIds: ["a"], affectedFindingIds: ["f"],
    sourceEventIds: ["ev"], evidenceRefs: [{ kind: "fact", eventId: "ev", confidence: "high" }], metricRefs: [], candidateReason: "repeated_occurrence",
    isStructuralCandidate: true, calculationNotes: [], warnings: [], ...o,
  };
}
const input = (o: Partial<MilestoneTransitionHealthClassificationInput> = {}): MilestoneTransitionHealthClassificationInput =>
  ({ scope: SCOPE, transition: transition(), metrics: goodMetrics, ...o });

describe("health status ladder (conservative)", () => {
  it("healthy — completed, no friction, good efficiency", () => {
    expect(determineMilestoneTransitionHealthStatus(input())).toBe("healthy");
  });
  it("blocked — open blocker", () => {
    expect(determineMilestoneTransitionHealthStatus(input({ delayFindings: [delayFinding({ findingType: "blocker", status: "open", isOpen: true, severity: "medium", durationMs: null })] }))).toBe("blocked");
  });
  it("regressed — milestone regression rework", () => {
    expect(determineMilestoneTransitionHealthStatus(input({ reworkFindings: [reworkFinding({ reworkType: "milestone_regression" })] }))).toBe("regressed");
  });
  it("at_risk — structural bottleneck / high-severity delay", () => {
    expect(determineMilestoneTransitionHealthStatus(input({ bottleneckFindings: [bottleneckFinding()] }))).toBe("at_risk");
    expect(determineMilestoneTransitionHealthStatus(input({ delayFindings: [delayFinding({ findingType: "approval_delay", severity: "critical", durationMs: 10 * DAY })] }))).toBe("at_risk");
  });
  it("degraded — material friction (rework)", () => {
    expect(determineMilestoneTransitionHealthStatus(input({ reworkFindings: [reworkFinding({ severity: "medium" })] }))).toBe("degraded");
  });
  it("recovering — resolved blocker on a completed transition", () => {
    expect(determineMilestoneTransitionHealthStatus(input({ delayFindings: [delayFinding({ findingType: "blocker", status: "resolved", isOpen: false })] }))).toBe("recovering");
  });
  it("watch — minor resolved decision delay", () => {
    expect(determineMilestoneTransitionHealthStatus(input({ transition: transition({ completedAt: null, state: { status: "active", currentSegmentType: null, isBlocked: false, lastEventAt: null } }), delayFindings: [delayFinding({ findingType: "decision_delay", status: "resolved", severity: "low" })] }))).toBe("watch");
  });
  it("unknown — no metrics and no segments", () => {
    expect(determineMilestoneTransitionHealthStatus(input({ transition: transition({ segments: [] }), metrics: undefined }))).toBe("unknown");
  });
});

describe("reason codes + recommended action", () => {
  it("emits machine reason codes", () => {
    const codes = determineMilestoneTransitionHealthReasonCodes(input({ delayFindings: [delayFinding({ findingType: "blocker", status: "open", isOpen: true })] }));
    expect(codes).toContain("blocker_open");
    expect(determineMilestoneTransitionHealthReasonCodes(input())).toContain("no_material_friction");
    expect(determineMilestoneTransitionHealthReasonCodes(input({ transition: transition({ segments: [] }), metrics: undefined }))).toEqual(["insufficient_evidence"]);
  });
  it("maps status to an action category (not prose)", () => {
    expect(determineMilestoneRecommendedActionCategory("blocked")).toBe("resolve_blocker");
    expect(determineMilestoneRecommendedActionCategory("healthy")).toBe("none");
    expect(determineMilestoneRecommendedActionCategory("unknown")).toBe("gather_evidence");
  });
});

describe("confidence + uncertainty (conservative)", () => {
  it("unknown when no evidence/metrics", () => {
    expect(determineMilestoneTransitionHealthConfidence(input({ transition: transition({ segments: [] }), metrics: undefined }))).toBe("unknown");
  });
  it("capped low when a fallback dependency bottleneck (ambiguous cause) is present", () => {
    const s = classifySingleMilestoneTransitionHealth(input({ bottleneckFindings: [bottleneckFinding({ bottleneckType: "dependency", confidence: "medium" })] }));
    expect(["low", "unknown"]).toContain(s.confidence);
    expect(s.uncertaintyNotes).toContain("ambiguous_blocker_cause");
  });
  it("capped by weak/backfilled evidence", () => {
    const s = classifySingleMilestoneTransitionHealth(input({ delayFindings: [delayFinding({ findingType: "approval_delay", confidence: "low", evidenceRefs: [{ kind: "fact", eventId: "bf", confidence: "low" }] })] }));
    expect(s.confidence).not.toBe("high");
  });
  it("health status is not derived from health vocabulary of severity", () => {
    const s = classifySingleMilestoneTransitionHealth(input());
    expect(["healthy", "watch", "degraded", "blocked", "at_risk", "recovering", "regressed", "unknown"]).toContain(s.healthStatus);
  });
});

describe("Isabella evidence packets", () => {
  it("facts require evidence refs; predictions are never facts; recommendations are categories", () => {
    const s = classifySingleMilestoneTransitionHealth(input({ delayFindings: [delayFinding({ findingType: "blocker", status: "open", isOpen: true, durationMs: null })] }));
    const p = buildIsabellaMilestoneFlowEvidencePacket(s);
    expect(p.facts.every((f) => f.eventId != null || f.metricRef != null)).toBe(true);
    expect(p.predictions.every((pr) => pr.kind === "prediction")).toBe(true);
    expect(p.recommendations.every((r) => r.kind === "recommendation" && /recommended_action:/.test(r.note ?? ""))).toBe(true);
    expect(p.explanationFrame.fact).toEqual(p.facts);
  });
  it("facts are only evidence-backed refs", () => {
    const facts = buildIsabellaMilestoneFlowFacts(classifySingleMilestoneTransitionHealth(input()));
    expect(facts.every((f) => f.eventId != null || f.metricRef != null)).toBe(true);
  });
  it("allowed claims are evidence-supported; disallowed blocks causal/predictive claims", () => {
    const s = classifySingleMilestoneTransitionHealth(input({ bottleneckFindings: [bottleneckFinding({ bottleneckType: "dependency", confidence: "medium" })] }));
    const { allowedClaims, disallowedClaims } = buildAllowedAndDisallowedIsabellaClaims(s);
    expect(allowedClaims).toContain(`health_status:${s.healthStatus}`);
    expect(disallowedClaims).toContain("confirmed_root_cause");
    expect(disallowedClaims).toContain("guaranteed_milestone_slip");
    // Fallback dependency bottleneck must never be a confirmed cause.
    expect(disallowedClaims).toContain("blocker_cause_is_dependency_confirmed");
  });
  it("unknown health disallows any health conclusion", () => {
    const s = classifySingleMilestoneTransitionHealth(input({ transition: transition({ segments: [] }), metrics: undefined }));
    expect(buildAllowedAndDisallowedIsabellaClaims(s).disallowedClaims).toContain("any_health_conclusion");
  });
});

describe("read-only + no LLM + no Date.now", () => {
  it("does not mutate inputs", () => {
    const t = transition();
    const df = [delayFinding({ findingType: "blocker", status: "open", isOpen: true })];
    const snap = JSON.parse(JSON.stringify({ t, df }));
    classifyMilestoneTransitionHealth({ scope: SCOPE, transitions: [t], metricsByTransition: {}, findingsByTransition: { tr1: df } });
    expect({ t, df }).toEqual(snap);
  });
  it("health/Isabella code imports no LLM/AI, no write-path, no process tables, no Date.now", () => {
    const dir = join(process.cwd(), "src/lib/milestone-flow");
    for (const f of ["transition-health-classifier.ts", "transition-health-types.ts", "isabella-evidence-packet-builder.ts", "isabella-evidence-packet-types.ts"]) {
      const src = readFileSync(join(dir, f), "utf8");
      const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
      expect(code).not.toMatch(/openai|anthropic|@ai-sdk|generateText|fetch\(/i);
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
  const projInput = (ms: MilestoneFlowMilestoneRef[], ev: MilestoneFlowEventRef[]): MilestoneFlowInputContract => ({ scope: SCOPE, milestones: ms, events: ev, config: { configVersion: MPF_CONFIG_VERSION }, access: access() });
  const evt = (id: string, type: string, at: string, milestoneId?: string, subjectType = "task", subjectId = "s"): MilestoneFlowEventRef => ({ eventId: id, eventType: type, eventCategory: "t", occurredAt: at, subjectType, subjectId, fromState: null, toState: null, lifecycleClass: "BUSINESS_EVENT", confidence: 0.95, isCompensatingEvent: false, milestoneId: milestoneId ?? null });
  const fixedNow = () => new Date("2026-07-02T10:00:00.000Z");

  it("buildMilestoneFlowProjection populates health + Isabella packets; classifyTransitionHealth no longer throws", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const events = [
      evt("e-start", "TaskStarted", "2026-01-12T00:00:00.000Z", "m2"),
      evt("e-block", "TaskBlocked", "2026-01-15T00:00:00.000Z", "m2"),
      evt("e-done", "MilestoneAchieved", "2026-01-30T00:00:00.000Z", undefined, "milestone", "m2"),
    ];
    const out = engine.buildMilestoneFlowProjection(projInput([M1, M2], events));
    const trId = out.projection.transitions[0].transitionId;
    expect(out.projection.healthByTransition[trId]).toBeDefined();
    expect(out.projection.healthSummariesByTransition![trId]).toBeDefined();
    expect(out.projection.isabellaEvidencePacketsByTransition![trId]).toBeDefined();
    expect(out.observability.healthAssessmentCount).toBe(1);
    // classifyTransitionHealth delegates (no throw).
    const t = out.projection.transitions[0];
    const m = engine.calculateFlowMetrics(t);
    expect(() => engine.classifyTransitionHealth(t, m)).not.toThrow();
    expect(engine.classifyTransitionHealth(t, m).status).toBeDefined();
  });

  it("empty input returns empty health + packets", () => {
    const engine = createMilestoneProcessFlowEngine({ now: fixedNow });
    const out = engine.buildMilestoneFlowProjection(projInput([], []));
    expect(out.projection.healthByTransition).toEqual({});
    expect(out.projection.isabellaEvidencePacketsByTransition).toEqual({});
  });
});
