import { describe, it, expect } from "vitest";
import type { Milestone, RoadmapTask, TaskDependency } from "@/types/database";
import { buildProjectBriefing, type BriefingEngineInput } from "../briefing-engine";

// ── Minimal factories (only the fields the engine reads) ─────────────────────
function task(p: Partial<RoadmapTask>): RoadmapTask {
  return {
    id: Math.random().toString(36).slice(2),
    project_id: "proj-1",
    organization_id: "org-1",
    milestone_id: null,
    title: "Task",
    status: "not_started",
    priority: "p2",
    estimate_hours: 8,
    actual_hours: null,
    progress: 0,
    is_blocked: false,
    blocker_reason: null,
    is_critical: false,
    assigned_to: "user-1",
    assigned_resource_id: null,
    start_date: null,
    end_date: null,
    deleted_at: null,
    ...p,
  } as unknown as RoadmapTask;
}

function milestone(p: Partial<Milestone>): Milestone {
  return {
    id: Math.random().toString(36).slice(2),
    project_id: "proj-1",
    organization_id: "org-1",
    title: "Milestone",
    status: "planned",
    target_date: null,
    order_index: 0,
    progress_percent: 0,
    status_override_enabled: false,
    status_override_value: null,
    deleted_at: null,
    ...p,
  } as unknown as Milestone;
}

function dep(predecessor_id: string, successor_id: string): TaskDependency {
  return {
    id: `${predecessor_id}->${successor_id}`,
    organization_id: "org-1",
    project_id: "proj-1",
    predecessor_id,
    successor_id,
    dependency_type: "finish_to_start",
    lag_days: 0,
    created_at: "",
  };
}

const emptyMemory: BriefingEngineInput["memory"] = {
  recentDecisions: [],
  unresolvedActions: [],
  recentNotes: [],
  available: true,
};

function base(p: Partial<BriefingEngineInput>): BriefingEngineInput {
  return {
    projectId: "proj-1",
    projectName: "Mobile App Design",
    scope: "full",
    tasks: [],
    milestones: [],
    dependencies: [],
    risks: { open: 0, high: 0 },
    memory: emptyMemory,
    today: "2026-06-28",
    generatedAt: "2026-06-28T00:00:00.000Z",
    ...p,
  };
}

