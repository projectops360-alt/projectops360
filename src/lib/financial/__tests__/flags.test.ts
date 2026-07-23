import { describe, expect, it } from "vitest";
import { getFinancialFeatureState, isFinancialPilotProject } from "../flags";

describe("financial feature flags", () => {
  it("defaults every capability off", () => {
    expect(getFinancialFeatureState("project-1")).toEqual({
      pilot: false,
      foundation: false,
      writers: false,
      projections: false,
      ui: false,
      isabella: false,
    });
  });

  it("requires project allowlist and dependency flags", () => {
    expect(getFinancialFeatureState("project-1", {
      pilotProjectIds: "project-1",
      foundation: "true",
      writers: "true",
      projections: "true",
      ui: "true",
      isabella: "true",
    })).toEqual({
      pilot: true,
      foundation: true,
      writers: true,
      projections: true,
      ui: true,
      isabella: true,
    });
    expect(getFinancialFeatureState("project-2", {
      pilotProjectIds: "project-1",
      foundation: "true",
      projections: "true",
      ui: "true",
    }).ui).toBe(false);
  });

  it("enables existing and newly created projects when configured for all", () => {
    expect(isFinancialPilotProject("project-1", "all")).toBe(true);
    expect(isFinancialPilotProject("new-project", "all")).toBe(true);
  });
});
