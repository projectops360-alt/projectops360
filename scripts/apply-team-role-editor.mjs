import { readFileSync, writeFileSync } from "node:fs";

const path = "src/app/[locale]/(app)/projects/[projectId]/team/team-client.tsx";
let source = readFileSync(path, "utf8");

const importAnchor = 'import { RoleBoard } from "./role-board";';
const importLine = 'import { MemberRoleCell } from "./member-role-cell";';
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error("role board import anchor not found");
  source = source.replace(importAnchor, `${importAnchor}\n${importLine}`);
}

const oldCell = `<div className="text-foreground">{String(m.project_role ?? "—")}</div>\n                    <div className="text-[11px] text-muted-foreground">{[m.delivery_role, m.governance_role].filter(Boolean).join(" · ") || "—"}</div>`;
const newCell = `<MemberRoleCell\n                      projectId={p.projectId}\n                      memberId={id}\n                      projectRole={m.project_role ? String(m.project_role) : null}\n                      deliveryRole={m.delivery_role ? String(m.delivery_role) : null}\n                      governanceRole={m.governance_role ? String(m.governance_role) : null}\n                      isEs={isEs}\n                      onSaved={refresh}\n                    />`;
if (!source.includes(newCell)) {
  if (!source.includes(oldCell)) throw new Error("member role cell anchor not found");
  source = source.replace(oldCell, newCell);
}

writeFileSync(path, source);
console.log("Team role editor integrated.");
