import { describe, it, expect } from "vitest";

// ============================================================================
// Task Report Builder — filter combination regression suite
// ============================================================================
// Guards REG-038: combining a project filter with an owner filter returned zero
// rows. Two defects produced it — owner names were dropped for multi-org
// assignees (covered by task-report-owner-resolution.test.ts) and wildcard
// values like "Paul*" were compared literally (covered here).
//
// Every case below is expressed the way a user builds it in the UI:
// one filter, two filters, three or more, wildcards, numbers, percentages.
// ============================================================================

import { applyFilters, validateFilters, OPERATORS_BY_TYPE } from "../filter-engine";
import { getDataset } from "../registry";
import type { ReportFilter, ReportRow } from "../types";

const COLUMNS = getDataset("task_execution")!.columns;

/** Rows shaped exactly like fetchTaskExecution() output. */
const ROWS: ReportRow[] = [
  {
    project_name: "Agrocappture", task_name: "Soil survey", milestone: "Phase 1",
    status: "in_progress", priority: "p1", owner: "Paul Reyes", owner_id: "u-paul",
    discipline: "civil", trade: "earthwork", planned_start: "2026-03-01", planned_finish: "2026-04-15",
    progress_pct: 45, days_late: 0, estimated_hours: 40, actual_hours: 52, hours_variance: 12,
    open_risks: 2, risk_severity: "high", dependency_count: 1, has_dependencies: true, blocked: false,
  },
  {
    project_name: "Agrocappture", task_name: "Irrigation design", milestone: "Phase 1",
    status: "done", priority: "p2", owner: "Paula Gómez", owner_id: "u-paula",
    discipline: "mechanical", trade: "piping", planned_start: "2026-03-10", planned_finish: "2026-05-01",
    progress_pct: 100, days_late: 3, estimated_hours: 80, actual_hours: 75, hours_variance: -5,
    open_risks: 0, risk_severity: "", dependency_count: 0, has_dependencies: false, blocked: false,
  },
  {
    project_name: "AGRO", task_name: "Fence install", milestone: "Phase 2",
    status: "blocked", priority: "p1", owner: "Paul Reyes", owner_id: "u-paul",
    discipline: "civil", trade: "fencing", planned_start: "2026-04-01", planned_finish: "2026-04-20",
    progress_pct: 30, days_late: 12, estimated_hours: 24, actual_hours: 30, hours_variance: 6,
    open_risks: 1, risk_severity: "critical", dependency_count: 2, has_dependencies: true, blocked: true,
  },
  {
    project_name: "SAP Rollout", task_name: "Data migration", milestone: "Cutover",
    status: "in_progress", priority: "p1", owner: "Marta Solís", owner_id: "u-marta",
    discipline: "software", trade: "", planned_start: "2026-02-01", planned_finish: "2026-03-15",
    progress_pct: 60, days_late: 0, estimated_hours: 120, actual_hours: 140, hours_variance: 20,
    open_risks: 3, risk_severity: "medium", dependency_count: 4, has_dependencies: true, blocked: false,
  },
  {
    project_name: "SAP Rollout", task_name: "Training plan", milestone: "Cutover",
    status: "done", priority: "p3", owner: "", owner_id: "",
    discipline: "software", trade: "", planned_start: "2026-01-05", planned_finish: "2026-02-01",
    progress_pct: 100, days_late: 0, estimated_hours: 16, actual_hours: null, hours_variance: null,
    open_risks: 0, risk_severity: "", dependency_count: 0, has_dependencies: false, blocked: false,
  },
];

const run = (...filters: ReportFilter[]) => applyFilters(ROWS, filters, COLUMNS);
const names = (rows: ReportRow[]) => rows.map((r) => r.task_name).sort();

// Filters must be valid before the engine ever sees them.
const assertValid = (...filters: ReportFilter[]) =>
  expect(validateFilters(filters, COLUMNS)).toHaveLength(0);

