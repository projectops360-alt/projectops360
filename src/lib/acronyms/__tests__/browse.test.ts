// ============================================================================
// CAP-050 — the corpus is reachable without a simulation
// Guard: ACRONYM-GLOSSARY-REACHABLE
// ============================================================================
// The reported problem was not "EAC is undefined". It was "I cannot find the
// acronyms anywhere". `<AcronymTerm>` only reaches a user who already has the
// right number on screen, which required building a scenario, running it, and
// hovering the correct cell. This module backs a reference that opens from the
// toolbar with no data at all.
//
// Search covers name and definition, not just the code, because the person who
// opens a glossary usually knows the concept and not the abbreviation — that is
// why they opened it.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  acronymCount,
  categoryLabelKey,
  groupAcronymsByCategory,
  searchAcronyms,
} from "../browse";
import { ACRONYM_ENTRIES } from "../registry";
import { ACRONYM_CATEGORIES } from "../contracts";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

describe("acronym browsing (ACRONYM-GLOSSARY-REACHABLE)", () => {
  it("an empty search returns the whole corpus", () => {
    expect(searchAcronyms("", "es")).toHaveLength(ACRONYM_ENTRIES.length);
    expect(acronymCount()).toBe(ACRONYM_ENTRIES.length);
  });

  it("an exact code match sorts first", () => {
    // Typing "CPI" must not bury CPI under every entry that mentions it.
    const results = searchAcronyms("CPI", "en");
    expect(results[0]?.code).toBe("CPI");
  });

  it("finds a term by its name, not only its code", () => {
    // The direction that matters: you know the concept, not the abbreviation.
    const results = searchAcronyms("estimate at completion", "en");
    expect(results.map((entry) => entry.code)).toContain("EAC");
  });

  it("search ignores accents and case", () => {
    const withAccent = searchAcronyms("valoración", "es").map((entry) => entry.code);
    const without = searchAcronyms("VALORACION", "es").map((entry) => entry.code);
    expect(without).toEqual(withAccent);
  });

  it("a search with no match returns nothing rather than everything", () => {
    // Falling back to the full list would look like the search silently failed.
    expect(searchAcronyms("zzzznotaterm", "es")).toHaveLength(0);
  });

  it("groups follow the declared category order, not the alphabet", () => {
    const order = groupAcronymsByCategory(ACRONYM_ENTRIES).map(([category]) => category);
    const expected = ACRONYM_CATEGORIES.filter((category) =>
      ACRONYM_ENTRIES.some((entry) => entry.category === category),
    );
    expect(order).toEqual(expected);
  });

  it("empty categories are dropped from a filtered result", () => {
    const groups = groupAcronymsByCategory(searchAcronyms("EAC", "en"));
    expect(groups.every(([, entries]) => entries.length > 0)).toBe(true);
  });

  it("grouping loses no entry", () => {
    const total = groupAcronymsByCategory(ACRONYM_ENTRIES).reduce(
      (sum, [, entries]) => sum + entries.length,
      0,
    );
    expect(total).toBe(ACRONYM_ENTRIES.length);
  });

  it("every category heading has a message in both locales", () => {
    const en = JSON.parse(source("messages/en.json")) as Record<string, Record<string, string>>;
    const es = JSON.parse(source("messages/es.json")) as Record<string, Record<string, string>>;
    for (const category of ACRONYM_CATEGORIES) {
      const key = categoryLabelKey(category);
      expect(en.acronyms[key], `en ${key}`).toBeTruthy();
      expect(es.acronyms[key], `es ${key}`).toBeTruthy();
    }
  });

  it("the reference has an entry point that needs no result", () => {
    // The regression this whole feature exists to prevent: the glossary being
    // reachable only from a rendered metric.
    expect(source("src/components/pmo-intelligence/panel-toggles.tsx")).toContain(
      "onOpenGlossary",
    );
    const shell = source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");
    expect(shell).toContain("AcronymGlossary");
    expect(shell).toContain("setGlossaryOpen(true)");
  });
});
