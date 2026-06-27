import { describe, it, expect } from "vitest";
import { resolveTaskOwnerId, resolveTaskOwnerName } from "@/lib/roadmap/task-owner";

const names = { "user-1": "Carlos Méndez", "res-9": "Electrical Crew A" };

describe("resolveTaskOwnerName (Workboard ownership visibility)", () => {
  it("shows the assigned person's name", () => {
    const task = { assigned_to: "user-1", assigned_resource_id: null };
    expect(resolveTaskOwnerName(task, names)).toBe("Carlos Méndez");
  });

  it("falls back to the assigned resource (crew/team) name", () => {
    const task = { assigned_to: null, assigned_resource_id: "res-9" };
    expect(resolveTaskOwnerName(task, names)).toBe("Electrical Crew A");
  });

  it("returns null when no one is assigned (card shows Unassigned)", () => {
    const task = { assigned_to: null, assigned_resource_id: null };
    expect(resolveTaskOwnerName(task, names)).toBeNull();
  });

  it("returns null when the assigned id has no name (lookup failed) — never invents a name", () => {
    const task = { assigned_to: "user-unknown", assigned_resource_id: null };
    expect(resolveTaskOwnerName(task, names)).toBeNull();
  });

  it("prefers the person over the resource when both are set", () => {
    const task = { assigned_to: "user-1", assigned_resource_id: "res-9" };
    expect(resolveTaskOwnerId(task)).toBe("user-1");
    expect(resolveTaskOwnerName(task, names)).toBe("Carlos Méndez");
  });
});