describe("Task Report Builder — single filter", () => {
  it("filters by project with an exact value", () => {
    const f: ReportFilter = { column: "project_name", operator: "equals", value: "AGRO" };
    assertValid(f);
    expect(names(run(f))).toEqual(["Fence install"]);
  });

  it("matches case-insensitively", () => {
    expect(run({ column: "project_name", operator: "equals", value: "agrocappture" })).toHaveLength(2);
  });

  it("ignores surrounding whitespace in the typed value", () => {
    expect(run({ column: "owner", operator: "equals", value: "  Paul Reyes  " })).toHaveLength(2);
  });

  it("returns every row when there are no filters", () => {
    expect(applyFilters(ROWS, [], COLUMNS)).toHaveLength(ROWS.length);
  });
});

describe("Task Report Builder — wildcards (ILIKE equivalent)", () => {
  it('"Agro*" matches every project starting with Agro', () => {
    const rows = run({ column: "project_name", operator: "equals", value: "Agro*" });
    expect(names(rows)).toEqual(["Fence install", "Irrigation design", "Soil survey"]);
  });

  it('"Paul*" matches Paul Reyes and Paula Gómez', () => {
    const rows = run({ column: "owner", operator: "equals", value: "Paul*" });
    expect(names(rows)).toEqual(["Fence install", "Irrigation design", "Soil survey"]);
  });

  it('"*Reyes" matches by suffix', () => {
    expect(run({ column: "owner", operator: "equals", value: "*Reyes" })).toHaveLength(2);
  });

  it('"?AGRO" style single-character wildcard matches one character only', () => {
    expect(run({ column: "project_name", operator: "equals", value: "AGR?" })).toHaveLength(1);
    expect(run({ column: "project_name", operator: "equals", value: "AGR??" })).toHaveLength(0);
  });

  it("wildcards work with contains, starts_with and ends_with", () => {
    expect(run({ column: "owner", operator: "contains", value: "Paul*Reyes" })).toHaveLength(2);
    expect(run({ column: "project_name", operator: "starts_with", value: "A*o" })).toHaveLength(3);
    expect(run({ column: "task_name", operator: "ends_with", value: "*design" })).toHaveLength(1);
  });

  it("wildcards work inside is-one-of lists", () => {
    const rows = run({ column: "owner", operator: "in", value: ["Paul*", "Marta Solís"] });
    expect(names(rows)).toEqual(["Data migration", "Fence install", "Irrigation design", "Soil survey"]);
  });

  it("negation honours wildcards too", () => {
    const rows = run({ column: "project_name", operator: "not_equals", value: "Agro*" });
    expect(names(rows)).toEqual(["Data migration", "Training plan"]);
  });

  it("treats regex metacharacters as literal text, not as a pattern", () => {
    // A user typing "SAP (Rollout)" must not blow up or match everything.
    expect(run({ column: "project_name", operator: "equals", value: "SAP (Rollout)" })).toHaveLength(0);
    expect(run({ column: "project_name", operator: "contains", value: "SAP." })).toHaveLength(0);
  });
});

describe("Task Report Builder — two filters (the reported defect)", () => {
  it("Project = Agro* AND Responsable = Paul* returns rows, not zero", () => {
    const filters: ReportFilter[] = [
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Paul*" },
    ];
    assertValid(...filters);
    const rows = run(...filters);
    expect(rows.length).toBeGreaterThan(0);
    expect(names(rows)).toEqual(["Fence install", "Irrigation design", "Soil survey"]);
  });

  it("adding the second filter narrows the first, never empties it", () => {
    const first = run({ column: "project_name", operator: "equals", value: "Agro*" });
    const both = run(
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Paul*" },
    );
    expect(both.length).toBeLessThanOrEqual(first.length);
    expect(both.length).toBeGreaterThan(0);
  });

  it("filter order does not change the result (AND is commutative)", () => {
    const a = run(
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Paul*" },
    );
    const b = run(
      { column: "owner", operator: "equals", value: "Paul*" },
      { column: "project_name", operator: "equals", value: "Agro*" },
    );
    expect(names(a)).toEqual(names(b));
  });

  it("owner can also be filtered by its internal id", () => {
    const rows = run(
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner_id", operator: "equals", value: "u-paul" },
    );
    expect(names(rows)).toEqual(["Fence install", "Soil survey"]);
  });
});

