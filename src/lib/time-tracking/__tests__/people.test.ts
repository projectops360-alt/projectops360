import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// Time Tracking — "Whose effort" picker (REG-043)
// ============================================================================
// Guard TIME-TRACKING-PEOPLE-SOURCE. Two defects, one symptom: the owner of the
// Agro project saw only "Myself" and "Efrain Prada" — the same human twice —
// while eight people were on the project.
//
//   1. The list came from `profiles WHERE organization_id = org`. That column is
//      a profile's HOME org, not its memberships. Seven of Agro's eight members
//      have a different home org, so the query returned exactly one row. Same
//      root as REG-038, which had already documented this for report owners.
//   2. "Myself" was rendered as its own option beside the caller's real row.
//
// Membership is therefore answered by PROJECT membership, and the caller is
// folded INTO that list rather than bolted on beside it.
// ============================================================================

import {
  buildTimeLogPeople,
  membersWithoutLogin,
  filterPeople,
  PEOPLE_SEARCH_THRESHOLD,
  type RawProjectMember,
} from "../people";

const SELF = "fcc4721e-773b-4b88-9f3a-f80eb8780ebd"; // Efrain
const PAUL = "18414093-0748-4e38-8de7-de7efa5d0102";
const VIVEKA = "3cb7c26e-a18c-4e0e-906c-9f733e22a9f5";

/** The real Agro rows, including Paul's three and Efrain's "removed" one. */
const AGRO_MEMBERS: RawProjectMember[] = [
  { user_id: "569cee88", display_name: "Cesar Palacios", project_role: "Developer", status: "active" },
  { user_id: SELF, display_name: "Efrain Prada", project_role: "Business Owner", status: "removed" },
  { user_id: "67cd87ab", display_name: "Giovanna Rotolo", project_role: "Developer", status: "active" },
  { user_id: "2fc3ee40", display_name: "Jose Rodriguez", project_role: "Business Owner", status: "active" },
  { user_id: "30c3a071", display_name: "Juan Gutierrez", project_role: "Developer", status: "active" },
  { user_id: PAUL, display_name: "Paul", project_role: "Developer", status: "active" },
  { user_id: PAUL, display_name: "Paul", project_role: "Project Manager", status: "removed" },
  { user_id: PAUL, display_name: "Paul", project_role: "Team leader", status: "active" },
  { user_id: VIVEKA, display_name: "Viveka", project_role: "Project Manager", status: "active" },
  { user_id: "45aac3a3", display_name: "Yihad Kade", project_role: "Sponsor", status: "active" },
];

const build = (members: RawProjectMember[] = AGRO_MEMBERS, selfName = "Efrain Prada") =>
  buildTimeLogPeople({
    members,
    nameById: new Map(),
    emailById: new Map([[SELF, "efrain.pradas@gmail.com"], [PAUL, "paul.bravo@agrocappture.com"]]),
    selfId: SELF,
    selfName,
    selfEmail: "efrain.pradas@gmail.com",
  });

describe("1 — the caller appears exactly once", () => {
  it("never yields two entries for the same human", () => {
    const people = build();
    expect(people.filter((p) => p.id === SELF)).toHaveLength(1);
  });

  it("marks the caller so the UI can label them instead of adding a second row", () => {
    const people = build();
    expect(people.filter((p) => p.isSelf)).toHaveLength(1);
    expect(people[0].isSelf).toBe(true);
  });

  it("keeps the caller even when their project row was removed", () => {
    // Efrain's Agro membership is status="removed", but he is the org owner and
    // must still be able to log his own time.
    expect(AGRO_MEMBERS.find((m) => m.user_id === SELF)?.status).toBe("removed");
    expect(build().some((p) => p.id === SELF)).toBe(true);
  });
});

