import { describe, it, expect } from "vitest";
import { calculateTaskReadiness, type TaskReadinessContext } from "../readiness";

const baseTask = {
  id: "t1",
  title: "Install structured cabling",
  status: "not_started" as const,
  assigned_to: "user-1",
  assigned_resource_id: null,
  budget_item_id: "budget-1",
  estimated_labor_hours: 40,
};

const emptyCtx: TaskReadinessContext = {
  allTasks: [{ id: "t1", title: "Install structured cabling", status: "not_started" }],
  dependencies: [],
};

describe("calculateTaskReadiness", () => {
  it("is fully ready when nothing blocks the task", () => {
    const r = calculateTaskReadiness(baseTask, emptyCtx);
    expect(r.is_ready).toBe(true);
    expect(r.readiness_score).toBe(1);
    expect(r.blockers).toHaveLength(0);
  });

  it("blocks on incomplete predecessors", () => {
    const r = calculateTaskReadiness(baseTask, {
      allTasks: [
        { id: "t0", title: "Install cable trays", status: "in_progress" },
        { id: "t1", title: "Install structured cabling", status: "not_started" },
      ],
      dependencies: [{ predecessor_id: "t0", successor_id: "t1" }],
    });
    expect(r.is_ready).toBe(false);
    expect(r.blockers[0].type).toBe("predecessor");
    expect(r.blockers[0].message_i18n.es).toContain("Install cable trays");
    expect(r.readiness_score).toBe(0.75);
  });

  it("accepts done/tested predecessors", () => {
    const r = calculateTaskReadiness(baseTask, {
      allTasks: [
        { id: "t0", title: "Trays", status: "tested" },
        { id: "t1", title: "Cabling", status: "not_started" },
      ],
      dependencies: [{ predecessor_id: "t0", successor_id: "t1" }],
    });
    expect(r.is_ready).toBe(true);
  });

  it("blocks when the task has no owner or group", () => {
    const r = calculateTaskReadiness(
      { ...baseTask, assigned_to: null, assigned_resource_id: null },
      emptyCtx,
    );
    expect(r.is_ready).toBe(false);
    expect(r.blockers[0].type).toBe("assignment");
    expect(r.recommended_actions[0].blocker_type).toBe("assignment");
  });

  it("counts a resource_assignments row as ownership", () => {
    const r = calculateTaskReadiness(
      { ...baseTask, assigned_to: null },
      { ...emptyCtx, assignments: [{ id: "a1", task_id: "t1", resource_id: "crew-1" }] },
    );
    expect(r.blockers.find((b) => b.type === "assignment")).toBeUndefined();
  });

  it("blocks on undelivered required material but tolerates ordered material", () => {
    const blocked = calculateTaskReadiness(baseTask, {
      ...emptyCtx,
      materials: [
        { id: "m1", name: "HVAC unit", status: "delayed", required_by_task_id: "t1", required_by_date: null },
      ],
    });
    expect(blocked.is_ready).toBe(false);
    expect(blocked.blockers[0].type).toBe("material");
    expect(blocked.blockers[0].severity).toBe("high");

    const inFlight = calculateTaskReadiness(baseTask, {
      ...emptyCtx,
      materials: [
        { id: "m1", name: "HVAC unit", status: "ordered", required_by_task_id: "t1", required_by_date: null },
      ],
    });
    expect(inFlight.is_ready).toBe(true);
  });

  it("blocks on open RFIs and unapproved submittals", () => {
    const r = calculateTaskReadiness(baseTask, {
      ...emptyCtx,
      rfis: [{ id: "r1", subject: "Conflicto en plano E-201", status: "open", blocks_task_id: "t1" }],
      submittals: [
        { id: "s1", title: "Cable spec", status: "under_review", required_before_task_id: "t1" },
      ],
    });
    expect(r.is_ready).toBe(false);
    const types = r.blockers.map((b) => b.type).sort();
    expect(types).toEqual(["rfi", "submittal"]);
    expect(r.readiness_score).toBe(0.75); // 1 - 0.15 (rfi) - 0.10 (submittal)
  });

  it("flags unavailable assigned resources", () => {
    const r = calculateTaskReadiness(
      { ...baseTask, assigned_resource_id: "crew-1" },
      {
        ...emptyCtx,
        resources: [{ id: "crew-1", name: "Electrical Crew A", status: "unavailable" }],
      },
    );
    expect(r.is_ready).toBe(false);
    expect(r.blockers[0].type).toBe("resource_unavailable");
  });

  it("ignores blockers belonging to other tasks", () => {
    const r = calculateTaskReadiness(baseTask, {
      ...emptyCtx,
      rfis: [{ id: "r1", subject: "Otro", status: "open", blocks_task_id: "t99" }],
      materials: [
        { id: "m1", name: "Concrete", status: "unavailable", required_by_task_id: "t99", required_by_date: null },
      ],
    });
    expect(r.is_ready).toBe(true);
  });
});
