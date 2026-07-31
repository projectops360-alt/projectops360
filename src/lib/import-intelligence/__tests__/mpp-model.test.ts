import { describe, it, expect } from "vitest";

// ============================================================================
// Import Intelligence — Microsoft Project (.mpp) mapping
// ============================================================================
// Guard IMPORT-MPP-MAPPING. The fixture is a REAL plan: "Proyecto SAP CPVEN
// COLOMBIA - Plan Tecnico", 50 tasks / 19 resources / 39 assignments, decoded
// from the customer's .mpp by the sandbox converter. Synthetic fixtures would
// not have caught what this one did — assignments with no resource attached,
// durations that are only whole days once you know a day is 8 hours, and a
// project summary row that is not work.
//
// The mapper's job is to produce TABLES, not entities: the importer already
// knows how to read a task table, and a second .mpp-only path would drift.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mpxjToParsedFile,
  secondsToDays,
  secondsToHours,
  toDateOnly,
  resolvePhase,
  MPP_TASK_HEADERS,
  type MpxjProject,
  type MpxjTask,
} from "../mpp-model";
import { findColumn } from "../extract";

const project = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "cpven-sap-mpxj.json"), "utf8"),
) as MpxjProject;

const parsed = mpxjToParsedFile(project, "CPVEN - Plan Tecnico SAP_v1.mpp");
const tasks = parsed.tables.find((t) => t.name === "Tasks")!;
const col = (header: string) => tasks.headers.indexOf(header);
const rowFor = (name: string) => tasks.rows.find((r) => r[col("Task Name")] === name);

describe("units", () => {
  it("reads durations as working days, the way MS Project shows them", () => {
    // 14400s = 4h = half an 8-hour day. Dividing by 24 would print 0.17 and
    // silently disagree with the plan on the user's screen.
    expect(secondsToDays(14400)).toBe(0.5);
    expect(secondsToDays(28800)).toBe(1);
    expect(secondsToDays(57600)).toBe(2);
  });

  it("reads work as plain hours", () => {
    expect(secondsToHours(14400)).toBe(4);
    expect(secondsToHours(3600)).toBe(1);
  });

  it("treats absent, zero and nonsense durations as no value", () => {
    for (const v of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(secondsToDays(v as number)).toBeNull();
      expect(secondsToHours(v as number)).toBeNull();
    }
  });

  it("keeps the date and drops MPXJ's time component", () => {
    expect(toDateOnly("2013-06-06T09:00:00.0")).toBe("2013-06-06");
    expect(toDateOnly(undefined)).toBe("");
    expect(toDateOnly("not a date")).toBe("");
  });
});

describe("the real SAP plan maps completely", () => {
  it("keeps every named task and drops only the project summary row", () => {
    // 50 rows in the file; row 0 is the file itself, not work.
    expect(project.tasks).toHaveLength(50);
    expect(tasks.rows).toHaveLength(49);
    expect(tasks.rows.some((r) => r[col("Task Name")] === "DEORSA - Plan Tecnico SAP")).toBe(false);
  });

  it("carries the five ASAP phases as their own rows", () => {
    const names = tasks.rows.map((r) => r[col("Task Name")]);
    expect(names).toEqual(
      expect.arrayContaining([
        "1. Preparacion inicial",
        "2. Business Blue Print",
        "3. Realizacion",
        "4. Preparacion Final",
        "5. Golive and Support",
      ]),
    );
  });

  it("resolves each task's phase from the parent chain", () => {
    expect(rowFor("Validar sizing Hardware")?.[col("Phase")]).toBe("1. Preparacion inicial");
    expect(rowFor("Soporte Basis")?.[col("Phase")]).toBe("5. Golive and Support");
  });

  it("renders dates, duration and WBS the way the plan reads", () => {
    const row = rowFor("Validar sizing Hardware")!;
    expect(row[col("WBS")]).toBe("1.1.1");
    expect(row[col("Duration")]).toBe("0.5");
    expect(row[col("Start")]).toBe("2013-06-06");
    expect(row[col("Finish")]).toBe("2013-06-06");
  });

  it("translates predecessors to the ids a user sees, not MPXJ's internal ones", () => {
    // "Entregar diagrama tecnico" follows "Validar sizing Hardware" (id 3).
    expect(rowFor("Entregar diagrama tecnico de la solucion")?.[col("Predecessors")]).toBe("3");
  });

  it("marks milestones", () => {
    const milestones = tasks.rows.filter((r) => r[col("Milestone")] === "Yes");
    expect(milestones.length).toBeGreaterThan(0);
    expect(milestones.every((r) => r[col("Task Name")].length > 0)).toBe(true);
  });

  it("lists the resources that exist, even though none are assigned", () => {
    // This plan budgets effort by phase and attaches no resource to any
    // assignment. The column must stay blank rather than invent an owner.
    const resources = parsed.tables.find((t) => t.name === "Resources")!;
    expect(resources.rows.map((r) => r[0])).toEqual(expect.arrayContaining(["DEOCSA", "TANDEM"]));
    expect(tasks.rows.every((r) => r[col("Assigned To")] === "")).toBe(true);
  });

  it("records where the numbers came from", () => {
    expect(parsed.fileType).toBe("mpp");
    expect(parsed.metadata.source).toBe("microsoft-project");
    expect(parsed.metadata.taskCount).toBe(49);
    expect(parsed.metadata.workingHoursPerDay).toBe(8);
  });
});

describe("the existing importer can read these columns", () => {
  // The whole reason for emitting tables: every header must resolve through the
  // extractor's synonym table, or the .mpp path would need its own extractor.
  it.each([
    ["wbs", "WBS"],
    ["name", "Task Name"],
    ["phase", "Phase"],
    ["duration", "Duration"],
    ["hours", "Hours"],
    ["start", "Start"],
    ["finish", "Finish"],
    ["predecessor", "Predecessors"],
    ["assignee", "Assigned To"],
    ["milestone", "Milestone"],
  ])("resolves %s to the '%s' column", (field, header) => {
    expect(findColumn([...MPP_TASK_HEADERS], field as never)).toBe(
      MPP_TASK_HEADERS.indexOf(header as never),
    );
  });
});

describe("malformed files do not break the import", () => {
  it("survives a parent chain that points at itself", () => {
    const self: MpxjTask = { unique_id: 1, name: "Loop", outline_level: 2, parent_task_unique_id: 1 };
    expect(() => resolvePhase(self, new Map([[1, self]]), 1)).not.toThrow();
  });

  it("survives a cycle between two tasks", () => {
    const a: MpxjTask = { unique_id: 1, name: "A", outline_level: 2, parent_task_unique_id: 2 };
    const b: MpxjTask = { unique_id: 2, name: "B", outline_level: 2, parent_task_unique_id: 1 };
    const map = new Map([[1, a], [2, b]]);
    expect(() => resolvePhase(a, map, 1)).not.toThrow();
  });

  it("produces an empty task table rather than throwing on an empty project", () => {
    const empty = mpxjToParsedFile({}, "empty.mpp");
    expect(empty.tables[0].rows).toHaveLength(0);
    expect(empty.tables).toHaveLength(1); // no Resources table when there are none
  });

  it("skips tasks with no name instead of emitting blank rows", () => {
    const out = mpxjToParsedFile(
      { tasks: [{ unique_id: 1, name: "   ", outline_level: 1 }, { unique_id: 2, name: "Real", outline_level: 1 }] },
      "x.mpp",
    );
    expect(out.tables[0].rows).toHaveLength(1);
    expect(out.tables[0].rows[0][1]).toBe("Real");
  });
});
