import { describe, it, expect } from "vitest";

// ============================================================================
// REG-039 — A filter the UI shows as complete must BE complete
// ============================================================================
// "En ruta crítica = true" was rejected with "one or more filters are invalid".
// The boolean <select> has no empty option, so it rendered "true" while the
// config still held the "" that addFilter() seeded for every column type. What
// the control displayed and what the report carried disagreed.
//
// These tests assert the contract from the config's side: every filter created
// with defaultFilterValue() for the FIRST operator its column type offers is
// either immediately valid, or invalid only because the user genuinely still
// has to type something (text/enum/number/date all take free input).
// ============================================================================

import {
  defaultFilterValue,
  validateFilters,
  OPERATORS_BY_TYPE,
} from "../filter-engine";
import { getDataset } from "../registry";
import type { ColumnType, ReportFilter } from "../types";

const COLUMNS = getDataset("task_execution")!.columns;
const byKey = (key: string) => COLUMNS.find((c) => c.key === key)!;

/** Build a filter the way the builder does when you pick a column. */
const asBuilt = (columnKey: string, operator?: ReportFilter["operator"]): ReportFilter => {
  const col = byKey(columnKey);
  const op = operator ?? OPERATORS_BY_TYPE[col.type][0];
  return { column: col.key, operator: op, value: defaultFilterValue(col.type, op) };
};

describe("REG-039 — boolean filters are usable straight away", () => {
  it("a freshly added boolean filter is valid without touching it", () => {
    const filter = asBuilt("critical_path");
    expect(filter.value).toBe(true);
    expect(validateFilters([filter], COLUMNS)).toHaveLength(0);
  });

  it("the value it carries is a real boolean, not the empty string", () => {
    // "" is what the select cannot display — that mismatch WAS the bug.
    expect(defaultFilterValue("boolean", "equals")).toBe(true);
    expect(defaultFilterValue("boolean", "not_equals")).toBe(true);
  });

  it("every boolean column in the dataset behaves the same", () => {
    for (const col of COLUMNS.filter((c) => c.type === "boolean")) {
      const filter = asBuilt(col.key);
      expect(validateFilters([filter], COLUMNS), col.key).toHaveLength(0);
    }
  });

  it("combines with other filters without turning the report invalid", () => {
    const filters = [
      { column: "project_name", operator: "equals", value: "mobil*" } as ReportFilter,
      asBuilt("critical_path"),
    ];
    expect(validateFilters(filters, COLUMNS)).toHaveLength(0);
  });

  it("false is preserved as false, never coerced back to a default", () => {
    const filter: ReportFilter = { column: "blocked", operator: "equals", value: false };
    expect(validateFilters([filter], COLUMNS)).toHaveLength(0);
  });
});

describe("REG-039 — defaults for the other column types", () => {
  it("range operators start with two empty slots", () => {
    expect(defaultFilterValue("number", "between")).toEqual(["", ""]);
    expect(defaultFilterValue("date", "date_between")).toEqual(["", ""]);
  });

  it("valueless operators need nothing", () => {
    for (const op of ["is_empty", "is_not_empty"] as const) {
      const filter: ReportFilter = { column: "owner", operator: op, value: defaultFilterValue("text", op) };
      expect(validateFilters([filter], COLUMNS), op).toHaveLength(0);
    }
  });

  it("free-input types start empty and say what is missing", () => {
    for (const key of ["task_name", "progress_pct", "planned_finish", "status"]) {
      const filter = asBuilt(key);
      const errors = validateFilters([filter], COLUMNS);
      expect(errors, key).toHaveLength(1);
      expect(errors[0].code, key).toBe("missing_value");
      expect(errors[0].columnLabel, key).toBe(byKey(key).label);
    }
  });

  it("a half-filled range is reported as incomplete, not as valid", () => {
    const filter: ReportFilter = { column: "progress_pct", operator: "between", value: ["30", ""] };
    const errors = validateFilters([filter], COLUMNS);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe("missing_range");
  });

  it("a complete range passes", () => {
    const filter: ReportFilter = { column: "progress_pct", operator: "between", value: ["30", "60"] };
    expect(validateFilters([filter], COLUMNS)).toHaveLength(0);
  });
});

describe("REG-039 — validation errors can be phrased for the user", () => {
  it("every error carries a code and the column label", () => {
    const cases: { filter: ReportFilter; code: string }[] = [
      { filter: { column: "nope", operator: "equals", value: "x" }, code: "unknown_column" },
      { filter: { column: "planned_finish", operator: "starts_with", value: "x" }, code: "invalid_operator" },
      { filter: { column: "owner", operator: "equals", value: "" }, code: "missing_value" },
      { filter: { column: "progress_pct", operator: "between", value: [30] }, code: "missing_range" },
    ];
    for (const { filter, code } of cases) {
      const [error] = validateFilters([filter], COLUMNS);
      expect(error, code).toBeDefined();
      expect(error.code).toBe(code);
      expect(error.columnLabel).toBeTruthy();
      expect(error.message).toBeTruthy();
    }
  });

  it("reports the index of the offending filter so the UI can point at it", () => {
    const filters: ReportFilter[] = [
      { column: "project_name", operator: "equals", value: "mobil*" },
      { column: "owner", operator: "equals", value: "" },
    ];
    const errors = validateFilters(filters, COLUMNS);
    expect(errors).toHaveLength(1);
    expect(errors[0].index).toBe(1);
  });
});

describe("REG-039 — switching column or operator keeps the value displayable", () => {
  // Mirrors what the builder does on change; a boolean column must never be
  // left holding "" and a range operator must never be left holding a scalar.
  const switchTo = (type: ColumnType) => {
    const operator = OPERATORS_BY_TYPE[type][0];
    return defaultFilterValue(type, operator);
  };

  it("text → boolean yields a boolean", () => {
    expect(typeof switchTo("boolean")).toBe("boolean");
  });

  it("every column type produces a value its own control can render", () => {
    for (const type of ["text", "number", "date", "boolean", "enum"] as ColumnType[]) {
      const value = switchTo(type);
      if (type === "boolean") expect(typeof value).toBe("boolean");
      else expect(Array.isArray(value) || value === "").toBe(true);
    }
  });
});
