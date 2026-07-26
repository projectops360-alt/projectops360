// ============================================================================
// Acronym Intelligence — registry integrity (ACRONYM-REGISTRY-*)
// ============================================================================
// The corpus is data, and data rots quietly: a duplicate code shadows an entry,
// a missing ES string renders English inside a Spanish panel, a `relatedTerms`
// pointing at a code someone renamed drops a chip with no error. None of those
// throw at runtime, so each one gets a test.
// ============================================================================

import { describe, expect, it } from "vitest";
import {
  ACRONYM_ENTRIES,
  ACRONYM_REGISTRY_VERSION,
  allAcronymCodes,
  getAcronym,
  getAcronymsByCategory,
  getRelatedEntries,
  hasAcronym,
  hasMultipleFormulas,
  localize,
  resolveFormula,
} from "../registry";
import { ACRONYM_CATEGORIES, type AcronymEntry } from "../contracts";

// ── ACRONYM-REGISTRY-UNIQUE ─────────────────────────────────────────────────

describe("ACRONYM-REGISTRY-UNIQUE: codes are unique", () => {
  it("has no duplicate codes", () => {
    const codes = allAcronymCodes();
    const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
    expect(duplicates).toEqual([]);
  });

  it("indexes every entry — a duplicate would silently shorten the index", () => {
    expect(new Set(allAcronymCodes()).size).toBe(ACRONYM_ENTRIES.length);
  });

  it("resolves every code back to the entry that declared it", () => {
    for (const entry of ACRONYM_ENTRIES) {
      expect(getAcronym(entry.code)).toBe(entry);
    }
  });
});

// ── ACRONYM-REGISTRY-I18N ───────────────────────────────────────────────────

describe("ACRONYM-REGISTRY-I18N: every entry is fully bilingual (UX-012)", () => {
  const nonEmpty = (value: string) => typeof value === "string" && value.trim().length > 0;

  it.each(ACRONYM_ENTRIES.map((entry) => [entry.code, entry] as const))(
    "%s has EN and ES for every localized field",
    (_code, entry: AcronymEntry) => {
      for (const field of ["fullName", "shortDefinition", "fullDefinition"] as const) {
        expect(nonEmpty(entry[field].en)).toBe(true);
        expect(nonEmpty(entry[field].es)).toBe(true);
      }
      if (entry.interpretation) {
        expect(nonEmpty(entry.interpretation.en)).toBe(true);
        expect(nonEmpty(entry.interpretation.es)).toBe(true);
      }
      if (entry.example) {
        expect(nonEmpty(entry.example.en)).toBe(true);
        expect(nonEmpty(entry.example.es)).toBe(true);
      }
      if (entry.caveats) {
        expect(entry.caveats.en.length).toBeGreaterThan(0);
        // Caveat lists must be the same LENGTH in both locales: a missing ES
        // caveat is a warning a Spanish reader never sees.
        expect(entry.caveats.es.length).toBe(entry.caveats.en.length);
        expect(entry.caveats.en.every(nonEmpty)).toBe(true);
        expect(entry.caveats.es.every(nonEmpty)).toBe(true);
      }
      for (const variable of entry.formulaVariables ?? []) {
        expect(nonEmpty(variable.meaning.en)).toBe(true);
        expect(nonEmpty(variable.meaning.es)).toBe(true);
      }
      for (const formula of entry.formulas ?? []) {
        if (!formula.label) continue;
        expect(nonEmpty(formula.label.en)).toBe(true);
        expect(nonEmpty(formula.label.es)).toBe(true);
      }
    },
  );

  it("does not fall back to English text in a Spanish session", () => {
    // A definition identical in both locales would mean one was copied rather
    // than translated. Codes and formulas legitimately match; prose must not.
    const identical = ACRONYM_ENTRIES.filter(
      (entry) => entry.fullDefinition.en === entry.fullDefinition.es,
    );
    expect(identical.map((entry) => entry.code)).toEqual([]);
  });

  it("localize() picks ES for a Spanish locale and EN otherwise", () => {
    const entry = getAcronym("EAC")!;
    expect(localize(entry.fullName, "es")).toBe(entry.fullName.es);
    expect(localize(entry.fullName, "es-ES")).toBe(entry.fullName.es);
    expect(localize(entry.fullName, "en")).toBe(entry.fullName.en);
    // An unexpected locale falls back to English rather than rendering blank.
    expect(localize(entry.fullName, "fr")).toBe(entry.fullName.en);
  });
});

// ── ACRONYM-REGISTRY-RELATED ────────────────────────────────────────────────

