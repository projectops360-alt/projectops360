// ============================================================================
// The KPI reference must describe the engine that actually exists
// ============================================================================
// Guard: KPI-REFERENCE-COMPLETE
//
// The expression editor listed the allowed FUNCTIONS but never the FIELDS, so
// the only way to discover that `open_overdue_flag` exists was to read a
// built-in KPI definition and copy from it.
//
// Documentation that drifts is worse than none: a field list that omits a
// field hides it, and one that invents a field sends the user to a validation
// error. Both are asserted here against the engine itself.
// ============================================================================

import { describe, it, expect } from "vitest";
import { KPI_FIELDS, KPI_FUNCTION_DOCS, KPI_EXAMPLES } from "../reference";
import { KPI_FUNCTIONS as ENGINE_FUNCTIONS } from "../parser";

describe("KPI field reference", () => {
  it("documents every field, with no duplicates", () => {
    const names = KPI_FIELDS.map((f) => f.field);
    expect(new Set(names).size).toBe(names.length);
  });

  it("describes each field in both languages", () => {
    for (const f of KPI_FIELDS) {
      expect(f.es.trim().length, `${f.field} (es)`).toBeGreaterThan(0);
      expect(f.en.trim().length, `${f.field} (en)`).toBeGreaterThan(0);
      expect(f.es, `${f.field} should not be the same text in both`).not.toBe(f.en);
    }
  });

  it("covers the fields the built-in KPIs actually reference", () => {
    // If a shipped KPI uses a variable, a user writing their own must be able
    // to find it.
    const documented = new Set(KPI_FIELDS.map((f) => f.field as string));
    for (const field of [
      "completed_flag",
      "blocked_flag",
      "open_overdue_flag",
      "unassigned_flag",
      "progress",
      "duration_days",
      "actual_hours",
      "estimate_hours",
      "milestone_delay_days",
      "weekly_completed",
    ]) {
      expect(documented.has(field), `${field} is used by a built-in KPI but undocumented`).toBe(true);
    }
  });
});

describe("KPI function reference", () => {
  it("lists exactly the functions the parser allows", () => {
    const documented = KPI_FUNCTION_DOCS.map((f) => f.name).sort();
    const allowed = Object.keys(ENGINE_FUNCTIONS).sort();
    // Neither an omission (hidden capability) nor an invention (dead end).
    expect(documented).toEqual(allowed);
  });

  it("shows a signature for each, not just a name", () => {
    for (const fn of KPI_FUNCTION_DOCS) {
      expect(fn.signature, fn.name).toContain("(");
      expect(fn.signature, fn.name).toContain(fn.name);
    }
  });
});

describe("KPI examples", () => {
  it("only uses documented fields and allowed functions", () => {
    const fields = new Set(KPI_FIELDS.map((f) => f.field as string));
    const functions = new Set(KPI_FUNCTION_DOCS.map((f) => f.name));

    for (const example of KPI_EXAMPLES) {
      // Every bare identifier in the expression must be a field or a function.
      const identifiers = example.expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
      for (const id of identifiers) {
        expect(
          fields.has(id) || functions.has(id),
          `example "${example.expression}" references unknown identifier "${id}"`,
        ).toBe(true);
      }
    }
  });
});
