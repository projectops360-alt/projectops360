// ============================================================================
// PD — Permanent project deletion asks twice
// ============================================================================
// Guard: PROJECT-DELETE-DOUBLE-CONFIRM
//
// Archiving is reversible; permanent deletion is not. The requirement is that
// the user confirms TWICE, so no single click — and no single mis-click on a
// button that used to mean "archive" — can destroy a project and its history.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  advanceDeletion,
  resetDeletion,
  deletionImpactLines,
} from "../deletion-confirmation";

describe("advanceDeletion", () => {
  it("does NOT destroy on the first confirmation", () => {
    const first = advanceDeletion(1);
    expect(first.destroy).toBe(false);
    expect(first.step).toBe(2);
  });

  it("destroys only on the second confirmation", () => {
    expect(advanceDeletion(2).destroy).toBe(true);
  });

  it("needs two advances to reach destruction", () => {
    // Walk it the way the dialog does: start at 1, click, click.
    let step = resetDeletion();
    const firstClick = advanceDeletion(step);
    expect(firstClick.destroy).toBe(false);
    step = firstClick.step;
    expect(advanceDeletion(step).destroy).toBe(true);
  });

  it("cancelling returns to the first gate, never a half-commitment", () => {
    expect(resetDeletion()).toBe(1);
    // …and starting over still takes two confirmations.
    expect(advanceDeletion(resetDeletion()).destroy).toBe(false);
  });
});

describe("deletionImpactLines", () => {
  const labels = {
    tasks: "274 tasks",
    milestones: "16 milestones",
    dependencies: "155 dependencies",
    events: "538 process events",
  };

  it("states what is really at stake", () => {
    expect(
      deletionImpactLines({ tasks: 274, milestones: 16, dependencies: 155, events: 538 }, labels),
    ).toEqual(["274 tasks", "16 milestones", "155 dependencies", "538 process events"]);
  });

  it("omits empty categories rather than padding the warning with zeros", () => {
    expect(
      deletionImpactLines({ tasks: 3, milestones: 0, dependencies: 0, events: 12 }, labels),
    ).toEqual(["274 tasks", "538 process events"]);
  });

  it("says nothing when there is nothing to lose", () => {
    expect(
      deletionImpactLines({ tasks: 0, milestones: 0, dependencies: 0, events: 0 }, labels),
    ).toEqual([]);
  });
});