describe("Task Report Builder — three or more filters", () => {
  it("Project = Agro* AND Responsable = Paul* AND Progreso >= 30", () => {
    const filters: ReportFilter[] = [
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Paul*" },
      { column: "progress_pct", operator: "greater_than_or_equal", value: 30 },
    ];
    assertValid(...filters);
    expect(names(run(...filters))).toEqual(["Fence install", "Irrigation design", "Soil survey"]);
  });

  it("Project = SAP* AND Estado != done AND Progreso < 100 AND Prioridad = p1", () => {
    const filters: ReportFilter[] = [
      { column: "project_name", operator: "equals", value: "SAP*" },
      { column: "status", operator: "not_equals", value: "done" },
      { column: "progress_pct", operator: "less_than", value: 100 },
      { column: "priority", operator: "equals", value: "p1" },
    ];
    assertValid(...filters);
    expect(names(run(...filters))).toEqual(["Data migration"]);
  });

  it("five filters across text, enum, number, date and boolean columns", () => {
    const filters: ReportFilter[] = [
      { column: "project_name", operator: "contains", value: "agro" },
      { column: "owner", operator: "starts_with", value: "Paul" },
      { column: "progress_pct", operator: "between", value: [30, 60] },
      { column: "planned_finish", operator: "date_on_or_after", value: "2026-04-01" },
      { column: "has_dependencies", operator: "equals", value: true },
    ];
    assertValid(...filters);
    expect(names(run(...filters))).toEqual(["Fence install", "Soil survey"]);
  });

  it("each added filter monotonically shrinks the result set", () => {
    const chain: ReportFilter[] = [
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Paul*" },
      { column: "status", operator: "not_equals", value: "done" },
      { column: "priority", operator: "equals", value: "p1" },
    ];
    const sizes = chain.map((_, i) => run(...chain.slice(0, i + 1)).length);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    expect(sizes.at(-1)).toBe(2);
  });
});

describe("Task Report Builder — AND across columns, OR within a column", () => {
  it("repeating = on the same column matches either value", () => {
    const rows = run(
      { column: "project_name", operator: "equals", value: "AGRO" },
      { column: "project_name", operator: "equals", value: "SAP*" },
    );
    expect(names(rows)).toEqual(["Data migration", "Fence install", "Training plan"]);
  });

  it("still ANDs a repeated column against a different column", () => {
    const rows = run(
      { column: "project_name", operator: "equals", value: "AGRO" },
      { column: "project_name", operator: "equals", value: "SAP*" },
      { column: "priority", operator: "equals", value: "p1" },
    );
    expect(names(rows)).toEqual(["Data migration", "Fence install"]);
  });

  it("non-membership operators on the same column keep AND semantics", () => {
    // "contains agro" AND "does not contain cappture" — both must hold.
    const rows = run(
      { column: "project_name", operator: "contains", value: "agro" },
      { column: "project_name", operator: "not_contains", value: "cappture" },
    );
    expect(names(rows)).toEqual(["Fence install"]);
  });

  it("a range plus a membership filter on the same column both apply", () => {
    const rows = run(
      { column: "progress_pct", operator: "between", value: [30, 100] },
      { column: "progress_pct", operator: "equals", value: 100 },
    );
    expect(names(rows)).toEqual(["Irrigation design", "Training plan"]);
  });
});

