import { describe, it, expect } from "vitest";
import {
  mergeDirectory,
  classifyContactType,
  normalizeEmail,
  unassignedLabel,
} from "../directory";

// ============================================================================
// CAP-044 / PD-014 — Unified People Directory. People from different source
// tables become ONE typed identity, de-duplicated by email. No guessing.
// ============================================================================

describe("classifyContactType", () => {
  it("maps external contact types to directory person types", () => {
    expect(classifyContactType("client")).toBe("client");
    expect(classifyContactType("vendor")).toBe("vendor");
    expect(classifyContactType("subcontractor")).toBe("vendor");
    expect(classifyContactType("sponsor")).toBe("sponsor");
    expect(classifyContactType("approver")).toBe("approver");
    expect(classifyContactType("regulator")).toBe("external_contact");
    expect(classifyContactType(null)).toBe("external_contact");
  });
});

describe("normalizeEmail", () => {
  it("lowercases/trims and treats empty as null", () => {
    expect(normalizeEmail("  Ana@Foo.COM ")).toBe("ana@foo.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("mergeDirectory", () => {
  it("unifies an internal user and an external contact that share an email into one person", () => {
    const people = mergeDirectory({
      internal: [{ id: "u1", display_name: "Ana López", email: "ana@foo.com" }],
      external: [{ id: "c1", name: "Ana L.", email: "ANA@foo.com", company_name: "Foo Inc", contact_type: "client" }],
      stakeholders: [],
    });
    expect(people).toHaveLength(1);
    const ana = people[0];
    // Internal user wins identity + type.
    expect(ana.type).toBe("internal_user");
    expect(ana.isInternalUser).toBe(true);
    expect(ana.displayName).toBe("Ana López");
    // Both source ids are preserved (one connected person, many roles).
    expect(ana.sources.userId).toBe("u1");
    expect(ana.sources.externalContactId).toBe("c1");
    expect(ana.company).toBe("Foo Inc");
  });

  it("keeps people without email distinct (never fuzzy-merges by name)", () => {
    const people = mergeDirectory({
      internal: [],
      external: [{ id: "c1", name: "Carlos", email: null, company_name: null, contact_type: "vendor" }],
      stakeholders: [{ id: "s1", name: "Carlos", email: null }],
    });
    expect(people).toHaveLength(2);
  });

  it("classifies and includes stakeholders + external contacts", () => {
    const people = mergeDirectory({
      internal: [{ id: "u1", display_name: "PM", email: "pm@x.io" }],
      external: [{ id: "c1", name: "Vendor Co", email: "v@x.io", company_name: null, contact_type: "vendor" }],
      stakeholders: [{ id: "s1", name: "Sponsor S", email: "s@x.io" }],
    });
    expect(people.map((p) => p.type).sort()).toEqual(["internal_user", "stakeholder", "vendor"]);
  });

  it("sorts by display name and produces stable de-dupe keys", () => {
    const people = mergeDirectory({
      internal: [{ id: "u1", display_name: "Zoe", email: "zoe@x.io" }],
      external: [{ id: "c1", name: "Ana", email: "ana@x.io", company_name: null, contact_type: "client" }],
      stakeholders: [],
    });
    expect(people[0].displayName).toBe("Ana");
    expect(people[0].key).toBe("ana@x.io");
  });
});

describe("unassignedLabel", () => {
  it("is intentional, bilingual, and not an error", () => {
    expect(unassignedLabel("en")).toBe("Unassigned");
    expect(unassignedLabel("es")).toBe("Sin asignar");
  });
});