describe("buildProjectBriefing (REG-013)", () => {
  it("includes the project name and percent complete from tasks", () => {
    const b = buildProjectBriefing(
      base({ tasks: [task({ status: "done" }), task({ status: "in_progress", progress: 50 })] }),
    );
    expect(b.projectName).toBe("Mobile App Design");
    expect(b.overview.percentComplete).toBe(50); // 1 of 2 done
    expect(b.overview.totalTasks).toBe(2);
  });

  it("shows no active blockers when blockers = 0", () => {
    const b = buildProjectBriefing(base({ tasks: [task({ status: "in_progress", progress: 20 })] }));
    expect(b.execution.activeBlockers).toBe(0);
    expect(b.good).toContain("no_active_blockers");
    expect(b.attention.find((a) => a.key === "active_blockers")).toBeUndefined();
  });

  it("shows active blockers when a non-terminal task is blocked", () => {
    const b = buildProjectBriefing(base({ tasks: [task({ status: "blocked" })] }));
    expect(b.execution.activeBlockers).toBe(1);
    expect(b.attention.find((a) => a.key === "active_blockers")?.count).toBe(1);
    expect(b.recommended).toContain("review_blockers");
    expect(b.healthBand).toBe("at_risk");
  });

  it("never counts a completed task with a stale is_blocked flag as an active blocker", () => {
    const b = buildProjectBriefing(
      base({ tasks: [task({ status: "done", progress: 100, is_blocked: true })] }),
    );
    expect(b.execution.activeBlockers).toBe(0);
    expect(b.good).not.toContain("no_active_blockers"); // no ACTIVE tasks to assert over
    expect(b.dataGaps).toContain("capacity_not_evaluable");
  });

  it("reports waiting-on-dependency separately from blockers", () => {
    const pred = task({ id: "p", status: "in_progress", progress: 10 });
    const succ = task({ id: "s", status: "not_started" });
    const b = buildProjectBriefing(
      base({ tasks: [pred, succ], dependencies: [dep("p", "s")] }),
    );
    expect(b.execution.activeBlockers).toBe(0);
    expect(b.execution.waitingOnDependency).toBe(1);
    expect(b.attention.find((a) => a.key === "waiting_on_dependency")?.count).toBe(1);
  });

  it("surfaces capacity warnings (no owner / missing estimate)", () => {
    const b = buildProjectBriefing(
      base({
        tasks: [
          task({ status: "not_started", assigned_to: null, assigned_resource_id: null, estimate_hours: 0 }),
        ],
      }),
    );
    expect(b.capacity.unassignedActive).toBe(1);
    expect(b.capacity.missingEstimateActive).toBe(1);
    expect(b.attention.find((a) => a.key === "unassigned")?.count).toBe(1);
    expect(b.attention.find((a) => a.key === "missing_estimate")?.count).toBe(1);
    expect(b.recommended).toContain("assign_owners");
  });

  it("says capacity is not evaluable when there is no active work", () => {
    const b = buildProjectBriefing(base({ tasks: [task({ status: "done", progress: 100 })] }));
    expect(b.capacity.evaluable).toBe(false);
    expect(b.dataGaps).toContain("capacity_not_evaluable");
  });

  it("reports risks_unavailable when the risk source is null", () => {
    const b = buildProjectBriefing(base({ tasks: [task({ status: "in_progress", progress: 10 })], risks: null }));
    expect(b.risks.available).toBe(false);
    expect(b.dataGaps).toContain("risks_unavailable");
  });

  it("surfaces open high-impact risks when present", () => {
    const b = buildProjectBriefing(
      base({ tasks: [task({ status: "in_progress", progress: 10 })], risks: { open: 3, high: 2 } }),
    );
    expect(b.attention.find((a) => a.key === "open_high_risks")?.count).toBe(2);
    expect(b.recommended).toContain("review_open_risks");
    expect(b.healthBand).toBe("at_risk");
  });

  it("reports a stable project when nothing is flagged", () => {
    const b = buildProjectBriefing(
      base({
        tasks: [task({ status: "in_progress", progress: 40 }), task({ status: "done", progress: 100 })],
      }),
    );
    expect(b.attention.length).toBe(0);
    expect(b.healthBand).toBe("healthy");
    expect(b.good).toContain("no_active_blockers");
  });

  it("hides sensitive capacity/personnel detail for external scope", () => {
    const b = buildProjectBriefing(
      base({
        scope: "external",
        tasks: [task({ status: "not_started", assigned_to: null, assigned_resource_id: null, estimate_hours: 0 })],
        memory: { ...emptyMemory, unresolvedActions: [{ id: "a", title: "x", date: null, kind: "action" }] },
      }),
    );
    expect(b.capacity.unassignedActive).toBe(0);
    expect(b.attention.find((a) => a.key === "unassigned")).toBeUndefined();
    expect(b.attention.find((a) => a.key === "unresolved_actions")).toBeUndefined();
    expect(b.verify).not.toContain("resource_capacity");
    expect(b.recommended).not.toContain("assign_owners");
  });

  it("flags overdue active tasks and recommends review", () => {
    const b = buildProjectBriefing(
      base({ tasks: [task({ status: "in_progress", progress: 10, end_date: "2026-06-01" })] }),
    );
    expect(b.execution.overdue).toBe(1);
    expect(b.attention.find((a) => a.key === "overdue")?.count).toBe(1);
    expect(b.recommended).toContain("review_overdue");
  });

  it("derives a next milestone and counts at-risk milestones", () => {
    const m1 = milestone({ id: "m1", title: "Phase 1", order_index: 0 });
    const m2 = milestone({ id: "m2", title: "Phase 2", order_index: 1, target_date: "2026-07-01" });
    const b = buildProjectBriefing(
      base({
        milestones: [m1, m2],
        tasks: [task({ milestone_id: "m1", status: "blocked" })],
      }),
    );
    expect(b.overview.milestonesTotal).toBe(2);
    expect(b.execution.atRiskMilestones).toBeGreaterThanOrEqual(1);
    expect(b.overview.nextMilestone).not.toBeNull();
  });
});
