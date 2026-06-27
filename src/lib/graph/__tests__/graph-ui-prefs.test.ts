import { describe, it, expect } from "vitest";
import { countActiveGraphFilters, type ActiveFilterArgs } from "@/lib/graph/graph-ui-prefs";
import type { ProcessNodeType, ProcessEdgeType } from "@/types/database";

const base = (): ActiveFilterArgs => ({
  statusFilter: null,
  riskFilter: null,
  blockedOnly: false,
  criticalOnly: false,
  dateFrom: "",
  dateTo: "",
  nodeTypeFilter: new Set<ProcessNodeType>(["task", "milestone"] as unknown as ProcessNodeType[]),
  edgeTypeFilter: new Set<ProcessEdgeType>(["dependency", "blocks"] as unknown as ProcessEdgeType[]),
  totalNodeTypes: 2,
  totalEdgeTypes: 2,
});

describe("countActiveGraphFilters (Sprint #2 — active filters badge)", () => {
  it("returns 0 when nothing narrows the graph", () => {
    expect(countActiveGraphFilters(base())).toBe(0);
  });

  it("counts each scalar filter once", () => {
    expect(countActiveGraphFilters({ ...base(), statusFilter: "blocked" })).toBe(1);
    expect(countActiveGraphFilters({ ...base(), riskFilter: "high" })).toBe(1);
    expect(countActiveGraphFilters({ ...base(), blockedOnly: true })).toBe(1);
    expect(countActiveGraphFilters({ ...base(), criticalOnly: true })).toBe(1);
    expect(countActiveGraphFilters({ ...base(), dateFrom: "2026-01-01" })).toBe(1);
    expect(countActiveGraphFilters({ ...base(), dateTo: "2026-12-31" })).toBe(1);
  });

  it("counts a node/edge-type set as active only when something is hidden", () => {
    const a = base();
    expect(countActiveGraphFilters({ ...a, nodeTypeFilter: new Set(["task"] as unknown as ProcessNodeType[]) })).toBe(1);
    expect(countActiveGraphFilters({ ...a, edgeTypeFilter: new Set(["dependency"] as unknown as ProcessEdgeType[]) })).toBe(1);
  });

  it("sums multiple active filters", () => {
    const r = countActiveGraphFilters({
      ...base(),
      statusFilter: "blocked",
      blockedOnly: true,
      criticalOnly: true,
    });
    expect(r).toBe(3);
  });
});
