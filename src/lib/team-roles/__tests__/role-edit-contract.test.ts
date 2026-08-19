import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(
  join(process.cwd(), "src/app/[locale]/(app)/projects/[projectId]/team/actions.ts"),
  "utf8",
);

const client = readFileSync(
  join(process.cwd(), "src/app/[locale]/(app)/projects/[projectId]/team/team-client.tsx"),
  "utf8",
);

describe("Team & Roles role editing contract", () => {
  it("keeps project_role writable through the canonical member update action", () => {
    expect(actions).toContain("if (p.project_role !== undefined) patch.project_role");
    expect(actions).toContain('from("project_team_members").update(patch)');
  });

  it("documents the current UI gap until the list editor is wired", () => {
    expect(client).toContain('String(m.project_role ?? "—")');
    expect(client).toContain("updateProjectMemberAction");
  });
});
