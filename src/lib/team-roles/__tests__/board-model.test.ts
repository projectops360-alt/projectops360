import { describe, it, expect } from "vitest";
import {
  buildBuckets,
  computeCompletenessFromRows,
  hasIdentity,
  isDuplicateAssignment,
  personKey,
  reduceAssign,
  reduceMove,
  reduceRemove,
  rowPersonKey,
  type PersonRef,
  type Row,
} from "../board-model";

// ============================================================================
// TEAM-ROLES-BOARD — pure model guard
// Buckets by role, missing/required buckets, identity-aware completeness
// (placeholders are NOT members), dedup, and the assign/move/remove reducers.
// ============================================================================

const CRITICAL = ["Project Manager", "Sponsor", "Business Owner"];
let seq = 0;
const nid = () => `tmp-${++seq}`;

function row(o: Partial<Row> = {}): Row {
  return { id: o.id ?? `r-${++seq}`, status: "active", project_role: null, user_id: null, external_contact_id: null, display_name: null, ...o };
}
const person = (id: string, name: string): PersonRef => ({ kind: "user", id, name });

describe("identity predicates", () => {
  it("hasIdentity true only with a person", () => {
    expect(hasIdentity(row({ project_role: "PM" }))).toBe(false);
    expect(hasIdentity(row({ project_role: "PM", user_id: "u1" }))).toBe(true);
    expect(hasIdentity(row({ display_name: "Ext Co" }))).toBe(true);
  });
  it("rowPersonKey prefers user then external then name", () => {
    expect(rowPersonKey(row({ user_id: "u1" }))).toBe("user:u1");
    expect(rowPersonKey(row({ external_contact_id: "e1" }))).toBe("ext:e1");
    expect(rowPersonKey(row({ display_name: "María" }))).toBe("name:maría");
    expect(rowPersonKey(row())).toBeNull();
  });
});

describe("buildBuckets", () => {
  it("renders a bucket per existing role and per required role (missing)", () => {
    const rows = [row({ project_role: "QA Tester", user_id: "u1", display_name: "Ana" })];
    const buckets = buildBuckets(rows, CRITICAL);
    const roles = buckets.map((b) => b.role);
    expect(roles).toContain("QA Tester");
    for (const req of CRITICAL) expect(roles).toContain(req);
    const sponsor = buckets.find((b) => b.role === "Sponsor")!;
    expect(sponsor.missing).toBe(true);
    expect(sponsor.count).toBe(0);
    expect(sponsor.isRequired).toBe(true);
  });

  it("a role placeholder with no person is a missing bucket, not an assignment", () => {
    const rows = [row({ project_role: "Sponsor" })]; // placeholder only
    const b = buildBuckets(rows, CRITICAL).find((x) => x.role === "Sponsor")!;
    expect(b.count).toBe(0);
    expect(b.missing).toBe(true);
    expect(b.placeholderRowIds.length).toBe(1);
  });

  it("groups multiple people under one role bucket", () => {
    const rows = [
      row({ project_role: "Developer", user_id: "u1", display_name: "Ana" }),
      row({ project_role: "developer", user_id: "u2", display_name: "Beto" }),
    ];
    const b = buildBuckets(rows, CRITICAL).find((x) => x.role.toLowerCase() === "developer")!;
    expect(b.count).toBe(2);
    expect(b.missing).toBe(false);
  });

  it("required roles come first, in config order", () => {
    const rows = [row({ project_role: "Developer", user_id: "u1", display_name: "Ana" })];
    const buckets = buildBuckets(rows, CRITICAL);
    expect(buckets.slice(0, 3).map((b) => b.role)).toEqual(CRITICAL);
  });
});

describe("computeCompletenessFromRows — placeholders never count as members", () => {
  it("a project full of empty placeholders has 0 members and 0%", () => {
    const rows = CRITICAL.map((r) => row({ project_role: r })); // all empty
    const c = computeCompletenessFromRows(rows, CRITICAL);
    expect(c.totalMembers).toBe(0);
    expect(c.score).toBe(0);
    expect(c.missingCritical).toEqual(CRITICAL); // empty placeholder does NOT cover the role
  });

  it("counts distinct people, and a role is covered only with a real person", () => {
    const rows = [
      row({ project_role: "Project Manager", user_id: "u1", display_name: "Ana", permission_level: "project_manager" }),
      row({ project_role: "Sponsor" }), // placeholder → still missing
    ];
    const c = computeCompletenessFromRows(rows, CRITICAL);
    expect(c.totalMembers).toBe(1);
    expect(c.hasPM).toBe(true);
    expect(c.missingCritical).toContain("Sponsor");
    expect(c.missingCritical).not.toContain("Project Manager");
  });

  it("one person in two roles counts as one member", () => {
    const rows = [
      row({ project_role: "Project Manager", user_id: "u1", display_name: "Ana" }),
      row({ project_role: "Sponsor", user_id: "u1", display_name: "Ana" }),
    ];
    expect(computeCompletenessFromRows(rows, CRITICAL).totalMembers).toBe(1);
  });
});

