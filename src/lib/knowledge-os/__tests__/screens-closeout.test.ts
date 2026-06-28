import { describe, it, expect } from "vitest";
import { resolveScreen, projectSubroute } from "../screens";

// REG-016/REG-017 — Isabella must resolve the Closeout Report as its own screen
// (not the generic "Projects" screen) so she can speak to closeout readiness and
// the open-risk blocker.

describe("project sub-route extraction", () => {
  it("extracts the segment after the projectId", () => {
    expect(projectSubroute("/projects/abc/closeout")).toBe("closeout");
    expect(projectSubroute("/es/projects/abc/closeout")).toBe("closeout");
    expect(projectSubroute("/projects/abc")).toBeNull();
  });
});

describe("REG-016/REG-017 — Closeout screen resolution", () => {
  it("resolves /projects/{id}/closeout to the closeout_report screen", () => {
    const s = resolveScreen("/projects/abc/closeout", "en");
    expect(s?.screen).toBe("closeout_report");
    expect(s?.module).toBe("closeout");
    expect(s?.pageTitle).toBe("Closeout Report");
  });

  it("surfaces the open-risk components and follow-ups Isabella can speak to", () => {
    const s = resolveScreen("/projects/abc/closeout", "en");
    expect(s?.components.join(" ")).toContain("Risks resolved");
    expect(s?.followups.join(" ").toLowerCase()).toContain("open risks");
  });

  it("localizes to Spanish", () => {
    const s = resolveScreen("/es/projects/abc/closeout", "es");
    expect(s?.pageTitle).toBe("Reporte de Cierre");
  });

  it("does NOT collapse to the generic Projects screen", () => {
    const s = resolveScreen("/projects/abc/closeout", "en");
    expect(s?.screen).not.toBe("projects_list");
  });
});
