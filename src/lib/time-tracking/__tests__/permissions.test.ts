import { describe, it, expect } from "vitest";

// ============================================================================
// Time Tracking Engine — RBAC (deny-by-default)
// ============================================================================
// Guard TIME-TRACKING-RBAC. Logged time is Actual Cost: who may create, correct
// and erase it decides whether every downstream number (utilisation, CPI,
// billing) can be trusted.
// ============================================================================

import { authorizeTimeEntryAction, type OrgRole, type TimeEntryAction } from "../permissions";

const ME = "user-me";
const OTHER = "user-other";

const can = (
  role: OrgRole,
  action: TimeEntryAction,
  extra: Partial<Parameters<typeof authorizeTimeEntryAction>[0]> = {},
) => authorizeTimeEntryAction({ role, userId: ME, action, ...extra }).allowed;

describe("logging time", () => {
  it("org managers may always log", () => {
    expect(can("owner", "log")).toBe(true);
    expect(can("admin", "log")).toBe(true);
  });

  it("the subtask owner may log on their own subtask", () => {
    expect(can("member", "log", { subtaskOwnerId: ME })).toBe(true);
  });

  it("the parent task assignee may log when the subtask has no owner", () => {
    expect(can("member", "log", { subtaskOwnerId: null, taskAssignedTo: ME })).toBe(true);
  });

  it("a member unrelated to the work may not log", () => {
    expect(can("member", "log", { subtaskOwnerId: OTHER, taskAssignedTo: OTHER })).toBe(false);
  });

  it("viewers never log", () => {
    expect(can("viewer", "log", { subtaskOwnerId: ME })).toBe(false);
  });

  it("a contributor may not log effort in someone else's name", () => {
    // Attribution is what makes utilisation and billing meaningful.
    expect(can("member", "log", { subtaskOwnerId: ME, targetUserId: OTHER })).toBe(false);
    expect(can("member", "log", { subtaskOwnerId: ME, targetUserId: ME })).toBe(true);
  });

  it("a PM may log on behalf of a team member", () => {
    expect(can("admin", "log", { subtaskOwnerId: OTHER, targetUserId: OTHER })).toBe(true);
  });
});

describe("editing an entry", () => {
  it("the author may correct their own entry", () => {
    expect(can("member", "edit", { entryCreatedBy: ME })).toBe(true);
  });

  it("falls back to whose effort it is when the author was not recorded", () => {
    expect(can("member", "edit", { entryCreatedBy: null, entryUserId: ME })).toBe(true);
  });

  it("a member may not edit someone else's entry", () => {
    expect(can("member", "edit", { entryCreatedBy: OTHER, entryUserId: OTHER })).toBe(false);
  });

  it("managers may edit anyone's entry", () => {
    expect(can("owner", "edit", { entryCreatedBy: OTHER })).toBe(true);
    expect(can("admin", "edit", { entryCreatedBy: OTHER })).toBe(true);
  });

  it("viewers never edit", () => {
    expect(can("viewer", "edit", { entryCreatedBy: ME })).toBe(false);
  });
});

describe("deleting an entry", () => {
  it("only managers may delete — erasing effort erases Actual Cost history", () => {
    expect(can("owner", "delete", { entryCreatedBy: ME })).toBe(true);
    expect(can("admin", "delete", { entryCreatedBy: ME })).toBe(true);
  });

  it("not even the author may delete their own entry", () => {
    expect(can("member", "delete", { entryCreatedBy: ME, entryUserId: ME })).toBe(false);
  });

  it("viewers never delete", () => {
    expect(can("viewer", "delete")).toBe(false);
  });
});

describe("reading entries", () => {
  it("every org role may read — logged time is team information", () => {
    for (const role of ["owner", "admin", "member", "viewer"] as OrgRole[]) {
      expect(can(role, "read"), role).toBe(true);
    }
  });
});

describe("decisions are explainable", () => {
  it("every denial carries a machine-readable reason", () => {
    const cases: [OrgRole, TimeEntryAction, Record<string, unknown>, string][] = [
      ["viewer", "log", {}, "viewer_read_only"],
      ["member", "log", { subtaskOwnerId: OTHER }, "not_responsible_for_work"],
      ["member", "log", { subtaskOwnerId: ME, targetUserId: OTHER }, "cannot_log_for_others"],
      ["member", "delete", {}, "delete_requires_manager"],
      ["member", "edit", { entryCreatedBy: OTHER }, "not_entry_author"],
    ];
    for (const [role, action, extra, reason] of cases) {
      const decision = authorizeTimeEntryAction({ role, userId: ME, action, ...extra });
      expect(decision.allowed, reason).toBe(false);
      expect(decision.reason).toBe(reason);
    }
  });
});
