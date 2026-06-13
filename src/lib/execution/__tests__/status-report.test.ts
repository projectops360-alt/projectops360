import { describe, it, expect } from "vitest";
import { buildStatusReport, type StatusReportInput } from "../status-report";

type Task = StatusReportInput["tasks"][number];

function task(id: string, status: string, milestoneId: string | null, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    status,
    milestone_id: milestoneId,
    start_date: null,
    end_date: null,
    assigned_to: "user-1",
    assigned_resource_id: null,
    blocker_reason: null,
    ...overrides,
  } as Task;
}

// Mirrors the real "Residential Perimeter Fence -Manual" project shape.
function fenceInput(): StatusReportInput {
  const milestones = [
    { id: "m1", title: "Planning, Site Review, and Permits", order_index: 0 },
    { id: "m2", title: "Procurement and Site Preparation", order_index: 1 },
    { id: "m3", title: "Foundation, Footing, and Structural Supports", order_index: 2 },
    { id: "m4", title: "Red Block Wall Construction", order_index: 3 },
    { id: "m5", title: "Electric Metal Gates", order_index: 4 },
    { id: "m6", title: "Final Review and Handover", order_index: 5 },
  ];
  const tasks: Task[] = [
    ...Array.from({ length: 5 }, (_, i) => task(`p1-${i}`, "done", "m1")),
    ...Array.from({ length: 5 }, (_, i) => task(`p2-${i}`, "done", "m2")),
    task("p3-0", "done", "m3"),
    task("p3-1", "done", "m3"),
    task("p3-2", "done", "m3"),
    task("p3-3", "blocked", "m3", { blocker_reason: "Se congeló en cemento, hay que esperar el sol" }),
    task("p3-4", "not_started", "m3"),
    ...Array.from({ length: 5 }, (_, i) => task(`p4-${i}`, "not_started", "m4")),
    task("p5-0", "not_started", "m5"),
  ];
  return {
    project: { title: "Residential Perimeter Fence -Manual", project_type: "general", start_date: "2026-06-12", target_end_date: "2026-06-30" },
    milestones,
    tasks,
    dependencies: [],
    peopleNames: {},
    resourceNames: {},
    materials: [
      { name: "Red masonry blocks", status: "required", quantity: null },
      { name: "Electric metal gates", status: "required", quantity: null },
    ],
    budgetItemCount: 0,
  };
}

describe("buildStatusReport", () => {
  it("computes overall completion from done tasks", () => {
    const r = buildStatusReport(fenceInput());
    expect(r.totalTasks).toBe(21);
    expect(r.doneTasks).toBe(13);
    expect(r.blockedTasks).toBe(1);
    expect(r.completionPct).toBe(62); // 13/21
  });

  it("derives phase states (completed / in_progress / upcoming)", () => {
    const r = buildStatusReport(fenceInput());
    const byTitle = Object.fromEntries(r.phases.map((p) => [p.title, p.state]));
    expect(byTitle["Planning, Site Review, and Permits"]).toBe("completed");
    expect(byTitle["Procurement and Site Preparation"]).toBe("completed");
    expect(byTitle["Foundation, Footing, and Structural Supports"]).toBe("in_progress");
    expect(byTitle["Red Block Wall Construction"]).toBe("upcoming");
  });

  it("picks the current phase and groups done/upcoming", () => {
    const r = buildStatusReport(fenceInput());
    expect(r.currentPhase?.title).toBe("Foundation, Footing, and Structural Supports");
    expect(r.donePhases.map((p) => p.title)).toEqual([
      "Planning, Site Review, and Permits",
      "Procurement and Site Preparation",
    ]);
    expect(r.upcomingPhases.some((p) => p.title === "Red Block Wall Construction")).toBe(true);
  });

  it("surfaces the blocked task with its reason as a high-severity attention item", () => {
    const r = buildStatusReport(fenceInput());
    const blocked = r.attention.find((a) => a.kind === "blocked");
    expect(blocked?.severity).toBe("high");
    expect(blocked?.message_i18n.es).toContain("congeló");
  });

  it("collects blockers (problems-first) with task, reason and phase", () => {
    const r = buildStatusReport(fenceInput());
    expect(r.blockers).toHaveLength(1);
    expect(r.blockers[0]).toMatchObject({
      taskTitle: "Task p3-3",
      phaseTitle: "Foundation, Footing, and Structural Supports",
    });
    expect(r.blockers[0].reason).toContain("congeló");
  });

  it("reports no blockers when nothing is on hold", () => {
    const input = fenceInput();
    input.tasks = input.tasks.map((t) => (t.status === "blocked" ? { ...t, status: "not_started", blocker_reason: null } : t));
    expect(buildStatusReport(input).blockers).toHaveLength(0);
  });

  it("flags missing dates, budget and material detail", () => {
    const r = buildStatusReport(fenceInput());
    const kinds = r.attention.map((a) => a.kind);
    expect(kinds).toContain("missing_dates");
    expect(kinds).toContain("missing_budget");
    expect(kinds).toContain("missing_material_detail");
    expect(r.hasDates).toBe(false);
    expect(r.hasBudget).toBe(false);
  });

  it("builds a bilingual headline mentioning the on-hold item", () => {
    const r = buildStatusReport(fenceInput());
    expect(r.headline_i18n.es).toContain("13 de 21");
    expect(r.headline_i18n.es?.toLowerCase()).toContain("pausa");
    expect(r.headline_i18n.en).toContain("13 of 21");
  });

  it("handles an empty project gracefully", () => {
    const r = buildStatusReport({
      project: { title: "Empty", project_type: "general", start_date: null, target_end_date: null },
      milestones: [],
      tasks: [],
      dependencies: [],
      peopleNames: {},
      resourceNames: {},
      materials: [],
      budgetItemCount: 0,
    });
    expect(r.completionPct).toBe(0);
    expect(r.headline_i18n.es).toContain("todavía no tiene tareas");
    expect(r.currentPhase).toBeNull();
    expect(r.dailyPlan.owners).toHaveLength(0);
  });
});

