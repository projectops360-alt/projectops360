import { describe, it, expect } from "vitest";
import { validateCanonicalImport, findCycle, generateImportRecommendations } from "../validate";
import { emptyCanonicalImport } from "../extract";
import type { CanonicalImport, CanonicalTask } from "@/types/import-intelligence";

function task(sourceId: string, overrides: Partial<CanonicalTask> = {}): CanonicalTask {
  return {
    source_id: sourceId,
    name: `Task ${sourceId}`,
    description: "",
    phase: "",
    milestone: "",
    status: "not_started",
    priority: "p2",
    planned_start: "",
    planned_finish: "2026-08-01",
    duration_days: 3,
    estimated_hours: null,
    assigned_to: "Someone",
    required_materials: [],
    cost_code: "",
    location: "",
    discipline: "",
    trade: "",
    confidence_score: 0.8,
    source_reference: "test",
    ...overrides,
  };
}

function base(): CanonicalImport {
  const c = emptyCanonicalImport();
  c.project.name = "Test";
  return c;
}

describe("validateCanonicalImport", () => {
  it("flags missing owners and durations as needs_review", () => {
    const c = base();
    c.tasks = [task("1", { assigned_to: "", duration_days: null, planned_finish: "" })];
    const report = validateCanonicalImport(c);
    const status = report.entityStatuses.get("task:1")!;
    expect(status.status).toBe("needs_review");
    expect(status.warnings).toContain("missing_owner");
    expect(status.warnings).toContain("missing_duration");
    expect(report.findings.some((f) => f.validation_type === "missing_owners")).toBe(true);
  });

  it("marks nameless tasks invalid and duplicate names as duplicates", () => {
    const c = base();
    c.tasks = [task("1", { name: "" }), task("2", { name: "Same" }), task("3", { name: "same" })];
    const report = validateCanonicalImport(c);
    expect(report.entityStatuses.get("task:1")!.status).toBe("invalid");
    expect(report.entityStatuses.get("task:3")!.status).toBe("duplicate");
  });

  it("raises a blocker for circular dependencies", () => {
    const c = base();
    c.tasks = [task("a"), task("b")];
    c.dependencies = [
      { predecessor_source_id: "a", successor_source_id: "b", dependency_type: "finish_to_start", lag_days: 0, inferred: false, confidence_score: 0.9, source_reference: "t" },
      { predecessor_source_id: "b", successor_source_id: "a", dependency_type: "finish_to_start", lag_days: 0, inferred: false, confidence_score: 0.9, source_reference: "t" },
    ];
    const report = validateCanonicalImport(c);
    expect(report.hasBlockers).toBe(true);
    expect(report.criticalPathReady).toBe(false);
  });

  it("marks inferred dependencies needs_review and unresolved refs invalid", () => {
    const c = base();
    c.tasks = [task("a"), task("b")];
    c.dependencies = [
      { predecessor_source_id: "a", successor_source_id: "b", dependency_type: "finish_to_start", lag_days: 0, inferred: true, confidence_score: 0.5, source_reference: "t" },
      { predecessor_source_id: "ghost", successor_source_id: "b", dependency_type: "finish_to_start", lag_days: 0, inferred: false, confidence_score: 0.9, source_reference: "t" },
    ];
    const report = validateCanonicalImport(c);
    expect(report.entityStatuses.get("dependency:a→b")!.status).toBe("needs_review");
    expect(report.entityStatuses.get("dependency:ghost→b")!.status).toBe("invalid");
  });

  it("flags materials with quantity but no unit", () => {
    const c = base();
    c.materials = [{
      source_id: "m1", name: "Concrete", quantity: 50, unit: "", unit_cost: null, total_cost: null,
      supplier: "", lead_time_days: null, required_by_task_source_id: "", required_by_date: "",
      confidence_score: 0.8, source_reference: "t",
    }];
    const report = validateCanonicalImport(c);
    expect(report.entityStatuses.get("material:m1")!.warnings).toContain("quantity_without_unit");
  });

  it("errors when nothing was extracted and reports critical path readiness", () => {
    const empty = validateCanonicalImport(base());
    expect(empty.findings.some((f) => f.validation_type === "no_entities")).toBe(true);

    const ready = base();
    ready.tasks = [task("a"), task("b")];
    ready.dependencies = [
      { predecessor_source_id: "a", successor_source_id: "b", dependency_type: "finish_to_start", lag_days: 0, inferred: false, confidence_score: 0.9, source_reference: "t" },
    ];
    expect(validateCanonicalImport(ready).criticalPathReady).toBe(true);
  });
});

describe("findCycle", () => {
  it("finds cycles and returns null for DAGs", () => {
    expect(findCycle([["a", "b"], ["b", "c"]])).toBeNull();
    expect(findCycle([["a", "b"], ["b", "a"]])).not.toBeNull();
    expect(findCycle([["a", "b"], ["b", "c"], ["c", "a"]])).not.toBeNull();
  });
});

describe("generateImportRecommendations", () => {
  it("recommends owners, durations, dependencies, and budget when missing", () => {
    const c = base();
    c.tasks = [task("1", { assigned_to: "", duration_days: null }), task("2")];
    const types = generateImportRecommendations(c).map((r) => r.type);
    expect(types).toContain("add_missing_owners");
    expect(types).toContain("add_missing_durations");
    expect(types).toContain("add_missing_dependencies");
    expect(types).toContain("add_budget");
    expect(types).toContain("confirm_project_type");
  });
});
