import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = readFileSync(join(process.cwd(), "scripts/apply-team-role-editor.mjs"), "utf8");

describe("role editor integration script", () => {
  it("is narrowly scoped to the members role cell", () => {
    expect(script).toContain('import { MemberRoleCell } from "./member-role-cell";');
    expect(script).toContain("member role cell anchor not found");
    expect(script).toContain("Team role editor integrated.");
    expect(script).not.toContain("permission_level");
    expect(script).not.toContain("project_raci_assignments");
  });
});