describe("Task Report Builder — numeric filters", () => {
  it("supports > >= < <= and between", () => {
    expect(run({ column: "estimated_hours", operator: "greater_than", value: 40 })).toHaveLength(2);
    expect(run({ column: "estimated_hours", operator: "greater_than_or_equal", value: 40 })).toHaveLength(3);
    expect(run({ column: "estimated_hours", operator: "less_than", value: 40 })).toHaveLength(2);
    expect(run({ column: "estimated_hours", operator: "less_than_or_equal", value: 40 })).toHaveLength(3);
    expect(run({ column: "estimated_hours", operator: "between", value: [24, 80] })).toHaveLength(3);
  });

  it("compares numerically, not as text", () => {
    // "9" > "100" as strings; as numbers it is not.
    expect(run({ column: "estimated_hours", operator: "greater_than", value: 9 })).toHaveLength(5);
    expect(run({ column: "progress_pct", operator: "equals", value: "100.0" })).toHaveLength(2);
  });

  it("handles negative values (hours under the estimate)", () => {
    expect(names(run({ column: "hours_variance", operator: "less_than", value: 0 }))).toEqual(["Irrigation design"]);
  });

  it("tolerates a reversed between range", () => {
    expect(run({ column: "progress_pct", operator: "between", value: [60, 30] })).toHaveLength(3);
  });

  it("excludes rows with no value instead of matching them", () => {
    expect(run({ column: "actual_hours", operator: "greater_than", value: 0 })).toHaveLength(4);
    expect(names(run({ column: "actual_hours", operator: "is_empty" }))).toEqual(["Training plan"]);
    expect(run({ column: "actual_hours", operator: "is_not_empty" })).toHaveLength(4);
  });

  it("filters the derived days-late and risk columns", () => {
    expect(names(run({ column: "days_late", operator: "greater_than", value: 0 }))).toEqual(["Fence install", "Irrigation design"]);
    expect(names(run({ column: "open_risks", operator: "greater_than_or_equal", value: 2 }))).toEqual(["Data migration", "Soil survey"]);
    expect(names(run({ column: "risk_severity", operator: "equals", value: "critical" }))).toEqual(["Fence install"]);
    expect(run({ column: "dependency_count", operator: "greater_than", value: 1 })).toHaveLength(2);
  });
});

describe("Task Report Builder — percentage filters", () => {
  const pct = (operator: ReportFilter["operator"], value: ReportFilter["value"]) =>
    names(run({ column: "progress_pct", operator, value }));

  it(">= 30", () => expect(pct("greater_than_or_equal", 30)).toHaveLength(5));
  it("> 50", () => expect(pct("greater_than", 50)).toEqual(["Data migration", "Irrigation design", "Training plan"]));
  it("< 80", () => expect(pct("less_than", 80)).toEqual(["Data migration", "Fence install", "Soil survey"]));
  it("= 100", () => expect(pct("equals", 100)).toEqual(["Irrigation design", "Training plan"]));
  it("between 30 and 60", () => expect(pct("between", [30, 60])).toEqual(["Data migration", "Fence install", "Soil survey"]));

  it("accepts the value as a string, the way the UI submits it", () => {
    expect(pct("greater_than_or_equal", "30")).toHaveLength(5);
  });
});

describe("Task Report Builder — text, date and emptiness operators", () => {
  it("contains / does not contain", () => {
    expect(run({ column: "task_name", operator: "contains", value: "install" })).toHaveLength(1);
    expect(run({ column: "task_name", operator: "not_contains", value: "install" })).toHaveLength(4);
  });

  it("is empty / is not empty on an unassigned owner", () => {
    expect(names(run({ column: "owner", operator: "is_empty" }))).toEqual(["Training plan"]);
    expect(run({ column: "owner", operator: "is_not_empty" })).toHaveLength(4);
  });

  it("date before / after / on-or-before / on-or-after / between", () => {
    expect(run({ column: "planned_finish", operator: "date_before", value: "2026-03-15" })).toHaveLength(1);
    expect(run({ column: "planned_finish", operator: "date_on_or_before", value: "2026-03-15" })).toHaveLength(2);
    expect(run({ column: "planned_finish", operator: "date_after", value: "2026-04-20" })).toHaveLength(1);
    expect(run({ column: "planned_finish", operator: "date_on_or_after", value: "2026-04-20" })).toHaveLength(2);
    expect(run({ column: "planned_finish", operator: "date_between", value: ["2026-04-01", "2026-05-01"] })).toHaveLength(3);
  });

  it("boolean equals", () => {
    expect(names(run({ column: "blocked", operator: "equals", value: true }))).toEqual(["Fence install"]);
    expect(run({ column: "blocked", operator: "equals", value: false })).toHaveLength(4);
  });
});

