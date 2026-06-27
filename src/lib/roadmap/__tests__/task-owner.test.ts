import { describe, it, expect } from "vitest";
import {
  resolveTaskOwnerId,
  resolveTaskOwnerName,
  resolveTaskOwner,
  ownerInitials,
  type AssigneeInfo,
} from "@/lib/roadmap/task-owner";

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

describe("ownerInitials", () => {
  it("uses first + last initials", () => {
    expect(ownerInitials("Efraín Prada")).toBe("EP");
    expect(ownerInitials("Carlos de la Cruz")).toBe("CC");
  });
  it("handles a single name", () => {
    expect(ownerInitials("Madonna")).toBe("MA");
  });
});

describe("resolveTaskOwner (avatar/initials + name + role)", () => {
  const assignees: Record<string, AssigneeInfo> = {
    "user-1": { name: "Efraín Prada", role: "PMO", avatarUrl: "https://x/a.png" },
    "user-2": { name: "Ana Restrepo", role: null, avatarUrl: null },
    "res-9": { name: "Electrical Crew A", role: "crew", avatarUrl: null },
  };

  it("assigned: returns name, role, avatar and initials", () => {
    const r = resolveTaskOwner({ assigned_to: "user-1", assigned_resource_id: null }, assignees);
    expect(r).toMatchObject({ state: "assigned", name: "Efraín Prada", role: "PMO", avatarUrl: "https://x/a.png", initials: "EP" });
  });

  it("assigned with no role: role is null (never invented)", () => {
    const r = resolveTaskOwner({ assigned_to: "user-2", assigned_resource_id: null }, assignees);
    expect(r).toMatchObject({ state: "assigned", name: "Ana Restrepo", role: null });
  });

  it("group resource: resolves via assigned_resource_id", () => {
    const r = resolveTaskOwner({ assigned_to: null, assigned_resource_id: "res-9" }, assignees);
    expect(r).toMatchObject({ state: "assigned", name: "Electrical Crew A", role: "crew" });
  });

  it("owner id set but no name resolved → 'unavailable' (not a fake name)", () => {
    const r = resolveTaskOwner({ assigned_to: "ghost", assigned_resource_id: null }, assignees);
    expect(r).toEqual({ state: "unavailable", id: "ghost" });
  });

  it("no owner → 'unassigned'", () => {
    const r = resolveTaskOwner({ assigned_to: null, assigned_resource_id: null }, assignees);
    expect(r).toEqual({ state: "unassigned" });
  });
});
