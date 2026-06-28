import { describe, it, expect } from "vitest";
import { TAB_ITEMS } from "@/components/layout/project-tabs-config";

// ── REG-011: Rythm/Rhythm duplicate navigation ───────────────────────────────
// The project navigation must expose exactly ONE visible item for the
// meeting/rhythm capability, and it must be the canonical Rhythm Center route.
// `/rythm` is a backward-compatible redirect, never a second nav item.

describe("REG-011 — project nav has a single canonical Rythm/Rhythm item", () => {
  const rhythmTabs = TAB_ITEMS.filter((t) => /r[hy]+thm/i.test(t.href));

  it("renders exactly one Rythm/Rhythm nav item", () => {
    expect(rhythmTabs).toHaveLength(1);
  });

  it("the single item points at the canonical /rhythm route", () => {
    expect(rhythmTabs[0].href).toBe("/projects/[projectId]/rhythm");
    expect(rhythmTabs[0].titleKey).toBe("rhythm");
  });

  it("does not expose the legacy /rythm route as a nav item", () => {
    const legacy = TAB_ITEMS.filter((t) => t.href === "/projects/[projectId]/rythm");
    expect(legacy).toHaveLength(0);
  });

  it("has no duplicate hrefs anywhere in the nav", () => {
    const hrefs = TAB_ITEMS.map((t) => t.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
