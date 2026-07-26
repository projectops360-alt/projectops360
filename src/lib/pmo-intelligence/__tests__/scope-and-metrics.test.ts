// ============================================================================
// CAP-048 Phase 2 · Milestone 2 — scope, KPI bindings, blocked days
// Guards: PMO-IC-SCOPE, PMO-IC-KPI-INTENT, PMO-IC-BLOCKED-DAYS, PMO-IC-NO-RECOMPUTE
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultScope,
  isDataAffecting,
  retainValidSelection,
  scopeFromSearchParams,
  scopeKey,
  scopeToSearchParams,
} from "../scope";
import { KPI_UNIT, healthDimensionLens, kpiIntent, PMO_KPI_KEYS } from "../kpi-bindings";
import { computeBlockedDays, currentlyBlockedDays, type StateTransitionRow } from "../blocked-days";
import type { GraphNode } from "@/lib/pmo-living-graph/contracts";

const ORG = "org-1";
const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

function node(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id, organizationId: ORG, projectId: null, kind: "project",
    canonicalEntityType: "projects", canonicalEntityId: id.split(":")[1] ?? id,
    label: id, description: null, status: null, health: "unknown", criticality: 0,
    metrics: {}, provenance: "OBSERVED", confidence: 1, evidenceRefs: [],
    validFrom: null, validTo: null, updatedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PMO-IC-SCOPE
// ---------------------------------------------------------------------------

describe("shared scope (PMO-IC-SCOPE)", () => {
  it("starts unfiltered, on the overview lens", () => {
    const scope = defaultScope(ORG);
    expect(scope.projectIds).toEqual([]);
    expect(scope.dateRange).toEqual({ from: null, to: null });
    expect(scope.activeLens).toBe("overview");
  });

  it("treats project and date changes as data-affecting", () => {
    const base = defaultScope(ORG);
    expect(isDataAffecting(base, { ...base, projectIds: ["p1"] })).toBe(true);
    expect(isDataAffecting(base, { ...base, dateRange: { from: "2026-01-01", to: null } })).toBe(true);
  });

  it("does NOT reload data for a lens or search change", () => {
    // Switching lens reprojects what is already loaded. Refetching would make
    // every tab click cost a round trip for data that did not change.
    const base = defaultScope(ORG);
    expect(isDataAffecting(base, { ...base, activeLens: "risk" })).toBe(false);
    expect(isDataAffecting(base, { ...base, search: "terminal" })).toBe(false);
  });

  it("keys identically regardless of project order", () => {
    const a = { ...defaultScope(ORG), projectIds: ["p2", "p1"] };
    const b = { ...defaultScope(ORG), projectIds: ["p1", "p2"] };
    expect(scopeKey(a)).toBe(scopeKey(b));
  });

  it("round-trips through the URL", () => {
    const scope = {
      ...defaultScope(ORG),
      projectIds: ["p1", "p2"],
      dateRange: { from: "2026-01-01", to: "2026-03-31" },
      activeLens: "finance" as const,
      search: "slab",
    };
    const restored = scopeFromSearchParams(ORG, scopeToSearchParams(scope));
    expect(restored.projectIds).toEqual(["p1", "p2"]);
    expect(restored.dateRange).toEqual({ from: "2026-01-01", to: "2026-03-31" });
    expect(restored.activeLens).toBe("finance");
    expect(restored.search).toBe("slab");
  });

  it("keeps the default scope out of the URL", () => {
    expect(scopeToSearchParams(defaultScope(ORG)).toString()).toBe("");
  });

  it("drops malformed dates instead of passing them to the database", () => {
    const scope = scopeFromSearchParams(ORG, { from: "yesterday", to: "2026-13-45" });
    expect(scope.dateRange).toEqual({ from: null, to: null });
  });

  it("falls back to overview for an unknown lens", () => {
    expect(scopeFromSearchParams(ORG, { lens: "telepathy" }).activeLens).toBe("overview");
  });

  it("discards selections the new scope no longer shows", () => {
    expect(retainValidSelection(["a", "b", "c"], new Set(["a", "c"]))).toEqual(["a", "c"]);
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-KPI-INTENT
// ---------------------------------------------------------------------------

describe("KPI interactions (PMO-IC-KPI-INTENT)", () => {
  const nodes = [
    node("project:p1", { projectId: "p1", health: "critical" }),
    node("project:p2", { projectId: "p2", health: "healthy" }),
    node("decision:d1", { kind: "decision", projectId: "p1", status: "proposed" }),
    node("task:t1", { kind: "task", projectId: "p1", canonicalEntityId: "t1" }),
  ];
  const context = {
    criticalNodeIds: ["project:p1"],
    sharedResourceProjectIds: ["p2"],
    blockedSubjectIds: ["t1"],
  };

  it("gives every KPI a defined intent", () => {
    for (const key of PMO_KPI_KEYS) {
      expect(kpiIntent(key, nodes, context), key).toBeDefined();
    }
  });

  it("routes each KPI to the lens that explains it", () => {
    expect(kpiIntent("projectsAtRisk", nodes, context).lens).toBe("risk");
    expect(kpiIntent("budgetVariance", nodes, context).lens).toBe("finance");
    expect(kpiIntent("sharedResources", nodes, context).lens).toBe("resources");
    expect(kpiIntent("blockedDays", nodes, context).lens).toBe("process");
  });

  it("selects only the projects that are actually at risk", () => {
    expect(kpiIntent("projectsAtRisk", nodes, context).selectNodeIds).toEqual(["project:p1"]);
  });

  it("opens the health panel rather than moving the graph", () => {
    const intent = kpiIntent("portfolioHealth", nodes, context);
    expect(intent.openPanel).toBe("health");
    expect(intent.selectNodeIds).toEqual([]);
  });

  it("isolates for critical nodes — and only for those", () => {
    expect(kpiIntent("criticalNodes", nodes, context).focus).toBe(true);
    for (const key of PMO_KPI_KEYS.filter((k) => k !== "criticalNodes")) {
      expect(kpiIntent(key, nodes, context).focus, key).toBe(false);
    }
  });

  it("maps blocked days onto the blocked work itself", () => {
    expect(kpiIntent("blockedDays", nodes, context).selectNodeIds).toEqual(["task:t1"]);
  });

  it("never mixes units", () => {
    expect(KPI_UNIT.blockedDays).toBe("days");
    expect(KPI_UNIT.budgetVariance).toBe("percent");
    expect(KPI_UNIT.portfolioHealth).toBe("score");
    expect(KPI_UNIT.projects).toBe("count");
  });

  it("admits that materials has no lens instead of opening an unrelated one", () => {
    expect(healthDimensionLens("materials")).toBeNull();
    expect(healthDimensionLens("budget")).toBe("finance");
    expect(healthDimensionLens("critical_path")).toBe("process");
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-BLOCKED-DAYS
// ---------------------------------------------------------------------------

describe("blocked days from the event log (PMO-IC-BLOCKED-DAYS)", () => {
  const AS_OF = "2026-07-25T00:00:00.000Z";
  const t = (
    subject: string,
    from: string | null,
    to: string | null,
    at: string,
    project = "p1",
  ): StateTransitionRow => ({
    project_id: project, subject_type: "task", subject_id: subject,
    from_state: from, to_state: to, occurred_at: at,
  });

  it("measures a closed blocked interval in days", () => {
    const result = computeBlockedDays(
      [
        t("t1", "in_progress", "blocked", "2026-07-01T00:00:00.000Z"),
        t("t1", "blocked", "in_progress", "2026-07-05T00:00:00.000Z"),
      ],
      AS_OF,
    );
    expect(result.totalDays).toBe(4);
    expect(result.daysByProject.get("p1")).toBe(4);
    expect(result.stillBlocked).toEqual([]);
  });

  it("does not open a second interval when already blocked", () => {
    // Two consecutive entries into blocked describe one stalled period. Pairing
    // each of them separately is exactly how this KPI gets inflated.
    const result = computeBlockedDays(
      [
        t("t1", "in_progress", "blocked", "2026-07-01T00:00:00.000Z"),
        t("t1", "blocked", "blocked", "2026-07-02T00:00:00.000Z"),
        t("t1", "blocked", "done", "2026-07-05T00:00:00.000Z"),
      ],
      AS_OF,
    );
    expect(result.intervals).toHaveLength(1);
    expect(result.totalDays).toBe(4);
  });

  it("keeps an open interval apart from closed ones", () => {
    const result = computeBlockedDays(
      [t("t1", "in_progress", "blocked", "2026-07-20T00:00:00.000Z")],
      AS_OF,
    );
    expect(result.totalDays).toBe(0);
    expect(result.stillBlocked).toHaveLength(1);
    expect(currentlyBlockedDays(result)).toBe(5);
  });

  it("sums several blocked periods for one task", () => {
    const result = computeBlockedDays(
      [
        t("t1", "in_progress", "blocked", "2026-07-01T00:00:00.000Z"),
        t("t1", "blocked", "in_progress", "2026-07-03T00:00:00.000Z"),
        t("t1", "in_progress", "blocked", "2026-07-10T00:00:00.000Z"),
        t("t1", "blocked", "done", "2026-07-13T00:00:00.000Z"),
      ],
      AS_OF,
    );
    expect(result.totalDays).toBe(5);
    expect(result.intervals).toHaveLength(2);
  });

  it("attributes days to the right project", () => {
    const result = computeBlockedDays(
      [
        t("t1", "in_progress", "blocked", "2026-07-01T00:00:00.000Z", "p1"),
        t("t1", "blocked", "done", "2026-07-03T00:00:00.000Z", "p1"),
        t("t2", "in_progress", "blocked", "2026-07-01T00:00:00.000Z", "p2"),
        t("t2", "blocked", "done", "2026-07-06T00:00:00.000Z", "p2"),
      ],
      AS_OF,
    );
    expect(result.daysByProject.get("p1")).toBe(2);
    expect(result.daysByProject.get("p2")).toBe(5);
    expect(result.totalDays).toBe(7);
  });

  it("ignores transitions that never touch the blocked state", () => {
    const result = computeBlockedDays(
      [t("t1", "not_started", "in_progress", "2026-07-01T00:00:00.000Z")],
      AS_OF,
    );
    expect(result.totalDays).toBe(0);
    expect(result.intervals).toEqual([]);
  });

  it("pairs correctly even when rows arrive out of order", () => {
    const result = computeBlockedDays(
      [
        t("t1", "blocked", "done", "2026-07-05T00:00:00.000Z"),
        t("t1", "in_progress", "blocked", "2026-07-01T00:00:00.000Z"),
      ],
      AS_OF,
    );
    expect(result.totalDays).toBe(4);
  });

  it("never returns a negative duration", () => {
    const result = computeBlockedDays(
      [
        t("t1", "in_progress", "blocked", "2026-07-10T00:00:00.000Z"),
        t("t1", "blocked", "done", "2026-07-01T00:00:00.000Z"),
      ],
      AS_OF,
    );
    expect(result.totalDays).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-NO-RECOMPUTE — the ADR-012 contract
// ---------------------------------------------------------------------------

describe("the composition layer recomputes nothing (PMO-IC-NO-RECOMPUTE)", () => {
  const readModel = source("src/lib/pmo-intelligence/read-model.server.ts");

  it("calls each dashboard's own service instead of reimplementing it", () => {
    for (const fn of [
      "getCommandCenterSummary",
      "loadPmoPiFlowModel",
      "loadPmoPiFinanceOverlay",
      "loadPmoPiOverlays",
      "buildInsights",
      "loadPortfolioGraph",
    ]) {
      expect(readModel, `missing ${fn}`).toContain(fn);
    }
  });

  it("queries only the one table nothing else reads for this purpose", () => {
    // Blocked days is the single genuinely new read (parity matrix §4). Any
    // other `.from(` here would mean a duplicated query — and a second place
    // where a metric could drift.
    const tables = [...readModel.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]);
    expect(tables).toEqual(["project_event_log"]);
  });

  it("applies the date range to the database, not only to the UI", () => {
    // Dashboard 2's range control never reached its read model. This one does.
    expect(readModel).toContain('gte("occurred_at"');
    expect(readModel).toContain('lte("occurred_at"');
  });

  it("scopes every read by organization", () => {
    expect(readModel).toContain('eq("organization_id", organizationId)');
    expect(readModel).toContain("getOrgContext()");
  });

  it("names failing sources rather than showing an empty portfolio", () => {
    expect(readModel).toContain("unavailableSources");
  });
});
