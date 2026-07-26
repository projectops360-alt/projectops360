// ============================================================================
// Import Intelligence — an imported estimate reaches the generic engines
// Guard: IMPORT-TASK-HOURS-BOTH-FIELDS
// ============================================================================
// The executor wrote the extracted hours only to `estimated_labor_hours`, the
// construction-specific crew field. `estimate_hours` — the generic effort
// estimate — stayed null on every imported task.
//
// That matters because the two fields have disjoint readers:
//
//   estimate_hours ......... critical-path (CPM), generic capacity service,
//                            process-mining capture, Isabella's tool registry
//   estimated_labor_hours .. crew readiness, reports
//
// So an imported project's estimates were invisible to scheduling and capacity,
// and a software import — where nothing reads the labour field — lost them
// outright. Found by importing a real workbook and reading the rows back, not
// by inspecting the code.
//
// The source file supplies ONE effort figure. Both columns receive it because
// they are two lenses on the same number, never two numbers to add.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..", "..");
const executor = readFileSync(join(ROOT, "src/lib/import-intelligence/execute.ts"), "utf8");

describe("imported task hours (IMPORT-TASK-HOURS-BOTH-FIELDS)", () => {
  it("the generic estimate is populated", () => {
    expect(executor).toContain("estimate_hours: task.estimated_hours");
  });

  it("the construction crew estimate is still populated", () => {
    // The fix must add a field, not move one: readiness and reports depend on it.
    expect(executor).toContain("estimated_labor_hours: task.estimated_hours");
  });

  it("both come from the same extracted figure", () => {
    // If these ever diverge, the sheet has grown a second hours column and the
    // extractor must say which is which — a decision, not a silent mapping.
    const generic = executor.match(/estimate_hours:\s*([\w.]+)/)?.[1];
    const labour = executor.match(/estimated_labor_hours:\s*([\w.]+)/)?.[1];
    expect(generic).toBe("task.estimated_hours");
    expect(labour).toBe(generic);
  });
});