describe("dedup", () => {
  it("detects the same person already in the same role", () => {
    const rows = [row({ project_role: "Sponsor", user_id: "u1", display_name: "Ana" })];
    expect(isDuplicateAssignment(rows, "sponsor", personKey(person("u1", "Ana")))).toBe(true);
    expect(isDuplicateAssignment(rows, "Sponsor", personKey(person("u2", "Beto")))).toBe(false);
  });
});

describe("reduceAssign", () => {
  it("fills an empty placeholder (no new row, keeps id)", () => {
    const rows = [row({ id: "ph", project_role: "Sponsor" })];
    const res = reduceAssign(rows, "Sponsor", person("u1", "Ana"), nid);
    expect(res.duplicate).toBe(false);
    expect(res.op).toMatchObject({ kind: "fill", rowId: "ph" });
    expect(res.rows.length).toBe(1);
    expect(hasIdentity(res.rows[0])).toBe(true);
  });

  it("inserts a new row when no placeholder exists", () => {
    const rows: Row[] = [];
    const res = reduceAssign(rows, "Developer", person("u2", "Beto"), nid);
    expect(res.op?.kind).toBe("insert");
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].project_role).toBe("Developer");
  });

  it("ignores an exact duplicate", () => {
    const rows = [row({ project_role: "Sponsor", user_id: "u1", display_name: "Ana" })];
    const res = reduceAssign(rows, "Sponsor", person("u1", "Ana"), nid);
    expect(res.duplicate).toBe(true);
    expect(res.op).toBeNull();
    expect(res.rows.length).toBe(1);
  });

  it("allows the same person in a different role (multi-role)", () => {
    const rows = [row({ project_role: "Project Manager", user_id: "u1", display_name: "Ana" })];
    const res = reduceAssign(rows, "Sponsor", person("u1", "Ana"), nid);
    expect(res.duplicate).toBe(false);
    expect(res.rows.length).toBe(2);
  });
});

describe("reduceMove", () => {
  it("moves a chip to another role (keeps the same row id → RACI-safe)", () => {
    const rows = [row({ id: "r1", project_role: "QA Tester", user_id: "u1", display_name: "Ana" })];
    const res = reduceMove(rows, "r1", "Business Analyst");
    expect(res.op).toMatchObject({ kind: "move", rowId: "r1", toRole: "Business Analyst", fromRole: "QA Tester" });
    expect(res.rows[0].project_role).toBe("Business Analyst");
  });
  it("ignores a move that would duplicate the person in the destination", () => {
    const rows = [
      row({ id: "r1", project_role: "QA Tester", user_id: "u1", display_name: "Ana" }),
      row({ id: "r2", project_role: "Dev", user_id: "u1", display_name: "Ana" }),
    ];
    const res = reduceMove(rows, "r1", "Dev");
    expect(res.duplicate).toBe(true);
    expect(res.op).toBeNull();
  });
});

describe("reduceRemove", () => {
  it("reverts to a placeholder when removing the last person of a role (keeps bucket)", () => {
    const rows = [row({ id: "r1", project_role: "Sponsor", user_id: "u1", display_name: "Ana" })];
    const res = reduceRemove(rows, "r1");
    expect(res.op?.kind).toBe("clearIdentity");
    expect(hasIdentity(res.rows[0])).toBe(false);
    expect(res.rows[0].project_role).toBe("Sponsor"); // bucket stays
  });
  it("soft-removes an extra assignment when siblings remain", () => {
    const rows = [
      row({ id: "r1", project_role: "Dev", user_id: "u1", display_name: "Ana" }),
      row({ id: "r2", project_role: "Dev", user_id: "u2", display_name: "Beto" }),
    ];
    const res = reduceRemove(rows, "r1");
    expect(res.op?.kind).toBe("removeRow");
    expect(res.rows.find((r) => r.id === "r1")!.status).toBe("removed");
  });
});
