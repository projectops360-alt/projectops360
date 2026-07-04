// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL — pure builders
// ============================================================================
// Evidence/citation sanitization + claim rules; task/milestone/signal context
// counts and evidence claim support. No DB, no LLM.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  buildIsabellaCitation,
  buildIsabellaEvidencePacket,
  sanitizeText,
  safeRef,
} from "@/lib/isabella/process-context/evidence-builder";
import {
  buildTaskContext,
  buildTaskEvidence,
  mapTaskRowsToSummaries,
  type SubtaskLite,
} from "@/lib/isabella/process-context/task-evidence";
import { buildMilestoneContext, buildMilestoneEvidence } from "@/lib/isabella/process-context/milestone-evidence";
import { buildProcessSignals } from "@/lib/isabella/process-context/process-signals";
import { canEvidenceSupportClaim } from "@/lib/isabella/process-intelligence/claim-policy";
import type { TaskReportRow } from "@/lib/isabella/task-report";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";

const SCOPE: IsabellaProjectScope = { projectId: "p1", organizationId: "org1", userId: "u1", locale: "es" };

let seq = 0;
function row(o: Partial<TaskReportRow> = {}): TaskReportRow {
  seq += 1;
  return {
    id: o.id ?? `t${seq}`, title: o.title ?? `Task ${seq}`, status: o.status ?? "not_started",
    milestoneId: o.milestoneId ?? null, milestoneTitle: o.milestoneTitle ?? null, priority: o.priority ?? "p2",
    ownerId: o.ownerId ?? null, ownerName: o.ownerName ?? null, dueDate: o.dueDate ?? null,
    updatedAt: o.updatedAt ?? "2026-07-01T00:00:00Z", createdAt: o.createdAt ?? "2026-07-01T00:00:00Z",
    isBlocked: o.isBlocked ?? false, blockerReason: o.blockerReason ?? null, isSubtask: false,
  };
}

describe("evidence + citation builders", () => {
  it("sanitizes text (collapses whitespace, caps length) and never carries a raw payload", () => {
    expect(sanitizeText("a\n\n  b\tc")).toBe("a b c");
    expect(sanitizeText("x".repeat(1000)).length).toBeLessThanOrEqual(500);
  });
  it("builds a packet with scope + claims and no `payload` field", () => {
    const p = buildIsabellaEvidencePacket({
      evidenceId: "e1", evidenceType: "task", sourceKind: "deterministic_project_data", sourceId: "task:1",
      projectId: "p1", organizationId: "org1", title: "T", summary: "Status: done", citationLabel: "Workboard task",
      confidence: "verified", allowedClaims: ["factual_project_data"], disallowedClaims: ["root_cause_claim"],
    });
    expect(p.projectId).toBe("p1");
    expect(p.confidence).toBe("verified");
    expect("payload" in p).toBe(false);
  });
  it("rejects an invalid evidence type", () => {
    expect(() => buildIsabellaEvidencePacket({
      // @ts-expect-error invalid on purpose
      evidenceType: "ssn", evidenceId: "e", sourceKind: "deterministic_project_data", sourceId: "x",
      projectId: "p1", organizationId: "org1", title: "T", summary: "s", citationLabel: "L", confidence: "verified",
    })).toThrow();
  });
  it("citation is safe (safeRef, no raw JSON)", () => {
    const c = buildIsabellaCitation({ sourceLabel: "Workboard task", entityType: "task", entityTitle: "Zoning", safeRef: safeRef("task", "abc"), confidence: "verified" });
    expect(c.safeRef).toBe("task:abc");
  });
});

describe("buildTaskContext — aggregate counts", () => {
  const tasks = [
    row({ status: "done", priority: "p1", milestoneId: "m1", ownerId: "u1" }),
    row({ status: "in_progress", priority: "p1", milestoneId: null, ownerId: null }),
    row({ status: "in_progress", priority: "p2", milestoneId: null, ownerId: null, isBlocked: true, blockerReason: "waiting" }),
    row({ status: "not_started", priority: "p3", milestoneId: "m1", ownerId: null, dueDate: "2026-07-01" }),
  ];
  const ctx = buildTaskContext(tasks, [], "2026-07-15");

  it("counts by status/priority + without-milestone/owner + overdue + blocked", () => {
    expect(ctx.totalVisibleTasks).toBe(4);
    expect(ctx.byStatus.in_progress).toBe(2);
    expect(ctx.byPriority.p1).toBe(2);
    expect(ctx.withoutMilestoneCount).toBe(2);
    expect(ctx.withoutOwnerCount).toBe(3);
    expect(ctx.blockedCount).toBe(1);
    expect(ctx.overdueCount).toBe(1); // dueDate 2026-07-01 < asOf 2026-07-15, not terminal
  });
});

describe("buildTaskEvidence — verified, claim support", () => {
  it("task evidence supports factual/status but NOT root_cause by default", () => {
    const summaries = mapTaskRowsToSummaries([row({ title: "Alpha", status: "done" })]);
    const { packets, citations } = buildTaskEvidence(summaries, SCOPE);
    expect(packets[0].confidence).toBe("verified");
    expect(citations[0].entityType).toBe("task");
    expect(canEvidenceSupportClaim("factual_project_data", packets).ok).toBe(true);
    expect(canEvidenceSupportClaim("status_summary", packets).ok).toBe(true);
    expect(canEvidenceSupportClaim("root_cause_claim", packets).ok).toBe(false);
  });

  it("maps subtasks with parentTaskId + isSubtask", () => {
    const subs: SubtaskLite[] = [{ id: "s1", task_id: "t1", title: "S", status: "in_progress", priority: "p2", owner_id: null, due_date: null, blocked_reason: null, updated_at: null }];
    const ctx = buildTaskContext([], subs, "2026-07-15");
    expect(ctx.subtasks[0]).toMatchObject({ taskId: "s1", parentTaskId: "t1", isSubtask: true, citationRef: "subtask:s1" });
  });
});

describe("milestone evidence — no dependency claim", () => {
  it("sorts by order, carries taskCount, and disallows dependency/blocker/root-cause", () => {
    const ctx = buildMilestoneContext(
      [
        { id: "m2", title: "Build", status: "planned", progress_percent: 0, order_index: 2 },
        { id: "m1", title: "Design", status: "in_progress", progress_percent: 40, order_index: 1 },
      ],
      { m1: 3 },
    );
    expect(ctx.milestones.map((m) => m.title)).toEqual(["Design", "Build"]);
    expect(ctx.milestones[0].taskCount).toBe(3);
    const { packets } = buildMilestoneEvidence(ctx.milestones, SCOPE);
    expect(canEvidenceSupportClaim("dependency_claim", packets).ok).toBe(false);
    expect(canEvidenceSupportClaim("factual_project_data", packets).ok).toBe(true);
  });
});

describe("process signals — record-backed blockers only", () => {
  it("builds blocker evidence from blocked tasks; advanced findings unavailable", () => {
    const summaries = mapTaskRowsToSummaries([
      row({ title: "A", blockerReason: "waiting on sign-off" }),
      row({ title: "B" }),
    ]);
    const sig = buildProcessSignals(summaries, SCOPE);
    expect(sig.blockedCount).toBe(1);
    expect(sig.advancedFindingsAvailable).toBe(false);
    expect(canEvidenceSupportClaim("blocker_claim", sig.packets).ok).toBe(true);
    expect(canEvidenceSupportClaim("root_cause_claim", sig.packets).ok).toBe(false);
  });
});
