import { describe, it, expect } from "vitest";
import type { Milestone, RoadmapTask } from "@/types/database";
import { buildPortfolioBriefing, type PortfolioEngineInput } from "../portfolio-engine";

function task(p: Partial<RoadmapTask>): RoadmapTask {
  return {
    id: Math.random().toString(36).slice(2),
    project_id: "p1",
    organization_id: "org-1",
    milestone_id: null,
    title: "Task",
    status: "not_started",
    priority: "p2",
    estimate_hours: 8,
    progress: 0,
    is_blocked: false,
    is_critical: false,
    assigned_to: "u1",
    assigned_resource_id: null,
    end_date: null,
    deleted_at: null,
    ...p,
  } as unknown as RoadmapTask;
}

function base(p: Partial<PortfolioEngineInput>): PortfolioEngineInput {
  return {
    projects: [{ id: "p1", name: "Mobile App Design", status: "active" }],
    tasks: [],
    milestones: [],
    risks: [],
    pendingDecisions: [],
    today: "2026-06-28",
    generatedAt: "2026-06-28T00:00:00.000Z",
    ...p,
  };
}

describe("buildPortfolioBriefing (PMO)", () => {
  it("reports a stable portfolio when nothing is flagged", () => {
    const b = buildPortfolioBriefing(base({ tasks: [task({ status: "in_progress", progress: 30 })] }));
    expect(b.attention.length).toBe(0);
    expect(b.healthBand).toBe("healthy");
    expect(b.good).toContain("no_active_blockers");
    expect(b.topProjects.length).toBe(0);
  });

  it("aggregates active blockers across projects and never counts completed stale flags", () => {
    const b = buildPortfolioBriefing(
      base({
        projects: [
          { id: "p1", name: "A", status: "active" },
          { id: "p2", name: "B", status: "active" },
        ],
        tasks: [
          task({ project_id: "p1", status: "blocked" }),
          task({ project_id: "p2", status: "done", progress: 100, is_blocked: true }), // stale → ignored
        ],
      }),
    );
    expect(b.overview.activeBlockers).toBe(1);
    expect(b.attention.find((a) => a.key === "active_blockers")?.count).toBe(1);
    expect(b.healthBand).toBe("at_risk");
  });

  it("ranks projects needing attention with drill-in data", () => {
    const b = buildPortfolioBriefing(
      base({
        projects: [
          { id: "p1", name: "A", status: "active" },
          { id: "p2", name: "B", status: "active" },
        ],
        tasks: [
          task({ project_id: "p1", status: "blocked", is_critical: true }),
          task({ project_id: "p1", status: "in_progress", progress: 10, end_date: "2026-01-01" }),
          task({ project_id: "p2", status: "in_progress", progress: 50 }),
        ],
      }),
    );
    expect(b.overview.projectsNeedingAttention).toBe(1);
    expect(b.topProjects[0].projectId).toBe("p1");
    expect(b.topProjects[0].activeBlockers).toBe(1);
    expect(b.overview.blockedCritical).toBe(1);
    expect(b.recommended).toContain("review_blocked_critical");
  });

  it("surfaces high-impact open risks and pending decisions", () => {
    const b = buildPortfolioBriefing(
      base({
        tasks: [task({ status: "in_progress", progress: 10 })],
        risks: [{ project_id: "p1", severity: "high", status: "open" }],
        pendingDecisions: [{ project_id: "p1", impact_area: "budget" }],
      }),
    );
    expect(b.attention.find((a) => a.key === "high_risks")?.count).toBe(1);
    expect(b.attention.find((a) => a.key === "pending_decisions")?.count).toBe(1);
    expect(b.recommended).toContain("review_high_risks");
  });

  it("reports risks_unavailable when the source is null", () => {
    const b = buildPortfolioBriefing(base({ tasks: [task({ status: "in_progress", progress: 10 })], risks: null }));
    expect(b.dataGaps).toContain("risks_unavailable");
    expect(b.good).not.toContain("no_high_risks");
  });

  it("handles an empty portfolio honestly", () => {
    const b = buildPortfolioBriefing(base({ projects: [], tasks: [] }));
    expect(b.dataGaps).toContain("no_projects");
    expect(b.dataGaps).toContain("no_active_work");
    expect(b.healthBand).toBe("watch");
  });

  it("flags overdue and unassigned active work as watch when no severe issues", () => {
    const b = buildPortfolioBriefing(
      base({
        tasks: [
          task({ status: "in_progress", progress: 10, end_date: "2026-01-01" }),
          task({ status: "not_started", assigned_to: null, assigned_resource_id: null }),
        ],
      }),
    );
    expect(b.overview.overdue).toBe(1);
    expect(b.overview.unassigned).toBe(1);
    expect(b.healthBand).toBe("watch");
    expect(b.recommended).toContain("assign_owners");
  });
});
