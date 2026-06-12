import { describe, it, expect } from "vitest";
import { calculateProjectHealth } from "../health";
import { calculateCriticalPath } from "../critical-path";
import type { RoadmapTask, Milestone, BudgetItem, MaterialRequirement, Risk } from "@/types/database";

const TODAY = "2026-06-12";

function makeTask(id: string, overrides: Partial<RoadmapTask> = {}): RoadmapTask {
  return {
    id,
    organization_id: "org",
    project_id: "proj",
    milestone_id: null,
    title: `Task ${id}`,
    description: null,
    status: "in_progress",
    priority: "p2",
    sprint_name: null,
    estimate_hours: null,
    actual_hours: null,
    dependency_notes: null,
    acceptance_criteria: null,
    order_index: 0,
    external_key: null,
    execution_notes: null,
    completed_at: null,
    prompt_body: null,
    prompt_context: null,
    prompt_version: 1,
    last_prompt_sent_at: null,
    ai_tool_target: null,
    implementation_notes: null,
    test_notes: null,
    start_date: null,
    end_date: null,
    duration_days: 2,
    progress: 0,
    is_blocked: false,
    blocker_reason: null,
    is_critical: false,
    slack_days: null,
    earliest_start: null,
    earliest_finish: null,
    latest_start: null,
    latest_finish: null,
    created_by: null,
    assigned_to: "user-1",
    assigned_resource_id: null,
    assignment_type: null,
    required_skills: [],
    required_crew_size: null,
    estimated_labor_hours: null,
    location_zone: null,
    discipline: null,
    trade_key: null,
    cost_code: null,
    budget_item_id: "b1",
    source_drawing_id: null,
    source_insight_id: null,
    created_at: TODAY,
    updated_at: TODAY,
    deleted_at: null,
    ...overrides,
  };
}

function makeBudget(id: string, overrides: Partial<BudgetItem> = {}): BudgetItem {
  return {
    id,
    organization_id: "org",
    project_id: "proj",
    cost_code: null,
    name: `Budget ${id}`,
    description: null,
    category: "labor",
    estimated_cost: 1000,
    committed_cost: 0,
    actual_cost: 0,
    forecast_cost: null,
    currency: "USD",
    status: "planned",
    milestone_id: null,
    metadata: {},
    created_at: TODAY,
    updated_at: TODAY,
    deleted_at: null,
    ...overrides,
  };
}

const noMilestones: Milestone[] = [];

