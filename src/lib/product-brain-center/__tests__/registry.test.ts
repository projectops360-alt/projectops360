import { describe, it, expect } from "vitest";
import { PRODUCT_BRAIN_ITEMS } from "../registry";
import {
  filterItems, summarize, listModules, needsTest, isProtectedByTest,
  isRegressionOpen, toMarkdownReport,
} from "../select";

const byKey = new Map(PRODUCT_BRAIN_ITEMS.map((i) => [i.itemKey, i]));

describe("Product Brain Control Center — registry integrity", () => {
  it("includes the required initial regressions, UX contracts and decisions", () => {
    const required = [
      "REG-008", "REG-009", "REG-010", "REG-011", "REG-012", "REG-013", "REG-014",
      "UX-001", "UX-006", "UX-007",
      "PD-CRITICAL-PATH", "PD-RYTHM-HOME", "PD-BIM-DISCOVERABLE", "PD-WORKBOARD-OWNER",
      "PD-VARIANCE-BASELINE", "PD-TIMELINE-HISTORY", "PD-WHATIF-SANDBOX", "PD-FOCUS-MODE",
      "RULE-BRAIN-FIRST", "RULE-NO-REG-WITHOUT-TEST", "SEC-PB-ALLOWLIST",
    ];
    for (const k of required) expect(byKey.has(k), `missing ${k}`).toBe(true);
  });

  it("includes the required modules", () => {
    const mods = PRODUCT_BRAIN_ITEMS.filter((i) => i.type === "module").map((i) => i.title);
    for (const m of ["Living Graph", "Isabella", "Project Memory", "ProjectOps Scribe", "Rythm / Meetings", "Resource Capacity", "Execution Status Engine", "Workboard", "BIM", "Navigation / Shell", "Landing Page"]) {
      expect(mods, `missing module ${m}`).toContain(m);
    }
  });

  it("every item has a unique key and a source path", () => {
    expect(new Set([...byKey.keys()]).size).toBe(PRODUCT_BRAIN_ITEMS.length);
    for (const i of PRODUCT_BRAIN_ITEMS) expect(i.sourcePath.trim()).toBeTruthy();
  });

  it("every regression cites a test file and is marked protected", () => {
    for (const r of PRODUCT_BRAIN_ITEMS.filter((i) => i.type === "regression")) {
      expect(r.testFiles.length, `${r.itemKey} has no test file`).toBeGreaterThan(0);
      expect(isProtectedByTest(r), `${r.itemKey} not protected`).toBe(true);
    }
  });

  it("the strict-allowlist security rule is protected by the access test", () => {
    const sec = byKey.get("SEC-PB-ALLOWLIST")!;
    expect(sec.type).toBe("security_rule");
    expect(sec.testFiles).toContain("src/lib/product-brain/__tests__/access.test.ts");
  });
});

describe("Product Brain Control Center — selectors", () => {
  it("searches by REG id and keyword", () => {
    expect(filterItems(PRODUCT_BRAIN_ITEMS, { query: "REG-014" }).map((i) => i.itemKey)).toContain("REG-014");
    expect(filterItems(PRODUCT_BRAIN_ITEMS, { query: "welcome hero" }).some((i) => i.itemKey === "REG-014")).toBe(true);
  });

  it("filters by type", () => {
    const ux = filterItems(PRODUCT_BRAIN_ITEMS, { type: "ux_contract" });
    expect(ux.length).toBeGreaterThanOrEqual(3);
    expect(ux.every((i) => i.type === "ux_contract")).toBe(true);
  });

  it("filters by module", () => {
    const iz = filterItems(PRODUCT_BRAIN_ITEMS, { module: "Isabella" });
    expect(iz.every((i) => i.module === "Isabella")).toBe(true);
    expect(iz.some((i) => i.itemKey === "REG-013")).toBe(true);
  });

  it("filters by test status and needs-test", () => {
    const protectedItems = filterItems(PRODUCT_BRAIN_ITEMS, { testStatus: "protected" });
    expect(protectedItems.every((i) => i.testStatus === "protected")).toBe(true);
    const needs = filterItems(PRODUCT_BRAIN_ITEMS, { needsTestOnly: true });
    expect(needs.every(needsTest)).toBe(true);
  });

  it("summarize counts decisions, regressions, protection and gaps", () => {
    const s = summarize(PRODUCT_BRAIN_ITEMS);
    expect(s.total).toBe(PRODUCT_BRAIN_ITEMS.length);
    expect(s.productDecisions).toBeGreaterThanOrEqual(7);
    expect(s.protectedByTest).toBeGreaterThanOrEqual(7);
    // All listed regressions are resolved → 0 open.
    expect(s.openRegressions).toBe(0);
    expect(s.closedRegressions).toBeGreaterThanOrEqual(7);
  });

  it("listModules returns a sorted unique module list", () => {
    const mods = listModules(PRODUCT_BRAIN_ITEMS);
    expect(mods).toContain("Living Graph");
    expect([...mods]).toEqual([...mods].sort());
  });

  it("export markdown includes the report header and key sections", () => {
    const md = toMarkdownReport(PRODUCT_BRAIN_ITEMS);
    expect(md).toContain("# Product Brain Status Report");
    expect(md).toContain("## Open regressions");
    expect(md).toContain("## Needs test");
    expect(md).toContain("## Approved UX contracts");
  });

  it("no regression is open (all resolved/protected)", () => {
    expect(PRODUCT_BRAIN_ITEMS.filter(isRegressionOpen)).toHaveLength(0);
  });
});