describe("ACRONYM-REGISTRY-RELATED: relatedTerms point at real entries", () => {
  it("never references a code the registry does not define", () => {
    const dangling: string[] = [];
    for (const entry of ACRONYM_ENTRIES) {
      for (const code of entry.relatedTerms ?? []) {
        if (!hasAcronym(code)) dangling.push(`${entry.code} → ${code}`);
      }
    }
    expect(dangling).toEqual([]);
  });

  it("never lists itself as a related term", () => {
    const selfReferencing = ACRONYM_ENTRIES.filter((entry) =>
      (entry.relatedTerms ?? []).includes(entry.code),
    );
    expect(selfReferencing.map((entry) => entry.code)).toEqual([]);
  });

  it("resolves related terms without dropping any", () => {
    for (const entry of ACRONYM_ENTRIES) {
      expect(getRelatedEntries(entry)).toHaveLength(entry.relatedTerms?.length ?? 0);
    }
  });
});

// ── ACRONYM-REGISTRY-VERSION ────────────────────────────────────────────────

describe("ACRONYM-REGISTRY-VERSION: everything is versioned", () => {
  it("gives every entry a semver-shaped version", () => {
    for (const entry of ACRONYM_ENTRIES) {
      expect(entry.version, `${entry.code} has no version`).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("versions the corpus itself", () => {
    expect(ACRONYM_REGISTRY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ── ACRONYM-REGISTRY-COVERAGE ───────────────────────────────────────────────

describe("ACRONYM-REGISTRY-COVERAGE: the mandated vocabulary is present", () => {
  const REQUIRED: Record<string, string[]> = {
    evm: ["EVM", "BAC", "PV", "EV", "AC", "CV", "SV", "CPI", "SPI", "EAC", "ETC", "VAC", "TCPI"],
    budget: ["PMB", "CB", "CR", "MR", "CapEx", "OpEx"],
    schedule: ["CPM", "CP", "ES", "EF", "LS", "LF", "TF", "FF", "PERT"],
    risk: ["P", "I", "RE", "EMV", "RPN", "FMEA", "RAID"],
    resource: ["FTE", "RCI", "WIP", "SLA", "CT", "LT", "RT", "STP"],
    simulation: ["MCS", "P10", "P50", "P80", "P90", "Δ"],
    portfolio: ["PMO", "KPI", "OKR", "ROI", "NPV", "IRR", "WBS", "RAG"],
  };

  for (const [group, codes] of Object.entries(REQUIRED)) {
    it(`defines every ${group} term`, () => {
      const missing = codes.filter((code) => !hasAcronym(code));
      expect(missing).toEqual([]);
    });
  }

  it("assigns every entry to a declared category", () => {
    for (const entry of ACRONYM_ENTRIES) {
      expect(ACRONYM_CATEGORIES).toContain(entry.category);
    }
  });

  it("returns entries by category", () => {
    expect(getAcronymsByCategory("evm").map((entry) => entry.code)).toContain("CPI");
    expect(getAcronymsByCategory("schedule").map((entry) => entry.code)).toContain("TF");
  });
});

// ── ACRONYM-REGISTRY-UNKNOWN ────────────────────────────────────────────────

describe("ACRONYM-REGISTRY-UNKNOWN: an unknown code degrades, never throws", () => {
  it("returns undefined rather than throwing", () => {
    expect(() => getAcronym("NOT_A_REAL_CODE")).not.toThrow();
    expect(getAcronym("NOT_A_REAL_CODE")).toBeUndefined();
    expect(hasAcronym("NOT_A_REAL_CODE")).toBe(false);
  });

  it("is case-sensitive — 'eac' is not 'EAC'", () => {
    expect(getAcronym("EAC")).toBeDefined();
    expect(getAcronym("eac")).toBeUndefined();
  });

  it("resolves formulas for an undefined entry without throwing", () => {
    const resolved = resolveFormula(undefined, null);
    expect(resolved.used).toBeNull();
    expect(resolved.alternatives).toEqual([]);
    expect(resolved.isConfirmed).toBe(false);
  });

  it("returns no related entries for an undefined entry", () => {
    expect(getRelatedEntries(undefined)).toEqual([]);
  });
});

// ── ACRONYM-REGISTRY-FORMULA ────────────────────────────────────────────────

describe("ACRONYM-REGISTRY-FORMULA: formula ids are stable and unique per entry", () => {
  it("has unique formula ids within each entry", () => {
    for (const entry of ACRONYM_ENTRIES) {
      const ids = (entry.formulas ?? []).map((formula) => formula.id);
      expect(new Set(ids).size, `${entry.code} has duplicate formula ids`).toBe(ids.length);
    }
  });

  it("marks at most one default per entry", () => {
    for (const entry of ACRONYM_ENTRIES) {
      const defaults = (entry.formulas ?? []).filter((formula) => formula.isDefault);
      expect(defaults.length, `${entry.code} has ${defaults.length} defaults`).toBeLessThanOrEqual(1);
    }
  });

  it("knows which terms have several standard formulas", () => {
    expect(hasMultipleFormulas(getAcronym("EAC"))).toBe(true);
    expect(hasMultipleFormulas(getAcronym("TF"))).toBe(true);
    expect(hasMultipleFormulas(getAcronym("CPI"))).toBe(false);
  });
});