describe("2 — the owner sees every active member of the project", () => {
  it("returns the eight real people of Agro", () => {
    const names = build().map((p) => p.name);
    expect(names).toEqual([
      "Efrain Prada", // self first
      "Cesar Palacios",
      "Giovanna Rotolo",
      "Jose Rodriguez",
      "Juan Gutierrez",
      "Paul",
      "Viveka",
      "Yihad Kade",
    ]);
  });

  it("collapses one person holding several project roles into one option", () => {
    // Paul has three rows (Developer, Project Manager, Team leader).
    expect(AGRO_MEMBERS.filter((m) => m.user_id === PAUL)).toHaveLength(3);
    expect(build().filter((p) => p.id === PAUL)).toHaveLength(1);
  });

  it("sorts the caller first and everyone else alphabetically", () => {
    const people = build();
    expect(people[0].isSelf).toBe(true);
    const rest = people.slice(1).map((p) => p.name);
    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)));
  });

  it("carries the email as secondary information when there is a login", () => {
    expect(build().find((p) => p.id === PAUL)?.email).toBe("paul.bravo@agrocappture.com");
  });
});

describe("7 — inactive members are excluded", () => {
  it("drops rows whose membership was removed", () => {
    const people = build([
      { user_id: "ghost", display_name: "Ex Member", project_role: "Developer", status: "removed" },
    ]);
    expect(people.some((p) => p.name === "Ex Member")).toBe(false);
    expect(people).toHaveLength(1); // only the caller
  });
});

describe("4 & 5 — nobody from another project or organization", () => {
  it("returns only what the project-scoped query supplied, plus the caller", () => {
    // The scoping itself is the query's job (asserted below); this proves the
    // builder never invents a person the query did not return.
    const people = build([
      { user_id: "only-member", display_name: "Only Member", project_role: null, status: "active" },
    ]);
    expect(people.map((p) => p.id).sort()).toEqual([SELF, "only-member"].sort());
  });
});

describe("6 — people with no login", () => {
  it("are excluded from the picker, because user_id cannot hold them", () => {
    // subtask_time_entries.user_id is NOT NULL → auth.users. A contact with no
    // account has nothing storable, so offering them would create a save that
    // always fails.
    const members: RawProjectMember[] = [
      { user_id: null, display_name: "Cuadrilla Norte", project_role: "Crew", status: "active" },
    ];
    expect(build(members).some((p) => p.name === "Cuadrilla Norte")).toBe(false);
  });

  it("are reported rather than silently dropped", () => {
    const members: RawProjectMember[] = [
      { user_id: null, display_name: "Cuadrilla Norte", project_role: "Crew", status: "active" },
      { user_id: null, display_name: "Proveedor X", project_role: "Vendor", status: "removed" },
    ];
    expect(membersWithoutLogin(members)).toEqual(["Cuadrilla Norte"]);
  });
});

describe("a thin profile never disappears", () => {
  it("falls back to email, then to a short id, but stays selectable", () => {
    const people = buildTimeLogPeople({
      members: [{ user_id: "no-name-user", display_name: null, project_role: null, status: "active" }],
      nameById: new Map(),
      emailById: new Map([["no-name-user", "someone@example.com"]]),
      selfId: SELF,
      selfName: "Efrain Prada",
      selfEmail: null,
    });
    expect(people.some((p) => p.id === "no-name-user")).toBe(true);
    expect(people.find((p) => p.id === "no-name-user")?.name).toBe("someone@example.com");
  });

  it("resolves names by id when the membership row has none", () => {
    const people = buildTimeLogPeople({
      members: [{ user_id: "u1", display_name: null, project_role: null, status: "active" }],
      nameById: new Map([["u1", "Resolved By Id"]]),
      emailById: new Map(),
      selfId: SELF,
      selfName: "Efrain Prada",
      selfEmail: null,
    });
    expect(people.find((p) => p.id === "u1")?.name).toBe("Resolved By Id");
  });
});

