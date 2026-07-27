// ============================================================================
// EKI Macrophase 1 — the Enterprise Trust programme is a first-class section
// Guard: PRODUCT-BRAIN-TRUST-SECTION
// ============================================================================
// The Product Brain groups documents into navigation sections by id. Without a
// rule for the `trust/` namespace its documents fall into the catch-all "Docs"
// bucket, where their numbering (00, 01, 02…) collides with the top-level
// overview documents and the reading order the programme depends on is lost.
// ============================================================================

import { describe, expect, it } from "vitest";
import { getAllProductBrainDocs, getProductBrainIndex, sectionRank } from "../loader";

describe("Enterprise Trust section (PRODUCT-BRAIN-TRUST-SECTION)", () => {
  const docs = getAllProductBrainDocs();
  const trustDocs = docs.filter((doc) => doc.id.startsWith("trust/"));

  it("bundles the Enterprise Trust documents", () => {
    expect(trustDocs.length).toBeGreaterThanOrEqual(5);
  });

  it("groups them under their own section, never the catch-all", () => {
    for (const doc of trustDocs) {
      expect(doc.section).toBe("Enterprise Trust");
    }
    expect(trustDocs.some((doc) => doc.section === "Docs")).toBe(false);
  });

  it("orders the section deterministically by document number", () => {
    const ordered = getProductBrainIndex()
      .filter((doc) => doc.section === "Enterprise Trust")
      .map((doc) => doc.id);
    expect(ordered).toEqual([...ordered].sort((left, right) => left.localeCompare(right)));
  });

  it("bundles the EKI architecture decisions alongside the existing ADRs", () => {
    // A second ADR registry would itself be a second source of truth, so the
    // trust ADRs live in the repository's single ADR directory.
    const adrIds = docs.filter((doc) => doc.section === "ADRs").map((doc) => doc.id);
    for (const number of ["013", "014", "015", "016", "017", "018", "019"]) {
      expect(adrIds.some((id) => id.includes(`ADR-${number}`))).toBe(true);
    }
  });

  it("places the section in a stable position in the navigation", () => {
    expect(sectionRank("Enterprise Trust")).toBeLessThan(sectionRank("Docs"));
    expect(sectionRank("Enterprise Trust")).toBeGreaterThan(sectionRank("Overview"));
  });
});
