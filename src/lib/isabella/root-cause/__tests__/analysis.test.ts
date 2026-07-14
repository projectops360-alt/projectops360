// ============================================================================
// ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE — signals/classification/format
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  assembleRootCauseAnalysis,
  classifyConstraintSignals,
  classifyRootCauseFindings,
  buildEvidenceChains,
  formatRootCauseAnalysisForIsabella,
} from "@/lib/isabella/root-cause";
import type { IsabellaProcessContext, IsabellaTaskContext, IsabellaTaskSummary } from "@/lib/isabella/process-context/types";
import type { IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence/types";

function packet(o: Partial<IsabellaEvidencePacket> = {}): IsabellaEvidencePacket {
  return { evidenceId: "e1", evidenceType: "blocker", sourceKind: "risk_decision_approval_blocker", sourceId: "task:t1", projectId: "p1", organizationId: "org1", title: "QA", summary: "Blocked: env down", citationLabel: "Recorded blocker", citationRef: "blocker:t1", confidence: "high", visibility: "project", ...o };
}
function task(o: Partial<IsabellaTaskSummary> = {}): IsabellaTaskSummary {
  return { taskId: o.taskId ?? "t", title: o.title ?? "Task", status: o.status ?? "not_started", priority: "p2", milestoneId: o.milestoneId ?? "m1", milestoneTitle: "Phase 5", ownerId: o.ownerId ?? null, ownerName: null, dueDate: o.dueDate ?? null, parentTaskId: null, isSubtask: false, blockedReason: o.blockedReason ?? null, updatedAt: null, citationRef: `task:${o.taskId ?? "t"}` };
}
function tctx(o: Partial<IsabellaTaskContext> = {}): IsabellaTaskContext {
  return { totalVisibleTasks: o.totalVisibleTasks ?? 0, tasks: o.tasks ?? [], subtasks: [], byStatus: o.byStatus ?? {}, byPriority: {}, withoutMilestoneCount: o.withoutMilestoneCount ?? 0, withoutOwnerCount: o.withoutOwnerCount ?? 0, overdueCount: o.overdueCount ?? 0, blockedCount: o.blockedCount ?? 0 };
}
function ctx(o: Partial<IsabellaProcessContext> = {}): IsabellaProcessContext {
  return { scope: { projectId: "p1", organizationId: "org1", userId: "u1", locale: "es" }, project: { projectId: "p1", name: "Tower A", citationRef: "project:p1" }, snapshotAt: "2026-07-15T00:00:00Z", included: ["project", "tasks", "milestones", "blockers"], evidencePackets: o.evidencePackets ?? [], citations: o.citations ?? [], taskContext: o.taskContext, milestoneContext: o.milestoneContext, processSignals: o.processSignals, limitations: o.limitations ?? [], status: o.status ?? "ready", message: o.message };
}

describe("access / states", () => {
  it("missing/unauthorized/unavailable/empty → unavailable confidence, no findings", () => {
    for (const status of ["missing_context", "unauthorized", "unavailable", "empty"] as const) {
      const a = assembleRootCauseAnalysis(ctx({ status, message: "m" }), undefined, undefined, "es");
      expect(a.status).toBe(status);
      expect(a.confidence).toBe("unavailable");
      expect(a.findings).toHaveLength(0);
    }
  });
});

describe("constraint taxonomy / signals", () => {
  it("explicit blockers → explicit_blocker; no invented decision/approval/dependency", () => {
    const cs = classifyConstraintSignals(ctx({ processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [packet()] } }), "en");
    const types = cs.map((c) => c.type);
    expect(types).toContain("explicit_blocker");
    expect(types).toContain("evidence_gap"); // advanced findings unavailable
    expect(types).not.toContain("decision_delay");
    expect(types).not.toContain("approval_delay");
    expect(types).not.toContain("dependency_constraint");
  });
  it("owner/milestone/overdue gaps map to their constraint types", () => {
    const cs = classifyConstraintSignals(ctx({ taskContext: tctx({ totalVisibleTasks: 4, withoutOwnerCount: 2, withoutMilestoneCount: 1, overdueCount: 1, tasks: [task({ taskId: "a", dueDate: "2026-07-01" })] }) }), "en");
    const types = cs.map((c) => c.type);
    expect(types).toEqual(expect.arrayContaining(["ownership_gap", "milestone_assignment_gap", "overdue_constraint"]));
  });
  it("maps advanced Process Mining findings without claiming confirmed causality", () => {
    const context = ctx({
      evidencePackets: [
        packet({ evidenceId: "delay:1", evidenceType: "delay_finding", sourceKind: "milestone_process_flow", citationRef: "delay:1", confidence: "medium" }),
        packet({ evidenceId: "rework:1", evidenceType: "rework_finding", sourceKind: "milestone_process_flow", citationRef: "rework:1", confidence: "medium" }),
        packet({ evidenceId: "bottleneck:1", evidenceType: "bottleneck_finding", sourceKind: "milestone_process_flow", citationRef: "bottleneck:1", confidence: "medium" }),
      ],
      processSignals: {
        blockedCount: 0, advancedFindingsAvailable: true, packets: [], transitionCount: 3,
        delayFindingCount: 1, reworkFindingCount: 1, bottleneckFindingCount: 1,
      },
    });
    const constraints = classifyConstraintSignals(context, "en");
    expect(constraints.map((constraint) => constraint.type)).toEqual(expect.arrayContaining([
      "process_delay", "rework_signal", "bottleneck_signal",
    ]));
    const findings = classifyRootCauseFindings(context, constraints, "en")
      .filter((finding) => ["process_delay", "rework_signal", "bottleneck_signal"].includes(finding.constraintType));
    expect(findings).toHaveLength(3);
    expect(findings.every((finding) => finding.classification === "possible_cause")).toBe(true);
    expect(findings.every((finding) => finding.evidenceRefs.length > 0)).toBe(true);
  });
});

