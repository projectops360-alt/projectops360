import { describe, expect, it } from "vitest";
import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import type { IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence";
import type { IsabellaRootCauseAnalysis } from "@/lib/isabella/root-cause";
import type { IsabellaRecommendationPlan } from "@/lib/isabella/recommendations";
import {
  buildIsabellaReasoningTrace,
  governRecommendationPlan,
  governRootCauseAnalysis,
} from "..";

function packet(overrides: Partial<IsabellaEvidencePacket> = {}): IsabellaEvidencePacket {
  return {
    evidenceId: "blocker:e1",
    evidenceType: "blocker",
    sourceKind: "risk_decision_approval_blocker",
    sourceId: "task:t1",
    projectId: "p1",
    organizationId: "o1",
    title: "Blocked task",
    summary: "Explicit blocker recorded",
    citationLabel: "Recorded blocker",
    citationRef: "blocker:e1",
    confidence: "high",
    visibility: "project",
    ...overrides,
  };
}

function context(packets: IsabellaEvidencePacket[]): IsabellaProcessContext {
  return {
    scope: { organizationId: "o1", projectId: "p1", userId: "u1", locale: "en" },
    project: { projectId: "p1", name: "Project", citationRef: "project:p1" },
    snapshotAt: "2026-07-15T00:00:00Z",
    included: [],
    evidencePackets: packets,
    citations: [],
    limitations: [],
    status: "ready",
  };
}

function analysis(evidenceRefs: string[]): IsabellaRootCauseAnalysis {
  return {
    status: "ready",
    projectId: "p1",
    organizationId: "o1",
    snapshotAt: "2026-07-15T00:00:00Z",
    title: "Root Cause Analysis",
    summary: "Explicit blocker is the cause.",
    analysisScope: { projectId: "p1", source: "project" },
    findings: [{
      id: "f1",
      label: "Blocker",
      classification: "confirmed_cause",
      constraintType: "explicit_blocker",
      severity: "blocked",
      confidence: "high",
      explanation: "An explicit blocker prevents progress.",
      affectedEntities: [],
      evidenceRefs,
    }],
    constraints: [],
    symptoms: [],
    evidenceChains: [{ id: "chain:1", findingId: "f1", steps: [], conclusion: "Blocked" }],
    investigationGaps: [],
    recommendationHandoffHints: [{ reason: "Act", findingIds: ["f1"], evidenceRefs, allowedForRecommendationEngine: true }],
    confidence: "high",
    evidenceRefs,
    citations: [],
    limitations: [],
  };
}

function plan(evidenceRefs: string[]): IsabellaRecommendationPlan {
  return {
    status: "ready",
    projectId: "p1",
    organizationId: "o1",
    snapshotAt: "2026-07-15T00:00:00Z",
    title: "Recommendations",
    summary: "Resolve blocker",
    recommendations: [{
      id: "r1",
      title: "Resolve blocker",
      category: "resolve_explicit_blocker",
      priority: "critical",
      urgency: "now",
      effort: "low",
      expectedImpact: "unblock_execution",
      confidence: "high",
      rationale: "The explicit blocker prevents progress.",
      expectedOutcome: "Execution resumes.",
      affectedEntities: [],
      groupedCount: 1,
      sourceFindingIds: ["f1"],
      sourceConstraintIds: [],
      sourceEvidenceChainIds: ["chain:1"],
      evidenceRefs,
      humanApprovalRequired: true,
      executableNow: false,
    }],
    recommendationGroups: [{ label: "Now", priority: "critical", recommendations: ["r1"], reason: "Blocked" }],
    decisionSupport: {},
    evidenceRefs,
    citations: [],
    limitations: [],
  };
}

describe("P4-T2 governed reasoning pipeline", () => {
  it("accepts an explicit blocker fact and its advisory recommendation", () => {
    const source = packet();
    const root = analysis(["blocker:e1"]);
    const recommendation = plan(["blocker:e1"]);
    const trace = buildIsabellaReasoningTrace(context([source]), "recommendation", { analysis: root, plan: recommendation });
    expect(trace.acceptedFindingCount).toBe(2);
    expect(trace.withheldFindingCount).toBe(0);
    expect(governRecommendationPlan(recommendation, trace, "en").recommendations).toHaveLength(1);
  });

  it("withholds unsupported causes and removes their handoff", () => {
    const root = analysis([]);
    const trace = buildIsabellaReasoningTrace(context([]), "root_cause", { analysis: root });
    const governed = governRootCauseAnalysis(root, trace, "en");
    expect(governed.findings[0].classification).toBe("insufficient_evidence");
    expect(governed.evidenceChains).toEqual([]);
    expect(governed.recommendationHandoffHints).toEqual([]);
    expect(governed.summary).toMatch(/does not support asserting a cause/i);
  });

  it("rejects cross-project evidence", () => {
    const trace = buildIsabellaReasoningTrace(context([packet({ projectId: "other" })]), "root_cause", { analysis: analysis(["blocker:e1"]) });
    expect(trace.rejectedEvidenceCount).toBe(1);
    expect(trace.findings[0].status).toBe("withheld");
    expect(trace.limitations).toContain("cross_scope_evidence_rejected");
  });

  it("withholds inferences when one source conflicts with itself", () => {
    const trace = buildIsabellaReasoningTrace(
      context([packet(), packet({ evidenceId: "blocker:e2", citationRef: "blocker:e2", summary: "No blocker remains" })]),
      "root_cause",
      { analysis: analysis(["blocker:e1"]) },
    );
    expect(trace.conflicts).toHaveLength(1);
    expect(trace.findings[0]).toMatchObject({ status: "withheld", reason: "conflicting_evidence" });
  });

  it("filters recommendations whose evidence requirements are not met", () => {
    const recommendation = plan([]);
    const trace = buildIsabellaReasoningTrace(context([]), "recommendation", { plan: recommendation });
    const governed = governRecommendationPlan(recommendation, trace, "en");
    expect(governed.recommendations).toEqual([]);
    expect(governed.status).toBe("empty");
    expect(governed.summary).toMatch(/human review/i);
  });

  it("governs Process Mining aggregates as verified facts", () => {
    const source = packet({
      evidenceId: "event:e1",
      evidenceType: "event_summary",
      sourceKind: "project_event_graph",
      sourceId: "event:e1",
      citationRef: "event:e1",
      confidence: "verified",
    });
    const processContext = context([source]);
    processContext.processMiningContext = {
      status: "ready",
      eventCount: 10,
      caseCount: 2,
      taskEventCount: 10,
      milestoneEventCount: 0,
      dependencyEventCount: 0,
      transitionCount: 4,
      directFollowCount: 3,
      variantCount: 2,
      temporallyMeasuredCaseCount: 2,
      unknownActivityCount: 0,
      delayFindingCount: 0,
      blockerFindingCount: 0,
      reworkFindingCount: 0,
      bottleneckFindingCount: 0,
      dataQualityFlagCount: 0,
      firstOccurredAt: null,
      lastOccurredAt: null,
      eventsTruncated: false,
      integrityValid: true,
      integrityIssueCount: 0,
    };
    const trace = buildIsabellaReasoningTrace(processContext, "process_mining_summary", {});
    expect(trace.findings[0]).toMatchObject({ status: "accepted", claimType: "factual_project_data", confidence: "verified" });
  });
});
