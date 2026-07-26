// ============================================================================
// CAP-049 — the target picker says which project an entity belongs to
// Guard: PMO-SIM-TARGETS-GROUPED-BY-PROJECT
// ============================================================================
// A portfolio scenario may target anything in the organization, so the picker
// listed every project's milestones, tasks and risks in one flat run. Milestone
// names are not unique across projects — "M1", "M2", "Design Phase", "Feature
// Implementation" recur — so the user was asked to aim an intervention at an
// entity they had no way to identify. Reported from a real portfolio of eight
// projects where the list was simply unreadable.
//
// Grouping does NOT narrow what a scenario may target. V1 simulates the whole
// portfolio by design and the scope field says so; this only makes the choice
// legible.
// ============================================================================

import { describe, expect, it } from "vitest";
import { groupTargetsByProject, type GroupableTarget } from "../target-grouping";

const target = (
  kind: string,
  label: string,
  projectLabel: string | null,
  projectId: string | null = projectLabel,
): GroupableTarget => ({ kind, id: `${projectLabel}-${label}`, label, projectId, projectLabel });

describe("target grouping (PMO-SIM-TARGETS-GROUPED-BY-PROJECT)", () => {
  it("the same milestone name under two projects stays distinguishable", () => {
    // The exact collision that made the flat list unusable.
    const groups = groupTargetsByProject(
      [target("milestone", "M1", "Valle Norte"), target("milestone", "M1", "Ascendia Core")],
      "Portfolio-level",
    );
    expect(groups.map(([name]) => name)).toEqual(["Ascendia Core", "Valle Norte"]);
    expect(groups[0][1]).toHaveLength(1);
    expect(groups[1][1]).toHaveLength(1);
  });

  it("groups are alphabetical by project", () => {
    const groups = groupTargetsByProject(
      [target("task", "a", "Zeta"), target("task", "b", "Alfa"), target("task", "c", "Media")],
      "Portfolio-level",
    );
    expect(groups.map(([name]) => name)).toEqual(["Alfa", "Media", "Zeta"]);
  });

  it("inside a group, broad entities come before narrow ones", () => {
    const groups = groupTargetsByProject(
      [
        target("risk", "Riesgo", "Valle Norte"),
        target("task", "Tarea", "Valle Norte"),
        target("project", "Valle Norte", "Valle Norte"),
        target("milestone", "Hito", "Valle Norte"),
      ],
      "Portfolio-level",
    );
    expect(groups[0][1].map((entry) => entry.kind)).toEqual([
      "project",
      "milestone",
      "task",
      "risk",
    ]);
  });

  it("entities with no project go last, not first", () => {
    // A shared resource is the exception; leading with it would bury the
    // projects the user opened the picker for.
    const groups = groupTargetsByProject(
      [target("resource", "Grúa 250t", null, null), target("task", "Tarea", "Valle Norte")],
      "Portfolio-level",
    );
    expect(groups.map(([name]) => name)).toEqual(["Valle Norte", "Portfolio-level"]);
  });

  it("a blank project label is treated as no project", () => {
    const groups = groupTargetsByProject([target("task", "Tarea", "   ")], "Portfolio-level");
    expect(groups.map(([name]) => name)).toEqual(["Portfolio-level"]);
  });

  it("every target survives grouping", () => {
    // Grouping is presentation. Losing an option here would silently remove a
    // legitimate target from the scenario.
    const input = [
      target("task", "a", "P1"),
      target("task", "b", "P1"),
      target("milestone", "c", "P2"),
      target("resource", "d", null, null),
    ];
    const total = groupTargetsByProject(input, "Portfolio-level").reduce(
      (sum, [, group]) => sum + group.length,
      0,
    );
    expect(total).toBe(input.length);
  });
});
