import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const editor = readFileSync(
  join(process.cwd(), "src/app/[locale]/(app)/projects/[projectId]/team/inline-project-role-editor.tsx"),
  "utf8",
);

describe("inline project role editor", () => {
  it("writes through the canonical member action and supports custom roles", () => {
    expect(editor).toContain("updateProjectMemberAction");
    expect(editor).toContain("project_role: role.trim()");
    expect(editor).toContain("PROJECT_ROLES.map");
  });

  it("saves on enter or blur", () => {
    expect(editor).toContain("onBlur={save}");
    expect(editor).toContain('event.key === "Enter"');
  });
});
