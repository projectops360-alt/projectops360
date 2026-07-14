// ============================================================================
// ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE — health / sections / states / format
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  assembleDailyDiagnosis,
  evaluateDailyHealth,
  formatDailyDiagnosisForIsabella,
  buildNextEngineHints,
} from "@/lib/isabella/daily-diagnosis";
import type {
  IsabellaProcessContext,
  IsabellaTaskContext,
  IsabellaTaskSummary,
  IsabellaMilestoneContext,
} from "@/lib/isabella/process-context/types";
import type { IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence/types";

function packet(o: Partial<IsabellaEvidencePacket> = {}): IsabellaEvidencePacket {
  return {
    evidenceId: o.evidenceId ?? "e1", evidenceType: o.evidenceType ?? "blocker", sourceKind: "risk_decision_approval_blocker",
    sourceId: "s1", projectId: "p1", organizationId: "org1", title: o.title ?? "Blocked task", summary: o.summary ?? "Blocked: waiting",
    citationLabel: "Recorded blocker", citationRef: o.citationRef ?? "blocker:t1", confidence: "high", visibility: "project", ...o,
  };
}
function task(o: Partial<IsabellaTaskSummary> = {}): IsabellaTaskSummary {
  return {
    taskId: o.taskId ?? "t", title: o.title ?? "Task", status: o.status ?? "not_started", priority: o.priority ?? "p2",
    milestoneId: o.milestoneId ?? null, milestoneTitle: o.milestoneTitle ?? null, ownerId: o.ownerId ?? null, ownerName: o.ownerName ?? null,
    dueDate: o.dueDate ?? null, parentTaskId: null, isSubtask: false, blockedReason: o.blockedReason ?? null, updatedAt: null,
    citationRef: `task:${o.taskId ?? "t"}`,
  };
}
function tctx(o: Partial<IsabellaTaskContext> = {}): IsabellaTaskContext {
  return {
    totalVisibleTasks: o.totalVisibleTasks ?? 0, tasks: o.tasks ?? [], subtasks: [],
    byStatus: o.byStatus ?? {}, byPriority: o.byPriority ?? {},
    withoutMilestoneCount: o.withoutMilestoneCount ?? 0, withoutOwnerCount: o.withoutOwnerCount ?? 0,
    overdueCount: o.overdueCount ?? 0, blockedCount: o.blockedCount ?? 0,
  };
}
function ctx(o: Partial<IsabellaProcessContext> = {}): IsabellaProcessContext {
  return {
    scope: o.scope ?? { projectId: "p1", organizationId: "org1", userId: "u1", locale: "es" },
    project: o.project ?? { projectId: "p1", name: "Tower A", citationRef: "project:p1" },
    snapshotAt: o.snapshotAt ?? "2026-07-15T00:00:00Z",
    included: ["project", "tasks", "milestones", "blockers"],
    evidencePackets: o.evidencePackets ?? [],
    citations: o.citations ?? [],
    taskContext: o.taskContext,
    milestoneContext: o.milestoneContext,
    processSignals: o.processSignals,
    limitations: o.limitations ?? [],
    status: o.status ?? "ready",
    message: o.message,
  };
}

describe("access / state diagnoses", () => {
  it("missing_context / unauthorized / unavailable → unknown health, honest message", () => {
    for (const status of ["missing_context", "unauthorized", "unavailable"] as const) {
      const d = assembleDailyDiagnosis(ctx({ status, message: "msg" }), "es");
      expect(d.status).toBe(status);
      expect(d.overallHealth.level).toBe("unknown");
      expect(d.overallHealth.confidence).toBe("unavailable");
      expect(d.metrics).toEqual({});
    }
  });
  it("empty project → unknown health with limitations", () => {
    const d = assembleDailyDiagnosis(ctx({ status: "empty", message: "no data" }), "en");
    expect(d.status).toBe("empty");
    expect(d.overallHealth.level).toBe("unknown");
  });
});

describe("evidence-backed health classification (conservative)", () => {
  const evid = [packet({ evidenceType: "task", citationRef: "task:1" })];
  it("healthy: progressing, no blockers/overdue/gaps", () => {
    const h = evaluateDailyHealth(ctx({ evidencePackets: evid, taskContext: tctx({ totalVisibleTasks: 4, byStatus: { done: 2, in_progress: 2 } }) }));
    expect(h.level).toBe("healthy");
    expect(h.confidence).toBe("verified");
    expect(h.evidenceRefs.length).toBeGreaterThan(0);
    expect(h.rationale).toBeTruthy();
  });
  it("watch: some attention signal (no owner) but no blocked/overdue", () => {
    const h = evaluateDailyHealth(ctx({ taskContext: tctx({ totalVisibleTasks: 3, byStatus: { in_progress: 3 }, withoutOwnerCount: 2 }) }));
    expect(h.level).toBe("watch");
  });
  it("at_risk: overdue tasks", () => {
    const h = evaluateDailyHealth(ctx({ taskContext: tctx({ totalVisibleTasks: 3, byStatus: { in_progress: 3 }, overdueCount: 1 }) }));
    expect(h.level).toBe("at_risk");
  });
  it("blocked: blockers at/above threshold", () => {
    const h = evaluateDailyHealth(ctx({ taskContext: tctx({ totalVisibleTasks: 5, blockedCount: 3 }) }));
    expect(h.level).toBe("blocked");
  });
  it("unknown: no task data", () => {
    expect(evaluateDailyHealth(ctx({ taskContext: tctx({ totalVisibleTasks: 0 }) })).level).toBe("unknown");
  });
});

describe("sections + metrics", () => {
  const context = ctx({
    evidencePackets: [packet({ evidenceType: "task", citationRef: "task:1" }), packet({ evidenceType: "blocker", citationRef: "blocker:t1" })],
    taskContext: tctx({
      totalVisibleTasks: 6, byStatus: { done: 2, in_progress: 1, not_started: 3 },
      withoutMilestoneCount: 1, withoutOwnerCount: 2, overdueCount: 1, blockedCount: 1,
      tasks: [task({ taskId: "a", milestoneId: "m1", blockedReason: "waiting" }), task({ taskId: "b", milestoneId: "m1", status: "not_started", dueDate: "2026-07-01" })],
    }),
    milestoneContext: { totalVisibleMilestones: 1, milestones: [{ milestoneId: "m1", title: "Phase 5", status: "in_progress", progress: 40, orderIndex: 1, taskCount: 2, citationRef: "milestone:m1" }] } as IsabellaMilestoneContext,
    processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [packet({ evidenceType: "blocker", title: "QA", summary: "Blocked: env down", citationRef: "blocker:t1" })] },
  });

  it("progress section summarizes done/in-progress/not-started", () => {
    const d = assembleDailyDiagnosis(context, "en");
    expect(d.sections.progress.summary).toMatch(/2 done/);
    expect(d.metrics).toMatchObject({ totalTasks: 6, doneTasks: 2, inProgressTasks: 1, notStartedTasks: 3, blockedTasks: 1, overdueTasks: 1, withoutOwnerTasks: 2, withoutMilestoneTasks: 1 });
  });
  it("blockers section uses only blocker evidence + flags root-cause boundary", () => {
    const d = assembleDailyDiagnosis(context, "en");
    expect(d.sections.blockers.status).toBe("blocked");
    expect(d.sections.blockers.items[0].detail).toMatch(/env down/);
    expect((d.sections.blockers.limitations ?? []).join(" ")).toMatch(/root-cause/i);
  });
  it("risks/attention flags overdue + no owner + no milestone", () => {
    const d = assembleDailyDiagnosis(context, "en");
    const labels = d.sections.risksOrAttention.items.map((i) => i.label).join("|");
    expect(labels).toMatch(/Overdue/);
    expect(labels).toMatch(/without owner/i);
    expect(labels).toMatch(/without milestone/i);
  });
  it("milestone focus surfaces the milestone with blocked/overdue tasks", () => {
    const d = assembleDailyDiagnosis(context, "en");
    expect(d.sections.milestoneFocus.items[0].label).toBe("Phase 5");
  });
  it("execution gaps lists unassigned + no-milestone", () => {
    const d = assembleDailyDiagnosis(context, "en");
    expect(d.sections.executionGaps.items.length).toBeGreaterThanOrEqual(2);
  });
  it("today focus = focus areas (not recommendations)", () => {
    const d = assembleDailyDiagnosis(context, "en");
    expect(d.sections.todayFocus.items.length).toBeGreaterThan(0);
    expect((d.sections.todayFocus.limitations ?? []).join(" ")).toMatch(/recommendation engine/i);
  });
  it("surfaces delay, rework, and bottleneck findings as derived attention signals", () => {
    const processContext = ctx({
      evidencePackets: [
        packet({ evidenceId: "delay:1", evidenceType: "delay_finding", sourceKind: "milestone_process_flow", citationRef: "delay:1" }),
        packet({ evidenceId: "rework:1", evidenceType: "rework_finding", sourceKind: "milestone_process_flow", citationRef: "rework:1" }),
        packet({ evidenceId: "bottleneck:1", evidenceType: "bottleneck_finding", sourceKind: "milestone_process_flow", citationRef: "bottleneck:1" }),
      ],
      taskContext: tctx({ totalVisibleTasks: 1, byStatus: { in_progress: 1 } }),
      processSignals: {
        blockedCount: 0, advancedFindingsAvailable: true, packets: [], transitionCount: 3,
        delayFindingCount: 1, reworkFindingCount: 1, bottleneckFindingCount: 1,
      },
    });
    const diagnosis = assembleDailyDiagnosis(processContext, "en");
    const labels = diagnosis.sections.risksOrAttention.items.map((item) => item.label).join("|");
    expect(labels).toMatch(/Process delay findings/);
    expect(labels).toMatch(/Rework findings/);
    expect(labels).toMatch(/Bottleneck candidates/);
    expect(diagnosis.sections.risksOrAttention.items.every((item) => item.confidence !== "verified")).toBe(true);
    expect(diagnosis.metrics).toMatchObject({ processTransitionCount: 3, delayFindingCount: 1, reworkFindingCount: 1, bottleneckFindingCount: 1 });
  });
  it("next-engine hints hand off symptoms to root-cause / recommendation", () => {
    const hints = buildNextEngineHints(context);
    expect(hints.some((h) => h.engine === "root_cause")).toBe(true);
    expect(hints.some((h) => h.engine === "recommendation")).toBe(true);
  });
});

describe("formatter", () => {
  it("renders status + summary + verified-data source in Spanish", () => {
    const context = ctx({ taskContext: tctx({ totalVisibleTasks: 3, byStatus: { in_progress: 3 }, blockedCount: 3 }), evidencePackets: [packet()] });
    const text = formatDailyDiagnosisForIsabella(assembleDailyDiagnosis(context, "es"), "es");
    expect(text).toContain("Diagnóstico diario del proyecto");
    expect(text).toContain("Estado: Bloqueado");
    expect(text).toContain("Fuente: datos verificados del proyecto actual.");
  });
});