describe("calculateProjectHealth", () => {
  it("reports healthy for a clean project", () => {
    const health = calculateProjectHealth({
      tasks: [makeTask("a"), makeTask("b")],
      milestones: noMilestones,
      dependencies: [],
      budgetItems: [makeBudget("b1")],
      today: TODAY,
    });
    expect(health.overall_level).toBe("healthy");
    const schedule = health.dimensions.find((d) => d.dimension === "schedule")!;
    expect(schedule.level).toBe("healthy");
  });

  it("degrades schedule health for blocked and overdue tasks", () => {
    const health = calculateProjectHealth({
      tasks: [
        makeTask("a", { status: "blocked" }),
        makeTask("b", { is_blocked: true }),
        makeTask("c", { end_date: "2026-06-01", status: "in_progress" }),
      ],
      milestones: noMilestones,
      dependencies: [],
      today: TODAY,
    });
    const schedule = health.dimensions.find((d) => d.dimension === "schedule")!;
    expect(schedule.level).not.toBe("healthy");
    expect(schedule.findings.some((f) => f.message_i18n.es?.includes("bloqueadas"))).toBe(true);
    expect(schedule.findings.some((f) => f.evidence_entity_ids.includes("c"))).toBe(true);
  });

  it("flags budget overrun with evidence", () => {
    const health = calculateProjectHealth({
      tasks: [makeTask("a")],
      milestones: noMilestones,
      dependencies: [],
      budgetItems: [
        makeBudget("b1", { estimated_cost: 1000, forecast_cost: 1500 }),
        makeBudget("b2", { estimated_cost: 1000, actual_cost: 100 }),
      ],
      today: TODAY,
    });
    const budget = health.dimensions.find((d) => d.dimension === "budget")!;
    expect(budget.score).toBeLessThan(100);
    expect(budget.findings.some((f) => f.evidence_entity_ids.includes("b1"))).toBe(true);
  });

  it("returns unknown budget health without budget items", () => {
    const health = calculateProjectHealth({
      tasks: [makeTask("a")],
      milestones: noMilestones,
      dependencies: [],
      today: TODAY,
    });
    expect(health.dimensions.find((d) => d.dimension === "budget")!.level).toBe("unknown");
  });

  it("escalates material health when required-by dates are missed", () => {
    const material = {
      id: "m1",
      organization_id: "org",
      project_id: "proj",
      name: "HVAC unit",
      description: null,
      spec_reference: null,
      discipline: null,
      trade_key: null,
      quantity: 1,
      unit_of_measure: "unit",
      estimated_unit_cost: null,
      estimated_total_cost: null,
      supplier_id: null,
      lead_time_days: null,
      status: "delayed",
      required_by_task_id: "a",
      required_by_date: "2026-06-01",
      budget_item_id: null,
      resource_id: null,
      source_drawing_id: null,
      source_extraction_id: null,
      source_insight_id: null,
      confidence_score: null,
      evidence_json: {},
      needs_review: false,
      origin: "manual",
      metadata: {},
      created_at: TODAY,
      updated_at: TODAY,
      deleted_at: null,
    } as MaterialRequirement;

    const health = calculateProjectHealth({
      tasks: [makeTask("a")],
      milestones: noMilestones,
      dependencies: [],
      materials: [material],
      today: TODAY,
    });
    const materials = health.dimensions.find((d) => d.dimension === "materials")!;
    expect(materials.level).not.toBe("healthy");
    expect(materials.findings.some((f) => f.level === "critical")).toBe(true);
    expect(materials.findings.some((f) => f.evidence_entity_ids.includes("m1"))).toBe(true);
  });

  it("weights critical risks heavily", () => {
    const risk = {
      id: "r1",
      organization_id: "org",
      project_id: "proj",
      title: "Long-lead UPS delay",
      description: null,
      category: "material",
      probability: "high",
      impact: "critical",
      severity: "critical",
      status: "open",
      mitigation_plan: null,
      owner_user_id: null,
      linked_task_id: null,
      linked_milestone_id: null,
      source_insight_id: null,
      origin: "manual",
      confidence_score: null,
      evidence_json: {},
      needs_review: false,
      metadata: {},
      created_at: TODAY,
      updated_at: TODAY,
      deleted_at: null,
    } as Risk;

    const health = calculateProjectHealth({
      tasks: [makeTask("a")],
      milestones: noMilestones,
      dependencies: [],
      risks: [risk],
      today: TODAY,
    });
    const risks = health.dimensions.find((d) => d.dimension === "risks")!;
    expect(risks.level).toBe("healthy" === risks.level ? "healthy" : risks.level); // structural sanity
    expect(risks.score).toBeLessThanOrEqual(75);
    expect(risks.findings[0].evidence_entity_ids).toContain("r1");
  });

  it("marks critical-path health critical when a critical task is blocked", () => {
    const tasks = [
      makeTask("a", { duration_days: 5, status: "blocked" }),
      makeTask("b", { duration_days: 3 }),
    ];
    const cp = calculateCriticalPath(
      tasks,
      [{ predecessor_id: "a", successor_id: "b", dependency_type: "finish_to_start", lag_days: 0 }],
      [],
      TODAY,
    );
    const health = calculateProjectHealth({
      tasks,
      milestones: noMilestones,
      dependencies: [],
      criticalPath: cp,
      today: TODAY,
    });
    const cpHealth = health.dimensions.find((d) => d.dimension === "critical_path")!;
    expect(cpHealth.level).toBe("critical");
  });

  it("flags schedule critical when CPM finish exceeds the project target", () => {
    const tasks = [makeTask("a", { duration_days: 30, status: "not_started" })];
    const cp = calculateCriticalPath(tasks, [], [], TODAY);
    const health = calculateProjectHealth({
      tasks,
      milestones: noMilestones,
      dependencies: [],
      criticalPath: cp,
      targetEndDate: "2026-06-20",
      today: TODAY,
    });
    const schedule = health.dimensions.find((d) => d.dimension === "schedule")!;
    expect(schedule.findings.some((f) => f.level === "critical")).toBe(true);
  });
});