describe("search", () => {
  it("only becomes necessary past eight options", () => {
    expect(PEOPLE_SEARCH_THRESHOLD).toBe(8);
    expect(build()).toHaveLength(8); // Agro sits exactly at the threshold
  });

  it("matches name, email and role, ignoring case and accents", () => {
    const people = build();
    expect(filterPeople(people, "giovanna").map((p) => p.name)).toEqual(["Giovanna Rotolo"]);
    expect(filterPeople(people, "AGROCAPPTURE").map((p) => p.name)).toEqual(["Paul"]);
    expect(filterPeople(people, "sponsor").map((p) => p.name)).toEqual(["Yihad Kade"]);
    expect(filterPeople(people, "")).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// The scoping and de-duplication that live in the query and the component
// ---------------------------------------------------------------------------

describe("the query is scoped, and the old source is gone", () => {
  const root = join(process.cwd(), "src");
  const read = (p: string) => readFileSync(join(root, p), "utf8");

  it("reads membership from project_team_members, scoped to org AND project", () => {
    const service = read("lib/time-tracking/service.ts");
    const start = service.indexOf("export async function listProjectTimeLogPeople");
    expect(start).toBeGreaterThan(-1);
    const body = service.slice(start, service.indexOf("\n}", service.indexOf("return {", start)));
    expect(body).toContain('.from("project_team_members")');
    expect(body).toContain('.eq("project_id", projectId)');
    expect(body).toContain('.eq("organization_id", org.organizationId)');
    expect(body).toContain('.neq("status", "removed")');
  });

  it("never re-filters profiles by organization_id when resolving names (REG-038)", () => {
    // resolveUserNames looks people up by id precisely because a profile's home
    // org is not every org they work in.
    const service = read("lib/time-tracking/service.ts");
    expect(service).toContain("resolveUserNames(supabase, ids)");
    expect(service).not.toMatch(/from\("profiles"\)[\s\S]{0,200}eq\("organization_id"/);
  });

  it("no longer hands the picker a home-org profile list", () => {
    expect(read("components/roadmap/task-form-dialog.tsx")).not.toContain("people={options?.people");
    expect(read("components/task-execution-map/subtask-form-dialog.tsx")).not.toContain("people={owners}");
  });

  it("resolves the work item first, so the task id is the authorization boundary", () => {
    const actions = read("lib/time-tracking/actions.ts");
    const start = actions.indexOf("export async function listTimeLogPeopleAction");
    const body = actions.slice(start, actions.indexOf("\n}\n", start));
    expect(body).toContain("await getOrgContext()");
    expect(body).toContain("loadWorkItem(");
    expect(body).toContain('return { error: "task_not_found" }');
  });
});

describe("3 — a contributor only gets themselves", () => {
  it("returns the caller alone when they may not log for others", () => {
    const actions = readFileSync(
      join(process.cwd(), "src", "lib", "time-tracking", "actions.ts"),
      "utf8",
    );
    const start = actions.indexOf("export async function listTimeLogPeopleAction");
    const body = actions.slice(start, actions.indexOf("\n}\n", start));
    // The roster is never built for someone who cannot use it.
    expect(body).toMatch(/if \(!canLogForOthers\) \{[\s\S]*?people: \[\{ \.\.\.self/);
  });
});

describe("the picker renders one entry per human", () => {
  const dialog = readFileSync(
    join(process.cwd(), "src", "components", "task-execution-map", "time-entry-dialog.tsx"),
    "utf8",
  );

  it("has no standalone Myself option beside the caller's own row", () => {
    // This exact line was the duplicate the user reported.
    expect(dialog).not.toContain('<option value="">{t("forUserSelf")}</option>');
  });

  it("labels the caller inline instead", () => {
    expect(dialog).toMatch(/person\.isSelf \? `\$\{person\.name\} \(\$\{t\("forUserSelf"\)\}\)`/);
  });

  it("shows loading, error and empty states rather than pretending", () => {
    expect(dialog).toContain('peopleStatus === "loading"');
    expect(dialog).toContain('peopleStatus === "error"');
    expect(dialog).toContain("forUserEmpty");
    expect(dialog).toContain("errors.people_unavailable");
  });

  it("offers search only past the threshold", () => {
    expect(dialog).toContain("PEOPLE_SEARCH_THRESHOLD");
    expect(dialog).toContain("filterPeople(");
  });
});
