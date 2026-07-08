import { describe, it, expect } from "vitest";
import { resolveScreen } from "../screens";

// ISABELLA-SCREEN-CONTEXT-EXPLANATION (P0) — the project participants screen
// (`/projects/{id}/team`, Resources / "Who participates in this project?") must
// resolve to its OWN screen. Before the fix it fell through to the generic
// Projects list, so "Explain this screen" wrongly described "Open Projects".

describe("project participants screen resolution", () => {
  it("resolves /projects/{id}/team to the participants screen, NOT the Projects list", () => {
    const s = resolveScreen("/projects/abc/team", "en");
    expect(s?.screen).toBe("project_participants");
    expect(s?.module).toBe("project_team");
    expect(s?.screen).not.toBe("projects_list");
    expect(s?.pageTitle.toLowerCase()).toContain("participat");
  });

  it("surfaces the real table columns and the Unassigned meaning Isabella can speak to", () => {
    const s = resolveScreen("/projects/abc/team", "en");
    const components = s!.components.join(" ");
    for (const col of ["Member", "Type", "Role / Delivery / Governance", "Permission", "Access"]) {
      expect(components).toContain(col);
    }
    expect(components.toLowerCase()).toContain("role slot with no person");
  });

  it("localizes to Spanish", () => {
    const s = resolveScreen("/es/projects/abc/team", "es");
    expect(s?.screen).toBe("project_participants");
    expect(s?.pageTitle.toLowerCase()).toContain("participa");
  });
});
