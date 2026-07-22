import { describe, expect, it } from "vitest";
import { resolveFinancialCapabilities } from "../capabilities";

describe("financial role capabilities", () => {
  it("gives PMO controls and audit visibility without payment authority", () => {
    const capabilities = resolveFinancialCapabilities({
      organizationRole: "member",
      projectPermissionLevel: "contributor",
      projectRole: "PMO / Project Controls",
      permissionFlags: { can_view_budget: true },
    });
    expect(capabilities).toEqual(expect.arrayContaining([
      "financial.view",
      "financial.prepare",
      "financial.reconcile",
      "financial.audit.read",
    ]));
    expect(capabilities).not.toContain("financial.payment.release");
  });

  it("does not assume every project manager owns budget approvals", () => {
    const capabilities = resolveFinancialCapabilities({
      organizationRole: "member",
      projectPermissionLevel: "project_manager",
      projectRole: "Project Manager",
      permissionFlags: { can_view_budget: true, can_approve_changes: false },
    });
    expect(capabilities).toContain("financial.prepare");
    expect(capabilities).not.toContain("financial.approve");
    expect(capabilities).not.toContain("financial.funding.authorize");
  });

  it("keeps treasury payment authority distinct", () => {
    expect(resolveFinancialCapabilities({
      organizationRole: "member",
      projectPermissionLevel: "approver",
      projectRole: "Treasury",
    })).toContain("financial.payment.release");
  });
});
