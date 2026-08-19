import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cell = readFileSync(
  join(process.cwd(), "src/app/[locale]/(app)/projects/[projectId]/team/member-role-cell.tsx"),
  "utf8",
);

describe("member role cell", () => {
  it("uses the inline project role editor", () => {
    expect(cell).toContain("InlineProjectRoleEditor");
    expect(cell).toContain("projectRole");
    expect(cell).toContain("onSaved");
  });
});
