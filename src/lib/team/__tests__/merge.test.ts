import { describe, it, expect } from "vitest";
import { planMerge } from "../merge";

describe("planMerge", () => {
  it("returns null for fewer than two resources", () => {
    expect(planMerge([])).toBeNull();
    expect(planMerge([{ id: "a", linkedUserId: null, usage: 3 }])).toBeNull();
  });

  it("keeps the user-linked resource regardless of usage", () => {
    const plan = planMerge([
      { id: "a", linkedUserId: null, usage: 9 },
      { id: "b", linkedUserId: "user-1", usage: 1 },
    ]);
    expect(plan?.keepId).toBe("b");
    expect(plan?.mergeIds).toEqual(["a"]);
  });

  it("falls back to highest usage, then stable id", () => {
    const plan = planMerge([
      { id: "z", linkedUserId: null, usage: 5 },
      { id: "a", linkedUserId: null, usage: 5 },
      { id: "m", linkedUserId: null, usage: 8 },
    ]);
    expect(plan?.keepId).toBe("m");
    // remaining sorted: usage tie (5,5) → id asc → a then z
    expect(plan?.mergeIds).toEqual(["a", "z"]);
  });
});
