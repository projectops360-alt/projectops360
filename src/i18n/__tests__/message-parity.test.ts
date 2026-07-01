import { describe, it, expect } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

// ============================================================================
// UX-012 — No Spanglish. The #1 future cause of mixed-language UI is a message
// key that exists in one locale but not the other: the missing side silently
// falls back to the other language. These tests fail if EN/ES ever drift apart.
// ============================================================================

type Json = Record<string, unknown>;

function keyPaths(obj: Json, prefix = ""): string[] {
  let out: string[] = [];
  for (const k of Object.keys(obj)) {
    const np = prefix ? `${prefix}.${k}` : k;
    const v = (obj as Record<string, unknown>)[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out = out.concat(keyPaths(v as Json, np));
    } else {
      out.push(np);
    }
  }
  return out;
}

describe("UX-012 — EN/ES message dictionaries are in parity", () => {
  const enKeys = new Set(keyPaths(en as Json));
  const esKeys = new Set(keyPaths(es as Json));

  it("every EN key exists in ES (no English fallback in Spanish UI)", () => {
    const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));
    expect(missingInEs, `Keys missing in es.json: ${missingInEs.join(", ")}`).toEqual([]);
  });

  it("every ES key exists in EN (no Spanish fallback in English UI)", () => {
    const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));
    expect(missingInEn, `Keys missing in en.json: ${missingInEn.join(", ")}`).toEqual([]);
  });

  it("has the same number of leaf keys in both locales", () => {
    expect(esKeys.size).toBe(enKeys.size);
  });
});
