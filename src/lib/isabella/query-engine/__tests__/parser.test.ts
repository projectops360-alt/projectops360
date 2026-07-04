// ============================================================================
// ISABELLA-GENERIC-PROJECT-DATA-QUERY-ENGINE — parser guards
// ============================================================================
// The no-milestone case is a GENERIC filter, plus entity/field/filter/sort/group
// parsing across EN/ES/mixed. No hardcoded phrase responses.
// ============================================================================

import { describe, it, expect } from "vitest";
import { parseProjectDataQuery } from "@/lib/isabella/query-engine/parser";

const es: { language: "en" | "es" } = { language: "es" };
const en: { language: "en" | "es" } = { language: "en" };

function filtersOf(text: string, o = es) {
  const p = parseProjectDataQuery(text, o);
  return p?.filters ?? [];
}
function has(text: string, field: string, operator: string, value?: unknown, o = es) {
  return filtersOf(text, o).some(
    (f) => f.field === field && f.operator === operator && (value === undefined || JSON.stringify(f.value) === JSON.stringify(value)),
  );
}

describe("no-milestone is a GENERIC filter (not a hardcoded phrase)", () => {
  it("maps every Spanish/English/mixed phrasing to { milestone, is_null }", () => {
    for (const q of [
      "dame las tareas sin milestone",
      "dame las tareas sin hito",
      "tareas que no tengan milestone",
      "tareas que no tengan hito",
      "quiero un reporte con las tareas que no tengan milestone",
      "tasks without milestone",
      "no milestone tasks",
      "tasks sin milestone",
      "show tasks without phase",
    ]) {
      expect(has(q, "milestone", "is_null"), q).toBe(true);
    }
  });

  it("'con milestone' / 'with milestone' → is_not_null", () => {
    expect(has("list all tasks with milestone and status", "milestone", "is_not_null", undefined, en)).toBe(true);
    expect(has("tareas con hito", "milestone", "is_not_null")).toBe(true);
  });
});

describe("generic filters", () => {
  it("owner presence/absence", () => {
    expect(has("show overdue tasks without owner", "owner", "is_null", undefined, en)).toBe(true);
    expect(has("tareas sin responsable", "owner", "is_null")).toBe(true);
  });
  it("blocked flag (and negation)", () => {
    expect(has("ahora solo las bloqueadas", "blocked", "equals", true)).toBe(true);
    expect(has("tareas no bloqueadas", "blocked", "equals", false)).toBe(true);
  });
  it("priority + status", () => {
    expect(has("show P1 tasks that are not started", "priority", "equals", "p1", en)).toBe(true);
    expect(has("show P1 tasks that are not started", "status", "equals", "not_started", en)).toBe(true);
    expect(has("tareas que no estén done", "status", "not_equals", "done")).toBe(true);
  });
  it("overdue → dueDate before today", () => {
    expect(has("show overdue tasks", "dueDate", "before", "today", en)).toBe(true);
    expect(has("dame las tareas vencidas", "dueDate", "before", "today")).toBe(true);
  });
  it("no due date → dueDate is_null", () => {
    expect(has("tasks with no owner and no due date", "dueDate", "is_null", undefined, en)).toBe(true);
  });
});

describe("entity + sort + group", () => {
  it("defaults to task from a report/filter cue; recognizes future entities", () => {
    expect(parseProjectDataQuery("reporte de tareas", es)?.entity).toBe("task");
    expect(parseProjectDataQuery("ahora solo las bloqueadas", es)?.entity).toBe("task"); // concrete filter → task
    expect(parseProjectDataQuery("show open risks by severity", en)?.entity).toBe("risk"); // future entity
  });

  it("parses sort (title desc; alias nombre)", () => {
    const p = parseProjectDataQuery("show tasks in Phase 5 ordered by title desc", en);
    expect(p?.sort?.[0]).toEqual({ field: "title", direction: "desc" });
  });

  it("parses grouping + aggregation", () => {
    const g1 = parseProjectDataQuery("group tasks by milestone and status", en);
    expect(g1?.groupBy).toBe("milestone");
    expect(g1?.aggregation).toBe("grouped_list");
    const g2 = parseProjectDataQuery("dame un resumen por status", es);
    expect(g2?.groupBy).toBe("status");
    expect(g2?.aggregation).toBe("count");
  });

  it("returns null for non-data questions and clarifies truly vague ones", () => {
    expect(parseProjectDataQuery("¿cómo abro el mapa de subtareas?", es)).toBeNull();
    const vague = parseProjectDataQuery("hazme un reporte", es);
    expect(vague?.requiresClarification).toBe(true);
  });

  it("the exact reported prompt still classifies + parses", () => {
    const p = parseProjectDataQuery("isabell anecesito un reporte con todas la tareas por title ordenado por desc", es);
    expect(p?.entity).toBe("task");
    expect(p?.sort?.[0]).toEqual({ field: "title", direction: "desc" });
  });
});