describe("classification (conservative)", () => {
  it("explicit blocker → confirmed_cause (high); multiple signals → ownership likely_cause", () => {
    const context = ctx({ processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [packet()] }, taskContext: tctx({ totalVisibleTasks: 4, blockedCount: 1, withoutOwnerCount: 2 }) });
    const findings = classifyRootCauseFindings(context, classifyConstraintSignals(context, "en"), "en");
    const blocker = findings.find((f) => f.constraintType === "explicit_blocker")!;
    expect(blocker.classification).toBe("confirmed_cause");
    expect(blocker.confidence).toBe("high");
    const owner = findings.find((f) => f.constraintType === "ownership_gap")!;
    expect(owner.classification).toBe("likely_cause"); // blocker present → multiple signals
  });
  it("single weak signal → possible_cause", () => {
    const context = ctx({ taskContext: tctx({ totalVisibleTasks: 3, withoutMilestoneCount: 1, byStatus: { in_progress: 3 } }) });
    const owner = classifyRootCauseFindings(context, classifyConstraintSignals(context, "en"), "en").find((f) => f.constraintType === "milestone_assignment_gap")!;
    expect(owner.classification).toBe("possible_cause");
  });
  it("symptom without evidenced cause → insufficient_evidence", () => {
    const context = ctx({ taskContext: tctx({ totalVisibleTasks: 3, byStatus: { not_started: 3 }, tasks: [task({ taskId: "a", ownerId: "u1", status: "not_started" })] }) });
    const findings = classifyRootCauseFindings(context, classifyConstraintSignals(context, "en"), "en");
    expect(findings[0].classification).toBe("insufficient_evidence");
    expect(findings[0].confidence).toBe("unknown");
  });
  it("partial context caps confidence to medium", () => {
    const context = ctx({ status: "partial", processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [packet()] }, taskContext: tctx({ totalVisibleTasks: 2, blockedCount: 1 }) });
    const blocker = classifyRootCauseFindings(context, classifyConstraintSignals(context, "en"), "en").find((f) => f.constraintType === "explicit_blocker")!;
    expect(["medium", "low", "unknown", "unavailable"]).toContain(blocker.confidence);
    expect(blocker.confidence).not.toBe("high");
  });
});

describe("evidence chains + findings shape", () => {
  const context = ctx({ processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [packet()] }, taskContext: tctx({ totalVisibleTasks: 3, blockedCount: 1, tasks: [task({ taskId: "a", blockedReason: "env down" })] }) });
  it("every finding has an evidence chain whose conclusion matches its classification", () => {
    const findings = classifyRootCauseFindings(context, classifyConstraintSignals(context, "en"), "en");
    const chains = buildEvidenceChains(findings, "en");
    expect(chains).toHaveLength(findings.length);
    const blocker = findings.find((f) => f.constraintType === "explicit_blocker")!;
    const chain = chains.find((c) => c.findingId === blocker.id)!;
    expect(chain.steps.some((st) => st.kind === "signal")).toBe(true);
    expect(chain.steps.some((st) => st.kind === "evidence")).toBe(true);
    expect(chain.conclusion).toMatch(/Confirmed cause/);
  });
  it("findings include severity, affected entities and evidenceRefs", () => {
    const blocker = classifyRootCauseFindings(context, classifyConstraintSignals(context, "en"), "en").find((f) => f.constraintType === "explicit_blocker")!;
    expect(blocker.severity).toBe("blocked");
    expect(blocker.affectedEntities.length).toBeGreaterThan(0);
    expect(blocker.evidenceRefs.length).toBeGreaterThan(0);
  });
});

describe("formatter", () => {
  it("labels classifications, confidence and states recommendations are the next engine", () => {
    const a = assembleRootCauseAnalysis(ctx({ processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [packet()] }, taskContext: tctx({ totalVisibleTasks: 2, blockedCount: 1 }) }), undefined, undefined, "es");
    const text = formatRootCauseAnalysisForIsabella(a, "es");
    expect(text).toContain("Análisis de causa raíz");
    expect(text).toContain("Causa confirmada");
    expect(text).toMatch(/las recomendaciones se generarán en el siguiente motor/i);
    expect(text).toContain("Fuente: datos verificados del proyecto actual.");
  });
});
