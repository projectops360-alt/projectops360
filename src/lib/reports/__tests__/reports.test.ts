import { describe, it, expect } from "vitest";
import { listDatasets, getDataset, getColumn } from "../registry";
import { listPrebuiltReports } from "../report-library";
import { listKpis } from "../kpi-dictionary";
import { applyFilters, applySort, applyGrouping, validateFilters, rowsToCsv } from "../filter-engine";
import type { ReportRow, ReportFilter } from "../types";

// ── Registry integrity ─────────────────────────────────────────────────────

describe("dataset registry", () => {
  it("exposes datasets with unique ids and unique column keys", () => {
    const datasets = listDatasets();
    expect(datasets.length).toBeGreaterThanOrEqual(6);
    expect(new Set(datasets.map((d) => d.id)).size).toBe(datasets.length);
    for (const d of datasets) {
      const keys = d.columns.map((c) => c.key);
      expect(new Set(keys).size).toBe(keys.length);
      // default columns must exist
      for (const dc of d.defaultColumns) expect(keys).toContain(dc);
    }
  });

  it("looks up datasets and columns", () => {
    expect(getDataset("task_execution")?.displayName).toBe("Task Execution");
    expect(getDataset("nope")).toBeNull();
    expect(getColumn("task_execution", "status")?.type).toBe("enum");
    expect(getColumn("task_execution", "record_type")?.type).toBe("enum");
  });
});

// ── Prebuilt reports reference valid datasets/columns ────────────────────────

describe("prebuilt report library", () => {
  it("every report references an existing dataset and valid columns/filters", () => {
    for (const r of listPrebuiltReports()) {
      const ds = getDataset(r.datasetId);
      expect(ds, `dataset for ${r.id}`).not.toBeNull();
      const keys = new Set(ds!.columns.map((c) => c.key));
      for (const c of r.config.columns) expect(keys.has(c), `${r.id} column ${c}`).toBe(true);
      for (const f of r.config.filters) expect(keys.has(f.column), `${r.id} filter ${f.column}`).toBe(true);
      if (r.config.grouping) expect(keys.has(r.config.grouping.column)).toBe(true);
      for (const s of r.config.sort) expect(keys.has(s.column), `${r.id} sort ${s.column}`).toBe(true);
    }
  });

  it("filters in prebuilt reports pass validation", () => {
    for (const r of listPrebuiltReports()) {
      const ds = getDataset(r.datasetId)!;
      expect(validateFilters(r.config.filters, ds.columns), r.id).toHaveLength(0);
    }
  });
});

// ── Filter engine ────────────────────────────────────────────────────────────

const rows: ReportRow[] = [
  { project_name: "Mobile App Design", task_name: "Dig", status: "done", owner: "Ana", duration_days: 3, blocked: false, planned_finish: "2026-06-10" },
  { project_name: "Mining Layer", task_name: "Pour", status: "blocked", owner: "", duration_days: 5, blocked: true, planned_finish: "2026-06-20" },
  { project_name: "Project (Alpha)+", task_name: "Frame", status: "in_progress", owner: "Luis", duration_days: 10, blocked: false, planned_finish: "2026-07-01" },
];
const columns = getDataset("task_execution")!.columns;

