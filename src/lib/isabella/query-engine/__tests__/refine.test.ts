// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE — follow-up refinement guards
// ============================================================================

import { describe, it, expect } from "vitest";
import { refineQueryPlan, isFollowUpRefinement } from "@/lib/isabella/query-engine/refine";
import { parseProjectDataQuery } from "@/lib/isabella/query-engine/parser";
import type { IsabellaProjectQueryPlan } from "@/lib/isabella/query-engine/query-plan";

const es = { language: "es" as const };

function prevReport(): IsabellaProjectQueryPlan {
  // "listado de todas las tareas con milestone y status"
  return parseProjectDataQuery("listado de todas las tareas con milestone y status", es)!;
}

describe("isFollowUpRefinement", () => {
  it("recognizes follow-up phrasings", () => {
    for (const q of ["ahora uno con las tareas que no tengan milestone", "ese mismo reporte pero agrupado por milestone", "solo las bloqueadas", "same report but without milestone"]) {
      expect(isFollowUpRefinement(q), q).toBe(true);
    }
  });
});

describe("refineQueryPlan", () => {
  it("preserves entity + columns and applies the new no-milestone filter", () => {
    const prev = prevReport();
    const refined = refineQueryPlan(prev, "ahora uno con las tareas que no tengan milestone", es)!;
    expect(refined.entity).toBe("task");
    expect(refined.selectedFields).toEqual(prev.selectedFields);
    expect(refined.filters).toContainEqual({ field: "milestone", operator: "is_null" });
    // the prior "con milestone" filter is replaced (not both).
    expect(refined.filters.some((f) => f.operator === "is_not_null")).toBe(false);
  });

  it("'ese mismo pero agrupado por estado' keeps prior filters and adds grouping", () => {
    const prev = parseProjectDataQuery("tareas sin hito", es)!; // filter milestone is_null
    const refined = refineQueryPlan(prev, "ese mismo pero agrupado por estado", es)!;
    expect(refined.filters).toContainEqual({ field: "milestone", operator: "is_null" }); // preserved
    expect(refined.groupBy).toBe("status");
  });

  it("falls back to standalone parsing when there is no prior context", () => {
    const refined = refineQueryPlan(null, "tareas sin hito", es)!;
    expect(refined.entity).toBe("task");
    expect(refined.filters).toContainEqual({ field: "milestone", operator: "is_null" });
  });
});
