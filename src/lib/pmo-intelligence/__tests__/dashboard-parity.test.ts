// ============================================================================
// CAP-048 Phase 2 · Milestones 5 & 6 — dashboard parity, Isabella, commands
// Guards: PMO-IC-KPI-BAR, PMO-IC-HEALTH-LENS, PMO-IC-FOCUS,
//         PMO-IC-CRITICAL-PATH-DRAWER, PMO-IC-EVIDENCE,
//         PMO-IC-FEEDBACK-REUSE, PMO-IC-ISABELLA-SUBGRAPH,
//         PMO-IC-WHATIF-WIRED, PMO-IC-RELOAD-WIRED
// ============================================================================
// The through-line of every test below is ADR-012: Dashboard 3 orchestrates and
// does not recompute. So the assertions are mostly of two kinds —
//
//   "this number equals the one the source function produced", and
//   "this file does not contain a second implementation of X".
//
// The second kind is a source assertion, which is unusual and deliberate. The
// failure this milestone is guarding against is not a wrong pixel; it is a
// second definition of portfolio health appearing months from now in a file
// nobody re-reads. A test that only checks rendered output cannot catch that.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildKpis,
  filterCriticalPathForSelection,
  parseKpiValue,
  resolveCriticalPathNodes,
  type CriticalPathStep,
} from "../dashboard-model";
import { buildIsabellaAsk, buildIsabellaSubgraph, ISABELLA_SUBGRAPH_NODE_CAP } from "../isabella-context";
import { healthDimensionLens, kpiIntent, KPI_UNIT, PMO_KPI_KEYS } from "../kpi-bindings";
import { simulateWhatIf } from "@/lib/pmo-process-intelligence/whatif";
import type { GraphEdge, GraphNode } from "@/lib/pmo-living-graph/contracts";
import type { MetricValue } from "@/lib/pmo-living-graph/portfolio-metrics";

const ROOT = join(__dirname, "..", "..", "..", "..");
const source = (relative: string) => readFileSync(join(ROOT, relative), "utf8");

const ORG = "org-1";

function node(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    organizationId: ORG,
    projectId: null,
    kind: "project",
    canonicalEntityType: "projects",
    canonicalEntityId: id.split(":")[1] ?? id,
    label: id,
    description: null,
    status: null,
    health: "unknown",
    criticality: 0,
    metrics: {},
    provenance: "OBSERVED",
    confidence: 1,
    evidenceRefs: [],
    validFrom: null,
    validTo: null,
    updatedAt: null,
    ...overrides,
  };
}

function edge(id: string, from: string, to: string, type: GraphEdge["type"] = "depends_on"): GraphEdge {
  // Fully constructed rather than cast: a cast here would keep compiling if the
  // contract gained a field the subgraph builder needs to read.
  return {
    id,
    organizationId: ORG,
    sourceNodeId: from,
    targetNodeId: to,
    type,
    direction: "directed",
    weight: 1,
    status: null,
    provenance: "OBSERVED",
    confidence: 1,
    evidenceRefs: [],
    validFrom: null,
    validTo: null,
    updatedAt: null,
  };
}

const okMetric = (value: number): MetricValue => ({ state: "ok", value });
const naMetric = (reason: string): MetricValue => ({ state: "unavailable", reason });

const GRAPH_METRICS = {
  sharedResources: okMetric(3),
  criticalNodes: okMetric(5),
  projectsAtRisk: okMetric(2),
  blockedDays: naMetric("no transitions"),
};

// ---------------------------------------------------------------------------
// PMO-IC-KPI-BAR — the eight KPIs, their units, and where each number came from
// ---------------------------------------------------------------------------