describe("filter engine", () => {
  it("equals / not_equals / in / not_in", () => {
    expect(applyFilters(rows, [{ column: "status", operator: "equals", value: "done" }])).toHaveLength(1);
    expect(applyFilters(rows, [{ column: "status", operator: "not_equals", value: "done" }])).toHaveLength(2);
    expect(applyFilters(rows, [{ column: "status", operator: "in", value: ["done", "blocked"] }])).toHaveLength(2);
    expect(applyFilters(rows, [{ column: "status", operator: "not_in", value: ["done", "tested", "deferred"] }])).toHaveLength(2);
  });

  it("boolean, numeric and is_empty operators", () => {
    expect(applyFilters(rows, [{ column: "blocked", operator: "equals", value: true }])).toHaveLength(1);
    expect(applyFilters(rows, [{ column: "duration_days", operator: "greater_than", value: 4 }])).toHaveLength(2);
    expect(applyFilters(rows, [{ column: "duration_days", operator: "between", value: [3, 5] }])).toHaveLength(2);
    expect(applyFilters(rows, [{ column: "owner", operator: "is_empty" }])).toHaveLength(1);
  });

  it("date operators", () => {
    expect(applyFilters(rows, [{ column: "planned_finish", operator: "date_after", value: "2026-06-15" }])).toHaveLength(2);
    expect(applyFilters(rows, [{ column: "planned_finish", operator: "date_between", value: ["2026-06-01", "2026-06-30"] }])).toHaveLength(2);
  });

  it("AND-combines multiple filters", () => {
    const r = applyFilters(rows, [
      { column: "blocked", operator: "equals", value: false },
      { column: "duration_days", operator: "greater_than", value: 4 },
    ]);
    expect(r.map((x) => x.task_name)).toEqual(["Frame"]);
  });

  it("OR-combines repeated equals filters on the same column", () => {
    const r = applyFilters(rows, [
      { column: "project_name", operator: "equals", value: "Mobile App Design" },
      { column: "project_name", operator: "equals", value: "Mining Layer" },
    ]);
    expect(r.map((x) => x.project_name)).toEqual(["Mobile App Design", "Mining Layer"]);
  });

  it("keeps AND semantics across columns and for range constraints", () => {
    const byProjectAndStatus = applyFilters(rows, [
      { column: "project_name", operator: "equals", value: "Mobile App Design" },
      { column: "project_name", operator: "equals", value: "Mining Layer" },
      { column: "status", operator: "equals", value: "blocked" },
    ]);
    expect(byProjectAndStatus.map((x) => x.task_name)).toEqual(["Pour"]);

    const byRange = applyFilters(rows, [
      { column: "duration_days", operator: "greater_than_or_equal", value: 4 },
      { column: "duration_days", operator: "less_than_or_equal", value: 6 },
    ]);
    expect(byRange.map((x) => x.task_name)).toEqual(["Pour"]);
  });

  it("supports safe * and ? wildcards in text filters", () => {
    expect(applyFilters(rows, [{ column: "project_name", operator: "equals", value: "Mobile*" }]).map((x) => x.task_name)).toEqual(["Dig"]);
    expect(applyFilters(rows, [{ column: "project_name", operator: "equals", value: "M?ning Layer" }]).map((x) => x.task_name)).toEqual(["Pour"]);
    expect(applyFilters(rows, [{ column: "project_name", operator: "equals", value: "Project (Alpha)+" }]).map((x) => x.task_name)).toEqual(["Frame"]);
    expect(applyFilters(rows, [{ column: "project_name", operator: "equals", value: "Project (Alpha)*" }]).map((x) => x.task_name)).toEqual(["Frame"]);
  });

  it("AND-combines repeated exclusion filters", () => {
    const r = applyFilters(rows, [
      { column: "project_name", operator: "not_equals", value: "Mobile*" },
      { column: "project_name", operator: "not_equals", value: "Mining*" },
    ]);
    expect(r.map((x) => x.task_name)).toEqual(["Frame"]);
  });

  it("sorts by number and text", () => {
    expect(applySort(rows, [{ column: "duration_days", direction: "desc" }], columns).map((r) => r.task_name)).toEqual(["Frame", "Pour", "Dig"]);
    expect(applySort(rows, [{ column: "task_name", direction: "asc" }], columns)[0].task_name).toBe("Dig");
  });

  it("groups with count and sum aggregations", () => {
    const g = applyGrouping(rows, { column: "blocked", metrics: [{ column: "task_name", fn: "count", label: "Tasks" }, { column: "duration_days", fn: "sum", label: "Days" }] });
    const blockedFalse = g.find((x) => x.blocked === "false");
    expect(blockedFalse?.Tasks).toBe(2);
    expect(blockedFalse?.Days).toBe(13);
  });
});

describe("filter validation", () => {
  it("rejects unknown columns and bad operators", () => {
    expect(validateFilters([{ column: "ghost", operator: "equals", value: "x" } as ReportFilter], columns)).toHaveLength(1);
    expect(validateFilters([{ column: "duration_days", operator: "contains", value: "x" } as ReportFilter], columns)).toHaveLength(1);
    expect(validateFilters([{ column: "status", operator: "equals", value: "" } as ReportFilter], columns)).toHaveLength(1);
    expect(validateFilters([{ column: "status", operator: "equals", value: "done" }], columns)).toHaveLength(0);
  });
});

describe("CSV export", () => {
  it("uses labels as headers and escapes commas/quotes", () => {
    const cols = [{ key: "task_name", label: "Task Name" }, { key: "status", label: "Status" }];
    const csv = rowsToCsv([{ task_name: 'Pour, footing "A"', status: "blocked", duration_days: 5, owner: "", blocked: true, planned_finish: "" }], cols);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Task Name,Status");
    expect(lines[1]).toBe('"Pour, footing ""A""",blocked');
  });
});

describe("kpi dictionary", () => {
  it("defines KPIs with formula and interpretation", () => {
    const kpis = listKpis();
    expect(kpis.length).toBeGreaterThan(5);
    for (const k of kpis) {
      expect(k.formula).toBeTruthy();
      expect(k.interpretation).toBeTruthy();
    }
  });
});
