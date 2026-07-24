// ============================================================================
// CAP-047 M7 — insight evidence contract + What-if purity
// (guards: PMO-PI-INSIGHT-EVIDENCE, PMO-PI-WHATIF)
// ============================================================================
// BLOCKING invariant: 100% of built insights carry complete evidence
// (formulas, projections, timestamps, confidence, limitations, affected).
// What-if: pure, never mutates inputs, current state never changes, results
// are labeled and its ephemeral nature is declared.
// ============================================================================

import { describe, it, expect } from "vitest";
import { buildInsights } from "../insights";
import { simulateWhatIf, EMPTY_SCENARIO, type WhatIfInputs } from "../whatif";
import { buildFlowModel } from "../flow-projection";
import { buildFinanceOverlayModel } from "../financial-overlay";
import { buildRiskOverlay, buildDependencyOverlay } from "../overlays";
import type { PmoPiCase, PmoPiEventRecord, PmoPiScope } from "../contracts";
import type { FinancialCockpitSummary } from "@/lib/financial/read-model.server";
import type { PmoPiOverlaysData } from "../overlays-read.server";

const SCOPE: PmoPiScope = { organizationId: "org-1", projectIds: [], level: "organization" };
let n = 0;
const ev = (caseId: string, eventType: string, occurredAt: string): PmoPiEventRecord => ({
  eventId: `e${++n}`, eventType, eventCategory: "task", occurredAt,
  lifecycleClass: "BUSINESS_EVENT", isCompensatingEvent: false,
  organizationId: "org-1", projectId: "p1", caseId, subjectType: "task",
  subjectId: `t${n}`, actorType: "human", recordedAt: occurredAt, sourceModule: "roadmap",
});
const mkCase = (id: string, events: PmoPiEventRecord[]): PmoPiCase => ({
  caseId: id, caseLabel: id, organizationId: "org-1", projectId: "p1", events, outcome: "open",
});

const flow = buildFlowModel(SCOPE, [
  mkCase("c1", [ev("c1", "TaskStarted", "2026-07-01T00:00:00Z"), ev("c1", "TaskCompleted", "2026-07-01T01:00:00Z"), ev("c1", "TaskStarted", "2026-07-01T02:00:00Z"), ev("c1", "GateApproved", "2026-07-05T00:00:00Z")]),
], "2026-07-23T00:00:00Z");

const cockpit: FinancialCockpitSummary = {
  organizationId: "org-1", projectId: "p1", currency: "USD",
  originalBudget: 100_000, currentBaseline: 100_000,
  authorizedFunding: 100_000, releasedFunding: 60_000,
  currentCommitment: 20_000, outstandingCommitment: 5_000,
  actualCost: 50_000, openAccrual: 2_000, settledPayments: 30_000,
  remainingReserve: 5_000, approvedChangesNotPosted: 0,
  latestEac: 130_000, p50Eac: 125_000, p80Eac: 140_000,
  cpi: 0.7, spi: 0.85, qualityStatus: "available",
  pendingApprovals: 0, reconciliationExceptions: 0, unverifiedActuals: 0,
  currencyMismatches: 0, dataDate: "2026-07-20",
};
const finance = buildFinanceOverlayModel([cockpit]);

const overlays: PmoPiOverlaysData = {
  risk: buildRiskOverlay(
    [{ id: "r1", projectId: "p1", title: "Vendor slip", category: "schedule", probability: "high", impact: "critical", severity: "critical", status: "open", linkedTaskId: "t1" }],
    [{ projectId: "p1", predecessorId: "t1", successorId: "t2" }, { projectId: "p1", predecessorId: "t2", successorId: "t3" }],
  ),
  dependencies: buildDependencyOverlay([{ projectId: "p1", predecessorId: "t1", successorId: "t2" }]),
  capacity: [{ projectId: "p1", hasCapacityInputs: true, workforceAvailabilityPercent: 40, overallocatedResourceCount: 2, atRiskMilestoneCount: 1, unassignedCriticalTaskCount: 0 }],
};

