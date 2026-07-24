// ============================================================================
// CAP-047 M2 — tenant isolation, defense in depth (guard: PMO-PI-TENANT-SCOPE)
// ============================================================================
// Fails if a cross-tenant or out-of-scope row can survive the mandatory
// scoping barrier every adapter must apply before shaping contracts.
// ============================================================================

import { describe, it, expect } from "vitest";
import { scopeToOrganization, scopeToProjects } from "../scope";

describe("scopeToOrganization (CAP-047 M2)", () => {
  it("drops every row from another organization", () => {
    const rows = [
      { organizationId: "org-1", v: 1 },
      { organizationId: "org-2", v: 2 },
      { organizationId: "org-1", v: 3 },
    ];
    const scoped = scopeToOrganization(rows, "org-1");
    expect(scoped.map((r) => r.v)).toEqual([1, 3]);
    expect(scoped.some((r) => r.organizationId !== "org-1")).toBe(false);
  });

  it("returns empty for a tenant with no rows — never leaks a fallback", () => {
    expect(scopeToOrganization([{ organizationId: "org-2" }], "org-1")).toEqual([]);
  });
});

describe("scopeToProjects (CAP-047 M2)", () => {
  it("filters to the allowed set and passes everything when unrestricted", () => {
    const rows = [{ projectId: "a" }, { projectId: "b" }];
    expect(scopeToProjects(rows, ["a"]).map((r) => r.projectId)).toEqual(["a"]);
    expect(scopeToProjects(rows, []).map((r) => r.projectId)).toEqual(["a", "b"]);
  });
});
