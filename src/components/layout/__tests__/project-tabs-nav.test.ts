import { describe, it, expect } from "vitest";
import { TAB_ITEMS, TAB_GROUPS } from "@/components/layout/project-tabs-config";

// Helpers ─────────────────────────────────────────────────────────────────────
const groupOf = (key: string) => TAB_GROUPS.find((g) => g.groupKey === key);
const itemKeys = (key: string) => groupOf(key)?.items.map((i) => i.titleKey) ?? [];

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

// ── UX-006 / REG-012 / PD-009 — grouped navigation ───────────────────────────
// Navigation simplification groups modules by user intent; it must never hide,
// orphan, or bury a strategic module (BIM), and must keep operational modules
// (Resource Capacity) out of Settings.

describe("UX-006 — project nav is grouped by user intent", () => {
  it("exposes exactly the seven canonical top-level groups, in order", () => {
    expect(TAB_GROUPS.map((g) => g.groupKey)).toEqual([
      "commandCenter",
      "planning",
      "execution",
      "resources",
      "intelligence",
      "technical",
      "more",
    ]);
  });

  it("every group has at least one item", () => {
    for (const g of TAB_GROUPS) expect(g.items.length).toBeGreaterThan(0);
  });

  it("TAB_ITEMS is the flattened view of TAB_GROUPS (back-compat)", () => {
    expect(TAB_ITEMS).toEqual(TAB_GROUPS.flatMap((g) => g.items));
  });

  it("has no duplicate hrefs across all groups", () => {
    const hrefs = TAB_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("REG-012 / PD-009 — BIM is discoverable and never silently removed", () => {
  const bim = TAB_ITEMS.find((t) => t.href.endsWith("/drawing-intelligence"));

  it("BIM exists in the nav model", () => {
    expect(bim).toBeDefined();
  });

  it("BIM lives in the dedicated Technical / BIM group", () => {
    expect(itemKeys("technical")).toContain("drawingIntelligence");
  });

  it("BIM is module-gated but kept visible (disabled) when not enabled", () => {
    expect(bim?.module).toBe("drawing_intelligence");
    expect(bim?.keepDisabledWhenModuleMissing).toBe(true);
  });

  it("BIM is NOT buried in Settings or the More group", () => {
    expect(itemKeys("more")).not.toContain("drawingIntelligence");
    expect(itemKeys("more")).toEqual(["settings"]);
  });
});

describe("PD-009 — Resource Capacity is operational, under Resources (not Settings)", () => {
  it("Resource Capacity appears under the Resources group", () => {
    expect(itemKeys("resources")).toContain("resourceCapacity");
  });

  it("Resource Capacity is NOT in the More/Settings group", () => {
    expect(itemKeys("more")).not.toContain("resourceCapacity");
  });

  it("People & Roles and Stakeholders are grouped under Resources", () => {
    expect(itemKeys("resources")).toEqual(
      expect.arrayContaining(["teamRoles", "stakeholders", "resourceCapacity", "laborCapacity"]),
    );
  });
});

describe("Financial control discoverability", () => {
  it("places Financial Control under Planning", () => {
    expect(itemKeys("planning")).toContain("financialControl");
  });

  it("routes Financial Control to the canonical project budget surface", () => {
    const financialControl = TAB_ITEMS.find((item) => item.titleKey === "financialControl");
    expect(financialControl?.href).toBe("/projects/[projectId]/budget");
  });
});

describe("Settings boundary — Settings is not the home for operational modules", () => {
  const operational = [
    "drawingIntelligence",
    "resourceCapacity",
    "teamRoles",
    "stakeholders",
    "workboard",
    "projectMemory",
  ];

  it("the More group only contains Settings", () => {
    expect(itemKeys("more")).toEqual(["settings"]);
  });

  it("no operational module is placed in the More group", () => {
    for (const key of operational) expect(itemKeys("more")).not.toContain(key);
  });
});

describe("REG-015 — Project Status stays discoverable in Command Center", () => {
  it("Status lives in the Command Center group, not buried in More/Settings", () => {
    expect(itemKeys("commandCenter")).toContain("statusReport");
    expect(itemKeys("more")).not.toContain("statusReport");
  });

  it("Status routes to /status (capability + route preserved, never dead)", () => {
    const status = TAB_ITEMS.find((t) => t.titleKey === "statusReport");
    expect(status?.href).toBe("/projects/[projectId]/status");
  });

  it("the Command Center group is Overview + Status", () => {
    expect(itemKeys("commandCenter")).toEqual(["overview", "statusReport"]);
  });
});

describe("Core routes preserved in the grouped nav", () => {
  const mustExist = [
    "/projects/[projectId]/workboard",
    "/projects/[projectId]/execution-map",
    "/projects/[projectId]/memory",
    "/projects/[projectId]/resource-capacity",
    "/projects/[projectId]/drawing-intelligence",
    "/projects/[projectId]/rhythm",
    "/projects/[projectId]/budget",
  ];

  it.each(mustExist)("nav still exposes %s", (href) => {
    expect(TAB_ITEMS.some((t) => t.href === href)).toBe(true);
  });
});
