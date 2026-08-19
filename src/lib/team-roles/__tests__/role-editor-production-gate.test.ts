import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const client = readFileSync(
  join(process.cwd(), "src/app/[locale]/(app)/projects/[projectId]/team/team-client.tsx"),
  "utf8",
);

describe("role editor production gate", () => {
  it("requires the editable role cell to be wired into Team & Roles List", () => {
    expect(client).toContain('import { MemberRoleCell } from "./member-role-cell";');
    expect(client).toContain("<MemberRoleCell");
  });
});