describe("buildStatusReport — daily plan", () => {
  it("groups actionable work by owner with the right action verbs", () => {
    const input = fenceInput();
    input.peopleNames = { "user-ana": "Ana", "user-luis": "Luis" };
    input.resourceNames = { "crew-mason": "Masonry Crew" };
    // assign owners + set statuses to exercise unblock/do_now/start/assign
    input.tasks = [
      { id: "t-block", title: "Pour footing", status: "blocked", milestone_id: "m3", start_date: null, end_date: null, assigned_to: "user-ana", assigned_resource_id: null, blocker_reason: "lack of resources" },
      { id: "t-prog", title: "Set rebar", status: "in_progress", milestone_id: "m3", start_date: null, end_date: null, assigned_to: "user-ana", assigned_resource_id: null, blocker_reason: null },
      { id: "t-ready", title: "Lay first course", status: "not_started", milestone_id: "m4", start_date: null, end_date: null, assigned_to: null, assigned_resource_id: "crew-mason", blocker_reason: null },
      { id: "t-unassigned", title: "Order gate", status: "not_started", milestone_id: "m5", start_date: null, end_date: null, assigned_to: null, assigned_resource_id: null, blocker_reason: null },
      { id: "t-waiting", title: "Install gate", status: "not_started", milestone_id: "m5", start_date: null, end_date: null, assigned_to: "user-luis", assigned_resource_id: null, blocker_reason: null },
    ] as typeof input.tasks;
    // t-waiting depends on t-unassigned which is not done → waiting, not listed
    input.dependencies = [
      { predecessor_id: "t-unassigned", successor_id: "t-waiting", dependency_type: "finish_to_start" },
    ];

    const plan = buildStatusReport(input).dailyPlan;
    const byOwner = Object.fromEntries(plan.owners.map((o) => [o.ownerName || o.ownerKind, o]));

    // Ana: unblock first, then continue
    expect(byOwner["Ana"].actions.map((a) => a.action)).toEqual(["unblock", "do_now"]);
    expect(byOwner["Ana"].actions[0].reason).toBe("lack of resources");
    // Crew (resource): start
    expect(byOwner["Masonry Crew"].ownerKind).toBe("resource");
    expect(byOwner["Masonry Crew"].actions[0].action).toBe("start");
    // Unassigned actionable task → "assign", bucket last
    expect(byOwner["unassigned"].actions[0].action).toBe("assign");
    expect(plan.owners[plan.owners.length - 1].ownerKind).toBe("unassigned");
    // t-waiting is counted as waiting, not listed for Luis
    expect(byOwner["Luis"]).toBeUndefined();
    expect(plan.waitingCount).toBe(1);
  });

  it("treats a finished predecessor as unblocking the successor", () => {
    const input = fenceInput();
    input.peopleNames = { "user-ana": "Ana" };
    input.tasks = [
      { id: "p", title: "Prep", status: "done", milestone_id: "m1", start_date: null, end_date: null, assigned_to: "user-ana", assigned_resource_id: null, blocker_reason: null },
      { id: "s", title: "Build", status: "not_started", milestone_id: "m1", start_date: null, end_date: null, assigned_to: "user-ana", assigned_resource_id: null, blocker_reason: null },
    ] as typeof input.tasks;
    input.dependencies = [{ predecessor_id: "p", successor_id: "s", dependency_type: "finish_to_start" }];
    const plan = buildStatusReport(input).dailyPlan;
    expect(plan.waitingCount).toBe(0);
    expect(plan.owners[0].actions[0].action).toBe("start");
  });
});