describe("buildInsights (CAP-047 M7)", () => {
  const insights = buildInsights({ flow, finance, overlays, projectNames: { p1: "Torre" }, generatedAt: "2026-07-23T00:00:00Z" });

  it("produces insights for process, finance, risk and capacity rules", () => {
    const rules = insights.map((i) => i.rule);
    expect(rules).toContain("bottleneck_pressure");
    expect(rules).toContain("rework_hotspot");
    expect(rules).toContain("cost_efficiency");
    expect(rules).toContain("forecast_overrun");
    expect(rules).toContain("systemic_risk");
    expect(rules).toContain("capacity_pressure");
  });

  it("BLOCKING: 100% of insights carry complete evidence — no exceptions", () => {
    expect(insights.length).toBeGreaterThan(0);
    for (const i of insights) {
      expect(i.evidence.formulas.length, i.id).toBeGreaterThan(0);
      expect(i.evidence.projections.length, i.id).toBeGreaterThan(0);
      expect(i.evidence.timestamps.length, i.id).toBeGreaterThan(0);
      expect(i.evidence.limitations.length, i.id).toBeGreaterThan(0);
      expect(i.evidence.limitations, i.id).toContain("temporal_order_is_not_causality");
      expect(i.confidence, i.id).toBeGreaterThan(0);
      expect(i.confidence, i.id).toBeLessThanOrEqual(1);
      expect(i.affected.length, i.id).toBeGreaterThan(0);
      expect(i.affectedProjectCount, i.id).toBeGreaterThan(0);
      expect(i.title.en.length && i.title.es.length, i.id).toBeTruthy();
      expect(i.recommendedAction.en.length && i.recommendedAction.es.length, i.id).toBeTruthy();
      expect(i.knowledgeVersion, i.id).toBe("pmo-pi-knowledge-v1");
      expect(i.ruleSnapshotVersion, i.id).toBe("pmo-pi-rules-v1");
    }
  });

  it("uses executive language first and keeps technical events inside evidence", () => {
    const processInsights = insights.filter((item) =>
      ["bottleneck_pressure", "rework_hotspot"].includes(item.rule),
    );
    for (const item of processInsights) {
      expect(item.title.en).not.toMatch(/TaskStarted|TaskCompleted|GateApproved/);
      expect(item.title.es).not.toMatch(/TaskStarted|TaskCompleted|GateApproved/);
      expect(item.evidence.technicalEventTypes?.length).toBeGreaterThan(0);
      expect(item.evidence.cutoffDate).toBe("2026-07-23T00:00:00Z");
    }
  });

  it("sorts critical first and is deterministic", () => {
    expect(insights[0].severity).toBe("critical");
    const again = buildInsights({ flow, finance, overlays, projectNames: { p1: "Torre" }, generatedAt: "2026-07-23T00:00:00Z" });
    expect(again).toEqual(insights);
  });

  it("returns no insights without data — never invents", () => {
    expect(buildInsights({ flow: null, finance: null, overlays: null, projectNames: {}, generatedAt: "2026-07-23T00:00:00Z" })).toEqual([]);
  });
});

describe("simulateWhatIf (CAP-047 M7)", () => {
  const inputs: WhatIfInputs = {
    financeRows: finance.rows,
    criticalRiskCount: overlays.risk.criticalOpenCount,
    systemicRisks: overlays.risk.systemic,
    capacity: overlays.capacity,
  };

  it("with an empty scenario, simulated equals current (labels aside)", () => {
    const r = simulateWhatIf(inputs, EMPTY_SCENARIO);
    expect(r.current.label).toBe("current");
    expect(r.simulated.label).toBe("simulated");
    expect({ ...r.simulated, label: "current" }).toEqual(r.current);
  });

  it("budget delta moves BAC and VAC while EAC stays (honest effect)", () => {
    const r = simulateWhatIf(inputs, { ...EMPTY_SCENARIO, budgetDeltaByProject: { p1: 40_000 } });
    expect(r.simulated.totalBaseline).toBe(r.current.totalBaseline + 40_000);
    expect(r.simulated.totalEac).toBe(r.current.totalEac);
    expect(r.simulated.totalVac).toBe(r.current.totalVac + 40_000);
  });

  it("excluding a critical systemic risk reduces both counters", () => {
    const riskId = overlays.risk.systemic[0].riskId;
    const r = simulateWhatIf(inputs, { ...EMPTY_SCENARIO, excludedRiskIds: [riskId] });
    expect(r.simulated.systemicRiskCount).toBe(r.current.systemicRiskCount - 1);
    expect(r.simulated.criticalRiskCount).toBe(r.current.criticalRiskCount - 1);
  });

  it("never mutates its inputs and never persists (pure + declared ephemeral)", () => {
    const frozen = JSON.stringify(inputs);
    const r = simulateWhatIf(inputs, { budgetDeltaByProject: { p1: 10 }, excludedRiskIds: ["x"], availabilityDeltaPct: 10 });
    expect(JSON.stringify(inputs)).toBe(frozen);
    expect(r.limitations).toContain("simulation_is_ephemeral_never_persisted");
    expect(r.limitations).toContain("schedule_simulation_not_available_yet");
  });

  it("clamps availability to 0–100", () => {
    const r = simulateWhatIf(inputs, { ...EMPTY_SCENARIO, availabilityDeltaPct: 90 });
    expect(r.simulated.avgAvailabilityPct).toBe(100);
  });
});