describe("Task Report Builder — empty and multi-row outcomes", () => {
  it("returns nothing when the combination genuinely has no match", () => {
    expect(run(
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Marta*" },
    )).toHaveLength(0);
  });

  it("returns nothing for an owner nobody has", () => {
    expect(run({ column: "owner", operator: "equals", value: "Zoltan*" })).toHaveLength(0);
  });

  it("returns nothing rather than everything when a value is missing", () => {
    expect(run({ column: "progress_pct", operator: "greater_than", value: "" })).toHaveLength(0);
    expect(run({ column: "progress_pct", operator: "between", value: [30] })).toHaveLength(0);
    expect(run({ column: "owner", operator: "in", value: [] })).toHaveLength(0);
  });

  it("returns multiple rows across projects for a broad filter", () => {
    const rows = run({ column: "priority", operator: "equals", value: "p1" });
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.project_name)).size).toBe(3);
  });
});

describe("Task Report Builder — filter validation", () => {
  it("accepts every operator the UI offers for each column type", () => {
    for (const col of COLUMNS) {
      for (const op of OPERATORS_BY_TYPE[col.type]) {
        const needsValue = !["is_empty", "is_not_empty"].includes(op);
        const value = op === "between" || op === "date_between" ? [1, 2]
          : op === "in" || op === "not_in" ? ["x"]
          : needsValue ? "x" : undefined;
        expect(validateFilters([{ column: col.key, operator: op, value }], COLUMNS), `${col.key} ${op}`).toHaveLength(0);
      }
    }
  });

  it("rejects an unknown column, a wrong operator and a missing value", () => {
    expect(validateFilters([{ column: "nope", operator: "equals", value: "x" }], COLUMNS)).toHaveLength(1);
    expect(validateFilters([{ column: "planned_finish", operator: "starts_with", value: "x" }], COLUMNS)).toHaveLength(1);
    expect(validateFilters([{ column: "owner", operator: "equals", value: "" }], COLUMNS)).toHaveLength(1);
  });

  it("exposes the new filterable task columns the builder needs", () => {
    const keys = new Set(COLUMNS.filter((c) => c.filterable !== false).map((c) => c.key));
    for (const key of [
      "owner", "owner_id", "status", "priority", "milestone", "progress_pct",
      "planned_start", "planned_finish", "days_late", "estimated_hours", "actual_hours",
      "hours_variance", "open_risks", "risk_severity", "dependency_count", "discipline", "trade",
    ]) expect(keys.has(key), key).toBe(true);
  });
});

describe("Task Report Builder — cost of combining filters", () => {
  it("stays linear as filters are added (patterns compile once, not per row)", () => {
    const many: ReportRow[] = Array.from({ length: 20_000 }, (_, i) => ({
      project_name: i % 2 ? "Agrocappture" : "SAP Rollout",
      owner: i % 3 ? "Paul Reyes" : "Marta Solís",
      task_name: `T${i}`,
      progress_pct: i % 101,
      status: i % 5 ? "in_progress" : "done",
    }));
    const filters: ReportFilter[] = [
      { column: "project_name", operator: "equals", value: "Agro*" },
      { column: "owner", operator: "equals", value: "Paul*" },
      { column: "progress_pct", operator: "greater_than_or_equal", value: 30 },
      { column: "status", operator: "not_equals", value: "done" },
    ];
    const started = performance.now();
    const out = applyFilters(many, filters, COLUMNS);
    const elapsed = performance.now() - started;
    expect(out.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});
