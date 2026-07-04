// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE — plan validation guards
// ============================================================================

import { describe, it, expect } from "vitest";
import { validateQueryPlan, resolveField, resolveEntity, resolveEnumValue } from "@/lib/isabella/query-engine/catalog";
import type { IsabellaProjectQueryPlan } from "@/lib/isabella/query-engine/query-plan";

function plan(over: Partial<IsabellaProjectQueryPlan> = {}): IsabellaProjectQueryPlan {
  return {
    intent: "deterministic_project_report",
    entity: "task",
    selectedFields: ["title", "status", "milestone"],
    filters: [{ field: "milestone", operator: "is_null" }],
    sort: [{ field: "title", direction: "asc" }],
    groupBy: null,
    aggregation: "list",
    limit: 100,
    language: "es",
    requiresClarification: false,
    clarificationQuestion: null,
    ...over,
  };
}

describe("field / entity / value alias resolution", () => {
  it("maps EN/ES field aliases to canonical fields", () => {
    for (const a of ["title", "titulo", "título", "nombre", "name"]) expect(resolveField("task", a)).toBe("title");
    for (const a of ["status", "estado"]) expect(resolveField("task", a)).toBe("status");
    for (const a of ["owner", "responsable", "asignado", "assignee"]) expect(resolveField("task", a)).toBe("owner");
    for (const a of ["vence", "due", "deadline", "fecha de entrega"]) expect(resolveField("task", a)).toBe("dueDate");
    for (const a of ["milestone", "hito", "fase", "phase"]) expect(resolveField("task", a)).toBe("milestone");
  });
  it("resolves entity + enum value aliases", () => {
    expect(resolveEntity("tareas")).toBe("task");
    expect(resolveEntity("risks")).toBe("risk");
    expect(resolveEnumValue("task", "status", "sin iniciar")).toBe("not_started");
    expect(resolveEnumValue("task", "priority", "alta")).toBe("p1");
  });
});

describe("validateQueryPlan", () => {
  it("accepts a well-formed plan", () => {
    expect(validateQueryPlan(plan()).ok).toBe(true);
  });
  it("passes a clarification plan without executing", () => {
    expect(validateQueryPlan(plan({ requiresClarification: true })).ok).toBe(true);
  });
  it("rejects unknown fields / filters / sorts / groups", () => {
    expect(validateQueryPlan(plan({ selectedFields: ["ssn"] })).ok).toBe(false);
    expect(validateQueryPlan(plan({ filters: [{ field: "secret", operator: "equals", value: "x" }] })).ok).toBe(false);
    expect(validateQueryPlan(plan({ sort: [{ field: "blocked", direction: "asc" }] })).ok).toBe(false); // not sortable
    expect(validateQueryPlan(plan({ groupBy: "title" })).ok).toBe(false); // not groupable
  });
  it("rejects an unsupported (future) entity", () => {
    expect(validateQueryPlan(plan({ entity: "risk", filters: [], sort: [], selectedFields: [] })).ok).toBe(false);
  });
  it("rejects a non-positive limit", () => {
    expect(validateQueryPlan(plan({ limit: 0 })).ok).toBe(false);
  });
});