describe("unified KPI bar (PMO-IC-KPI-BAR)", () => {
  const commandCenter = {
    portfolioHealth: {
      overall: 72,
      dimensions: [
        { key: "schedule", score: 60 },
        { key: "materials", score: 90 },
      ],
      derivedFrom: "7 tables",
    },
    kpis: [
      { key: "active_projects", value: "12", subtitle: "4 planning", tone: "blue" as const },
      { key: "budget_variance", value: "+12.4%", subtitle: "Above baseline", tone: "red" as const },
      { key: "pm_decisions", value: "3", subtitle: "2 high-impact pending", tone: "amber" as const },
    ],
  };

  it("exposes exactly the eight KPIs the parity matrix lists", () => {
    const kpis = buildKpis({
      commandCenter: commandCenter as never,
      graphMetrics: GRAPH_METRICS,
      blockedDaysTotal: 14.25,
    });
    expect(kpis.map((kpi) => kpi.key)).toEqual([...PMO_KPI_KEYS]);
  });

  it("copies Dashboard 1's numbers rather than deriving its own", () => {
    const kpis = buildKpis({
      commandCenter: commandCenter as never,
      graphMetrics: GRAPH_METRICS,
      blockedDaysTotal: null,
    });
    const byKey = new Map(kpis.map((kpi) => [kpi.key, kpi]));

    // Health is the source's `overall`, not a re-averaging of the dimensions
    // that happen to be present. Averaging {60, 90} would give 75, not 72.
    expect(byKey.get("portfolioHealth")?.value).toEqual(okMetric(72));
    expect(byKey.get("projects")?.value).toEqual(okMetric(12));
    expect(byKey.get("budgetVariance")?.value).toEqual(okMetric(12.4));
    expect(byKey.get("pendingDecisions")?.value).toEqual(okMetric(3));

    // And the subtitle Dashboard 1 wrote travels with it, so the two screens
    // read identically rather than merely agreeing on the digits.
    expect(byKey.get("projects")?.subtitle).toBe("4 planning");
  });

  it("carries the producing function on every KPI (ADR-012 §1)", () => {
    const kpis = buildKpis({
      commandCenter: commandCenter as never,
      graphMetrics: GRAPH_METRICS,
      blockedDaysTotal: 1,
    });
    for (const kpi of kpis) {
      expect(kpi.source.length).toBeGreaterThan(10);
    }
    // Traceability is specific, not decorative: the health KPI must name the
    // Command Center function, not "the read model".
    expect(kpis[0].source).toContain("getCommandCenterSummary");
  });

  it("reports unavailable rather than 0 when a source could not be read", () => {
    const kpis = buildKpis({
      commandCenter: null,
      graphMetrics: GRAPH_METRICS,
      blockedDaysTotal: null,
    });
    const byKey = new Map(kpis.map((kpi) => [kpi.key, kpi]));

    // The whole point. A 0 here would state "no pending decisions" when the
    // truth is "the Command Center could not be reached".
    expect(byKey.get("portfolioHealth")?.value.state).toBe("unavailable");
    expect(byKey.get("pendingDecisions")?.value.state).toBe("unavailable");
    expect(byKey.get("blockedDays")?.value).toEqual(naMetric("no transitions"));

    // Graph-sourced KPIs survive a Command Center outage — degrading one slice
    // must not empty the bar.
    expect(byKey.get("criticalNodes")?.value).toEqual(okMetric(5));
  });

  it("never turns an unparseable value into a number", () => {
    expect(parseKpiValue("+12.4%")).toBe(12.4);
    expect(parseKpiValue("-3.5%")).toBe(-3.5);
    expect(parseKpiValue("1,204")).toBe(1204);
    // These are the cases that must NOT become 0.
    expect(parseKpiValue("—")).toBeNull();
    expect(parseKpiValue("n/a")).toBeNull();
    expect(parseKpiValue("")).toBeNull();
    expect(parseKpiValue(undefined)).toBeNull();
  });

  it("keeps units distinct so a score can never render as money or days", () => {
    // Four different units across eight KPIs. If they were all "count" the bar
    // would invite comparing a health score to a project count.
    expect(new Set(Object.values(KPI_UNIT)).size).toBe(4);
    expect(KPI_UNIT.portfolioHealth).toBe("score");
    expect(KPI_UNIT.blockedDays).toBe("days");
    expect(KPI_UNIT.budgetVariance).toBe("percent");
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-KPI-BAR — clicking a KPI re-aims the screen
// ---------------------------------------------------------------------------

describe("KPI clicks are interactive, not decorative (PMO-IC-KPI-BAR)", () => {
  const nodes = [
    node("n:p1", { kind: "project", projectId: "p1", health: "critical" }),
    node("n:p2", { kind: "project", projectId: "p2", health: "healthy" }),
    node("n:d1", { kind: "decision", status: "proposed" }),
  ];
  const context = {
    criticalNodeIds: ["n:p1"],
    sharedResourceProjectIds: ["p1"],
    blockedSubjectIds: ["p1"],
  };

  it("gives every KPI an intent — none is inert", () => {
    for (const key of PMO_KPI_KEYS) {
      const intent = kpiIntent(key, nodes, context);
      const doesSomething =
        intent.lens != null ||
        intent.selectNodeIds.length > 0 ||
        intent.openPanel != null ||
        intent.focus;
      expect(doesSomething, `KPI ${key} does nothing when clicked`).toBe(true);
    }
  });

  it("moves the lens where the KPI has one, and selects what it names", () => {
    expect(kpiIntent("projectsAtRisk", nodes, context)).toMatchObject({
      lens: "risk",
      selectNodeIds: ["n:p1"],
    });
    expect(kpiIntent("budgetVariance", nodes, context).lens).toBe("finance");
    expect(kpiIntent("sharedResources", nodes, context).lens).toBe("resources");
    expect(kpiIntent("pendingDecisions", nodes, context).selectNodeIds).toEqual(["n:d1"]);
  });

  it("opens the health panel rather than pretending health is a place on the graph", () => {
    const intent = kpiIntent("portfolioHealth", nodes, context);
    expect(intent.openPanel).toBe("health");
    expect(intent.selectNodeIds).toEqual([]);
  });

  it("isolates only for critical nodes, where the neighbourhood is the point", () => {
    expect(kpiIntent("criticalNodes", nodes, context).focus).toBe(true);
    expect(kpiIntent("projects", nodes, context).focus).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-HEALTH-LENS — a dimension activates its lens, or honestly has none
// ---------------------------------------------------------------------------

describe("health dimensions route to a lens (PMO-IC-HEALTH-LENS)", () => {
  it("maps each dimension the Command Center produces", () => {
    expect(healthDimensionLens("schedule")).toBe("process");
    expect(healthDimensionLens("critical_path")).toBe("process");
    expect(healthDimensionLens("budget")).toBe("finance");
    expect(healthDimensionLens("resources")).toBe("resources");
    expect(healthDimensionLens("risk")).toBe("risk");
  });

  it("returns null for materials instead of forcing an unrelated lens", () => {
    // There is no materials projection on the canvas. Wiring this to, say,
    // the process lens would make the click do the wrong thing quietly, which
    // is worse than a control that states it cannot act.
    expect(healthDimensionLens("materials")).toBeNull();
  });

  it("renders a lensless dimension as non-interactive in the panel", () => {
    const panel = source("src/components/pmo-intelligence/health-panel.tsx");
    // The null branch must exist and must not be a button.
    expect(panel).toContain("if (lens == null)");
    expect(panel).toContain("healthNoLens");
  });

  it("copies the health score verbatim — no second formula in the panel", () => {
    const panel = source("src/components/pmo-intelligence/health-panel.tsx");
    // Any arithmetic over the dimensions would be a competing definition.
    expect(panel).not.toMatch(/reduce\s*\(/);
    expect(panel).not.toContain("/ dimensions.length");
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-CRITICAL-PATH-DRAWER — contextual, and built on the existing CPM
// ---------------------------------------------------------------------------

describe("critical path drawer (PMO-IC-CRITICAL-PATH-DRAWER)", () => {
  const steps = [
    { order: 1, task: "Pour slab", project: "Tower A", status: "Blocked", risk: "red" as const, blocker: "Rebar late", float: 0 },
    { order: 2, task: "Frame walls", project: "Tower A", status: "Ready", risk: "green" as const, blocker: null, float: 5 },
    { order: 3, task: "Wire floor", project: "Tower B", status: "Ready", risk: "amber" as const, blocker: null, float: 2 },
  ];
  const nodes = [
    { id: "n:t1", kind: "task", label: "Pour slab", projectId: "p1" },
    { id: "n:t2", kind: "task", label: "Frame walls", projectId: "p1" },
    // Deliberately absent: "Wire floor" has no node.
  ];
  const projectLabels = new Map([["p1", "Tower A"]]);

  it("attaches node ids where they can be resolved", () => {
    const resolved = resolveCriticalPathNodes(steps, nodes, projectLabels);
    expect(resolved[0].nodeId).toBe("n:t1");
    expect(resolved[1].nodeId).toBe("n:t2");
  });

  it("keeps unmatched steps instead of silently shortening the path", () => {
    const resolved = resolveCriticalPathNodes(steps, nodes, projectLabels);
    // A critical path missing a step is a wrong critical path. It stays, with
    // nodeId null, and the drawer renders it unclickable.
    expect(resolved).toHaveLength(3);
    expect(resolved[2].nodeId).toBeNull();
  });

  it("does not match a same-named task from another project", () => {
    const collision = resolveCriticalPathNodes(
      [{ ...steps[0], project: "Tower B" }],
      nodes,
      projectLabels,
    );
    expect(collision[0].nodeId).toBeNull();
  });

  it("narrows to the selection, and says it did", () => {
    const resolved = resolveCriticalPathNodes(steps, nodes, projectLabels);
    const view = filterCriticalPathForSelection(resolved, {
      selectedNodeIds: ["n:t1"],
      selectedProjectLabels: [],
    });
    expect(view.contextual).toBe(true);
    expect(view.steps.map((step) => step.task)).toEqual(["Pour slab"]);
  });

  it("narrows by project when a project node is selected", () => {
    const resolved = resolveCriticalPathNodes(steps, nodes, projectLabels);
    const view = filterCriticalPathForSelection(resolved, {
      selectedNodeIds: ["n:p1"],
      selectedProjectLabels: ["Tower A"],
    });
    expect(view.steps.map((step) => step.task)).toEqual(["Pour slab", "Frame walls"]);
  });

  it("falls back to the whole path rather than showing an empty drawer", () => {
    const resolved = resolveCriticalPathNodes(steps, nodes, projectLabels);
    const view = filterCriticalPathForSelection(resolved, {
      selectedNodeIds: ["n:unrelated"],
      selectedProjectLabels: ["Nowhere"],
    });
    // "This selection has no critical-path steps" and "the critical path is
    // empty" are different statements; the second would be a lie.
    expect(view.contextual).toBe(false);
    expect(view.steps).toHaveLength(3);
  });

  it("contains no second critical-path calculation (CAP-048 §6)", () => {
    const model = source("src/lib/pmo-intelligence/dashboard-model.ts");
    const drawer = source("src/components/pmo-intelligence/critical-path-drawer.tsx");
    for (const text of [model, drawer]) {
      expect(text).not.toMatch(/slack|earliest[_ ]?start|late[_ ]?finish|forward pass/i);
    }
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-ISABELLA-SUBGRAPH — a minimal subgraph, never the whole graph
// ---------------------------------------------------------------------------

describe("Isabella receives a minimal subgraph (PMO-IC-ISABELLA-SUBGRAPH)", () => {
  const bigGraph = Array.from({ length: 200 }, (_, index) =>
    node(`n:${index}`, { kind: "task", label: `Task ${index}` }),
  );
  const bigEdges = Array.from({ length: 199 }, (_, index) =>
    edge(`e:${index}`, `n:${index}`, `n:${index + 1}`),
  );

  it("caps the subgraph well below the size of the portfolio", () => {
    const subgraph = buildIsabellaSubgraph(bigGraph, bigEdges, ["n:0"]);
    expect(subgraph.nodes.length).toBeLessThanOrEqual(ISABELLA_SUBGRAPH_NODE_CAP);
    // The binding rule: not the whole graph. 200 nodes in, at most 24 out.
    expect(subgraph.nodes.length).toBeLessThan(bigGraph.length);
    expect(subgraph.totalNodeCount).toBe(200);
  });

  it("includes the anchor and its neighbours, not an arbitrary slice", () => {
    const subgraph = buildIsabellaSubgraph(bigGraph, bigEdges, ["n:100"]);
    const ids = subgraph.nodes.map((item) => item.id);
    expect(ids).toContain("n:100");
    // One hop out: the neighbour that explains the anchor.
    expect(ids).toContain("n:101");
  });

  it("states truncation rather than silently dropping context", () => {
    const subgraph = buildIsabellaSubgraph(bigGraph, bigEdges, bigGraph.slice(0, 60).map((n) => n.id));
    expect(subgraph.truncated).toBe(true);
  });

  it("sends nothing rather than a random slice when there is no anchor", () => {
    const subgraph = buildIsabellaSubgraph(bigGraph, bigEdges, []);
    expect(subgraph.nodes).toHaveLength(0);
  });

  it("only includes edges whose BOTH ends were sent", () => {
    const subgraph = buildIsabellaSubgraph(bigGraph, bigEdges, ["n:5"]);
    const ids = new Set(subgraph.nodes.map((item) => item.id));
    for (const item of subgraph.edges) {
      expect(ids.has(item.from) && ids.has(item.to)).toBe(true);
    }
  });

  it("puts the scope, lens and subgraph into the question it asks", () => {
    const subgraph = buildIsabellaSubgraph(bigGraph, bigEdges, ["n:7"]);
    const ask = buildIsabellaAsk(
      {
        lens: "risk",
        scopeLabel: "Acme",
        selectedNodeIds: ["n:7"],
        subgraph,
        highlightedPath: ["n:7", "n:8"],
        openEvidenceId: "bottleneck:x",
      },
      "What is going on here?",
    );
    expect(ask.query).toContain("What is going on here?");
    expect(ask.query).toContain("Active lens: risk");
    expect(ask.query).toContain("Acme");
    expect(ask.query).toContain("Highlighted path");
    expect(ask.entity).toMatchObject({ id: "n:7" });

    // And the payload stays small. A whole-graph dump would run to hundreds of
    // lines and bury the question inside its own context.
    expect(ask.query.split("\n").length).toBeLessThan(80);
  });

  it("is what the shell actually calls — no second path to askIsabella", () => {
    const shell = source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");
    expect(shell).toContain("buildIsabellaSubgraph");
    expect(shell).toContain("buildIsabellaAsk");
    // The shell must never hand the raw arrays to Isabella.
    expect(shell).not.toMatch(/askIsabella\(\s*\{\s*[^)]*nodes\s*[,}]/);
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-FEEDBACK-REUSE — accept/reject/defer reach the EXISTING action
// ---------------------------------------------------------------------------

describe("insight feedback reuses the existing action (PMO-IC-FEEDBACK-REUSE)", () => {
  const commands = source("src/lib/pmo-intelligence/commands.server.ts");
  const panel = source("src/components/pmo-intelligence/insights-panel.tsx");

  it("delegates to recordInsightFeedbackAction from process-intelligence", () => {
    expect(commands).toContain(
      'import { recordInsightFeedbackAction } from "@/app/[locale]/(app)/process-intelligence/actions"',
    );
    expect(commands).toContain("return recordInsightFeedbackAction(input)");
  });

  it("does not reimplement the feedback contract", () => {
    // No schema, no hashing, no audit write. Every one of those already exists
    // inside the delegate and a second copy would be free to disagree.
    expect(commands).not.toContain("logAudit");
    expect(commands).not.toContain("createHash");
    expect(commands).not.toContain("pmo_pi_recommendation_feedback");
    expect(commands).not.toMatch(/z\.object\(/);
  });

  it("takes its parameter type from the delegate, so the contract cannot drift", () => {
    expect(commands).toContain("Parameters<typeof recordInsightFeedbackAction>[0]");
  });

  it("wires all three decisions from the panel", () => {
    expect(panel).toContain("recordPmoInsightFeedbackAction");
    for (const decision of ["accepted", "rejected", "deferred"]) {
      expect(panel).toContain(`sendFeedback(insight, "${decision}")`);
    }
  });

  it("rolls the decision back when the action fails", () => {
    // An audited action that appears to have worked and did not is worse than
    // one that visibly failed.
    expect(panel).toContain("if (result.error)");
    expect(panel).toContain("insightFeedbackFailed");
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-EVIDENCE — the real package, including the uncomfortable fields
// ---------------------------------------------------------------------------

describe("evidence is the real package (PMO-IC-EVIDENCE)", () => {
  const panel = source("src/components/pmo-intelligence/insights-panel.tsx");

  it("renders every meaningful field of PmoPiEvidencePackage", () => {
    for (const field of [
      "evidence.formulas",
      "evidence.projections",
      "evidence.technicalEventTypes",
      "evidence.affectedCaseCount",
      "evidence.cutoffDate",
      "evidence.timestamps",
      "evidence.assumptions",
      "evidence.limitations",
      "evidence.dataQualityScore",
    ]) {
      expect(panel, `evidence view omits ${field}`).toContain(field);
    }
  });

  it("shows limitations and data quality, not only the supporting half", () => {
    // An evidence view that hides what weakens the claim is not evidence.
    expect(panel).toContain("evidenceLimitations");
    expect(panel).toContain("evidenceQuality");
  });

  it("invents nothing — no fallback text substituted for a missing formula", () => {
    expect(panel).not.toMatch(/formulas.*\|\|\s*\[["']/);
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-WHATIF-WIRED — simulateWhatIf is reachable, and capacity is an array
// ---------------------------------------------------------------------------

describe("what-if is wired (PMO-IC-WHATIF-WIRED)", () => {
  it("is called from the panel — it was previously dead code", () => {
    const panel = source("src/components/pmo-intelligence/whatif-panel.tsx");
    expect(panel).toContain("simulateWhatIf(");
    // All three inputs the scenario accepts must be reachable.
    expect(panel).toContain("budgetDeltaByProject");
    expect(panel).toContain("excludedRiskIds");
    expect(panel).toContain("availabilityDeltaPct");
  });

  it("labels the result as a non-persistent simulation", () => {
    const panel = source("src/components/pmo-intelligence/whatif-panel.tsx");
    expect(panel).toContain("whatIfNotPersisted");
  });

  it("throws if capacity is null — which is why the slice always builds an array", () => {
    const inputs = {
      financeRows: [],
      criticalRiskCount: 0,
      systemicRisks: [],
      capacity: null as never,
    };
    // Documented here rather than trusted: the simulator calls .filter() with
    // no guard, so a null capacity is a crash, not an empty scenario.
    expect(() =>
      simulateWhatIf(inputs, { budgetDeltaByProject: {}, excludedRiskIds: [], availabilityDeltaPct: 0 }),
    ).toThrow();
  });

  it("produces a labelled current-vs-simulated comparison", () => {
    const result = simulateWhatIf(
      {
        financeRows: [
          { projectId: "p1", currency: "USD", baseline: 1000, latestEac: 1200 } as never,
        ],
        criticalRiskCount: 2,
        systemicRisks: [],
        capacity: [
          { projectId: "p1", hasCapacityInputs: true, workforceAvailabilityPercent: 70 } as never,
        ],
      },
      { budgetDeltaByProject: { p1: 500 }, excludedRiskIds: [], availabilityDeltaPct: 10 },
    );
    expect(result.current.label).toBe("current");
    expect(result.simulated.label).toBe("simulated");
    // The budget delta moves BAC, not EAC — the engine's own stated behaviour.
    expect(result.simulated.totalBaseline).toBe(1500);
    expect(result.simulated.totalEac).toBe(result.current.totalEac);
    expect(result.simulated.avgAvailabilityPct).toBe(80);
    expect(result.limitations).toContain("simulation_is_ephemeral_never_persisted");
  });

  it("guarantees the slice hands over an array, never null", () => {
    const model = source("src/lib/pmo-intelligence/dashboard-model.ts");
    expect(model).toContain("model.overlays?.capacity ?? []");
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-RELOAD-WIRED — the client reload path is no longer dead
// ---------------------------------------------------------------------------

describe("client reload is wired and gated (PMO-IC-RELOAD-WIRED)", () => {
  const commands = source("src/lib/pmo-intelligence/commands.server.ts");
  const shell = source("src/components/pmo-living-graph/portfolio-graph-shell.tsx");

  it("no longer passes reload: undefined", () => {
    expect(shell).not.toMatch(/reload:\s*undefined/);
    expect(shell).toContain("reload: intelligence ? reloadDashboard : undefined");
    expect(shell).toContain("reloadPmoIntelligenceAction");
  });

  it("gates the action with canAccessPmoLivingGraph — a route gate is not an action gate", () => {
    expect(commands).toContain("canAccessPmoLivingGraph(org.role)");
    // Every exported action must be gated, not just the first one.
    const gates = commands.match(/canAccessPmoLivingGraph\(org\.role\)/g) ?? [];
    expect(gates.length).toBeGreaterThanOrEqual(2);
  });

  it("takes the organization from the session, never from the caller", () => {
    expect(commands).toContain("scopeFromSearchParams(\n    org.organizationId,");
    expect(commands).not.toMatch(/input\.organizationId/);
  });

  it("validates the scope through the same parser the route uses", () => {
    expect(commands).toContain("scopeFromSearchParams");
  });
});

// ---------------------------------------------------------------------------
// PMO-IC-FOCUS / reports — reuse, not reimplementation
// ---------------------------------------------------------------------------

describe("commands re-export rather than reimplement (ADR-012 §2)", () => {
  const commands = source("src/lib/pmo-intelligence/commands.server.ts");

  it("runs reports through runReport", () => {
    expect(commands).toContain('from "@/lib/reports/query-service"');
    expect(commands).toContain("await runReport(");
    // No second generator: no dataset fetching, no filter engine of its own.
    expect(commands).not.toContain("createAdminClient");
    expect(commands).not.toContain("applyFilters");
  });

  it("links Import to the real wizard rather than reimplementing a step", () => {
    const actions = source("src/components/pmo-intelligence/top-actions.tsx");
    expect(actions).toContain("/import");
    expect(actions).not.toContain("executeImportAction");
  });

  it("defines no formula anywhere in the orchestration layer", () => {
    const model = source("src/lib/pmo-intelligence/dashboard-model.ts");
    // The layer copies and reshapes. Any of these would be a new definition.
    expect(model).not.toMatch(/Math\.max\(0,\s*Math\.min\(100/);
    expect(model).not.toMatch(/\*\s*1\.2|\*\s*0\.6|\*\s*12\b/);
  });
});

// ---------------------------------------------------------------------------
// Gaps stay gaps
// ---------------------------------------------------------------------------

describe("documented gaps are not simulated (parity matrix §4)", () => {
  it("keeps portfolio and program disabled with a stated reason", () => {
    const filters = source("src/components/pmo-intelligence/global-filters.tsx");
    expect(filters).toContain("filterNotConfigured");
    expect(filters).toContain('aria-disabled="true"');
  });

  it("does not add a benefits data model", () => {
    const files = [
      "src/lib/pmo-intelligence/dashboard-model.ts",
      "src/lib/pmo-intelligence/commands.server.ts",
      "src/components/pmo-intelligence/kpi-bar.tsx",
    ];
    for (const file of files) {
      expect(source(file)).not.toMatch(/benefit(s)?_realis|strategic_objective/i);
    }
  });
});

// ---------------------------------------------------------------------------
// i18n parity — UX-012
// ---------------------------------------------------------------------------

describe("every new string exists in both languages (UX-012)", () => {
  const en = JSON.parse(source("messages/en.json")) as Record<string, Record<string, string>>;
  const es = JSON.parse(source("messages/es.json")) as Record<string, Record<string, string>>;

  it("keeps pmoIntelligence at exact key parity", () => {
    expect(Object.keys(en.pmoIntelligence).sort()).toEqual(
      Object.keys(es.pmoIntelligence).sort(),
    );
  });

  it("has a key for each of the eight KPIs, in both languages", () => {
    for (const key of PMO_KPI_KEYS) {
      expect(en.pmoIntelligence[`kpi_${key}`]).toBeTruthy();
      expect(es.pmoIntelligence[`kpi_${key}`]).toBeTruthy();
      // Not the same string in both — that is the Spanglish failure UX-012 is
      // about. (Proper nouns are exempt; none of the KPI labels are.)
      expect(en.pmoIntelligence[`kpi_${key}`]).not.toBe(es.pmoIntelligence[`kpi_${key}`]);
    }
  });

  it("translates the not-available text rather than showing a zero", () => {
    expect(en.pmoIntelligence.kpiUnavailable).toBeTruthy();
    expect(es.pmoIntelligence.kpiUnavailable).toBeTruthy();
    expect(es.pmoIntelligence.kpiUnavailable).not.toMatch(/available/i);
  });
});

// Type-level guard: `CriticalPathStep` must keep `nodeId` nullable, or the
// "unmatched steps stay in the list" rule stops compiling.
const _nullableNodeId: CriticalPathStep["nodeId"] = null;
void _nullableNodeId;
