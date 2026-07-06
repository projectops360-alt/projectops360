import { describe, it, expect } from "vitest";
import { authorizeAttachmentAction, type OrgRole } from "../permissions";

// ============================================================================
// TASK-SUBTASK-FILE-ATTACHMENTS — RBAC guard (deny-by-default)
// list/view: any role · upload: member+ (not viewer) · remove: own attachment
// (member) or any (owner/admin).
// ============================================================================

const ME = "user-me";
const OTHER = "user-other";

function decide(role: OrgRole, action: Parameters<typeof authorizeAttachmentAction>[0]["action"], uploadedById?: string | null) {
  return authorizeAttachmentAction({ role, userId: ME, action, uploadedById }).allowed;
}

describe("read (list/view/download)", () => {
  it("every role can list and view", () => {
    for (const role of ["owner", "admin", "member", "viewer"] as OrgRole[]) {
      expect(decide(role, "list")).toBe(true);
      expect(decide(role, "view")).toBe(true);
    }
  });
});

describe("upload", () => {
  it("owner/admin/member can upload", () => {
    expect(decide("owner", "upload")).toBe(true);
    expect(decide("admin", "upload")).toBe(true);
    expect(decide("member", "upload")).toBe(true);
  });
  it("viewer cannot upload", () => {
    expect(decide("viewer", "upload")).toBe(false);
  });
});

describe("remove", () => {
  it("owner/admin can remove anyone's attachment", () => {
    expect(decide("owner", "remove", OTHER)).toBe(true);
    expect(decide("admin", "remove", OTHER)).toBe(true);
  });
  it("member can remove only their own attachment", () => {
    expect(decide("member", "remove", ME)).toBe(true);
    expect(decide("member", "remove", OTHER)).toBe(false);
    expect(decide("member", "remove", null)).toBe(false);
  });
  it("viewer cannot remove anything", () => {
    expect(decide("viewer", "remove", ME)).toBe(false);
    expect(decide("viewer", "remove", OTHER)).toBe(false);
  });
});
