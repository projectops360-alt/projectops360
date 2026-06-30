import { describe, it, expect } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import {
  PROTECTED_MESSAGE_LABELS,
  CANONICAL_GLOSSARY,
  isCanonicalUntranslatable,
} from "@/lib/i18n/glossary";

// ============================================================================
// UX-012 — Protected, high-visibility labels (nav, Workboard, status, Project
// Memory…) must stay in the CANONICAL language. These fail if a reviewer-flagged
// label regresses to the wrong language (e.g. Spanish nav showing "Execution
// Map", or Workboard reverting to English in ES).
// ============================================================================

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

describe("UX-012 — protected labels match the canonical glossary", () => {
  for (const [path, term] of Object.entries(PROTECTED_MESSAGE_LABELS)) {
    it(`EN "${path}" = "${term.en}"`, () => {
      expect(get(en, path)).toBe(term.en);
    });
    it(`ES "${path}" = "${term.es}"`, () => {
      expect(get(es, path)).toBe(term.es);
    });
  }

  it("the specific Spanglish that was fixed stays fixed (backToExecutionMap is Spanish in ES)", () => {
    expect(get(es, "livingGraph.backToExecutionMap")).toBe("Mapa de Ejecución");
    expect(get(es, "livingGraph.backToExecutionMap")).not.toBe("Execution Map");
  });
});

describe("UX-012 — glossary is internally consistent", () => {
  it("translated terms actually differ between EN and ES (except canonical names)", () => {
    for (const [key, term] of Object.entries(CANONICAL_GLOSSARY)) {
      if (term.en === term.es) {
        // Identical is only allowed for canonical/untranslatable terms.
        expect(isCanonicalUntranslatable(term.en), `Glossary term "${key}" is identical EN/ES but not canonical`).toBe(true);
      }
    }
  });

  it("recognizes product names and acronyms as canonical (not Spanglish)", () => {
    expect(isCanonicalUntranslatable("Isabella")).toBe(true);
    expect(isCanonicalUntranslatable("BIM")).toBe(true);
    expect(isCanonicalUntranslatable("ProjectOps360°")).toBe(true);
    expect(isCanonicalUntranslatable("Living Graph")).toBe(true);
    // A normal English phrase is NOT canonical — it would be Spanglish in ES.
    expect(isCanonicalUntranslatable("Execution Map")).toBe(false);
    expect(isCanonicalUntranslatable("Add member")).toBe(false);
  });
});
