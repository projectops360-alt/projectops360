import { describe, it, expect } from "vitest";
import { expandQueryForLexical, normalizeTerm } from "../language";
import { dedupeByPackage } from "../retrieval";
import type { RetrievedChunk } from "../types";

describe("normalizeTerm", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeTerm("Gestión de Proyéctos")).toBe("gestion de proyectos");
  });
});

describe("expandQueryForLexical", () => {
  it("adds the English equivalent for a Spanish PM term", () => {
    const out = expandQueryForLexical("¿Qué puede ver un Gerente de Proyecto?").toLowerCase();
    expect(out).toContain("project manager");
    expect(out).toContain("pm");
  });

  it("adds the Spanish equivalent for an English PM term", () => {
    const out = expandQueryForLexical("What can a Project Manager see?").toLowerCase();
    expect(out).toContain("gerente de proyecto");
  });

  it("keeps the original query intact", () => {
    const q = "What can a Project Manager see?";
    expect(expandQueryForLexical(q).startsWith(q)).toBe(true);
  });

  it("expands acronyms with word boundaries (PMO, WBS↔EDT)", () => {
    const out = expandQueryForLexical("What is the PMO?").toLowerCase();
    expect(out).toContain("project management office");
    expect(out).toContain("oficina de gestión de proyectos");

    const wbs = expandQueryForLexical("explain the WBS").toLowerCase();
    expect(wbs).toContain("edt");
  });

  it("does not expand when no PM term is present", () => {
    const q = "hello there friend";
    expect(expandQueryForLexical(q)).toBe(q);
  });

  it("does not match an acronym inside an unrelated word", () => {
    // 'pm' must not trigger inside 'experiment' / 'compmassion'
    const out = expandQueryForLexical("the experiment compass");
    expect(out).toBe("the experiment compass");
  });
});

describe("dedupeByPackage", () => {
  function chunk(id: string, pkg: string, fused: number): RetrievedChunk {
    return {
      chunkId: id, packageId: pkg, versionId: `v-${id}`, slug: pkg,
      language: "en", title: pkg, body: pkg, confidenceTier: "verified", fused,
    };
  }
  it("keeps only the first (highest-ranked) chunk per package", () => {
    const out = dedupeByPackage([
      chunk("a", "pm-can-see", 0.9),
      chunk("b", "pm-can-see", 0.5), // same package, lower rank → dropped
      chunk("c", "roles", 0.4),
    ]);
    expect(out.map((c) => c.chunkId)).toEqual(["a", "c"]);
  });
});
