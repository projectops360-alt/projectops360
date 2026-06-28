import { describe, it, expect } from "vitest";
import { computeCloseoutReadiness, type CloseoutMetrics } from "../closeout";
import type { CloseoutRiskRecord } from "../closeout-criteria";

// REG-017 — the "Risks resolved" closeout requirement must be record-backed:
// its count equals the number of open-risk records it can show, and those exact
// records are exposed on the check for the UI to disclose inline.

function risk(id: string, status: string): CloseoutRiskRecord {
  return { id, title: `Risk ${id}`, status, severity: "medium", ownerUserId: null, ownerName: null };
}

function metrics(openRecords: CloseoutRiskRecord[]): CloseoutMetrics {
  return {
    schedule: {
      totalTasks: 5, doneTasks: 5, openTasks: 0, blockedTasks: 0, deferredTasks: 0,
      completionPct: 100, lateTasks: 0, totalMilestones: 1, completedMilestones: 1,
      pendingMilestones: 0, onTimeMilestones: 1, plannedDays: 10, actualDays: 10, scheduleVariancePct: 0,
    },
    budget: { estimated: 0, committed: 0, actual: 0, variance: 0, variancePct: null, currency: "USD", hasData: false, reconciled: false },
    risks: {
      total: openRecords.length, open: openRecords.filter((r) => r.status !== "mitigating").length,
      mitigated: openRecords.filter((r) => r.status === "mitigating").length, closed: 0, resolvedPct: 0,
      openRecords,
      diagnostics: { source: "test", includedIds: openRecords.map((r) => r.id), excluded: [], count: openRecords.length, resolveRoute: null, generatedAt: "2026-06-28T00:00:00Z" },
    },
    rfis: { total: 0, open: 0, closed: 0 },
    submittals: { total: 0, pending: 0, approved: 0 },
    decisions: 0, decisionsPending: 0,
    actions: { total: 0, completed: 0, open: 0 },
    followUps: 0, meetings: 1,
  };
}

const openRisksCheck = (m: CloseoutMetrics) =>
  computeCloseoutReadiness(m).checks.find((c) => c.key === "open_risks")!;

describe("REG-017 — record-backed open-risks readiness check", () => {
  it("count equals openRecords.length and exposes the exact recordIds", () => {
    const m = metrics([risk("r1", "open"), risk("r2", "mitigating")]);
    const check = openRisksCheck(m);
    expect(check.count).toBe(2);
    expect(check.recordIds).toEqual(["r1", "r2"]);
    expect(check.records).toHaveLength(2);
    expect(check.recordsConsistent).toBe(true);
    expect(check.level).toBe("fail"); // blocking
  });

  it("passes (count 0, no records) when there are no open risks", () => {
    const check = openRisksCheck(metrics([]));
    expect(check.count).toBe(0);
    expect(check.recordIds).toEqual([]);
    expect(check.level).toBe("pass");
  });

  it("if count is 2, exactly 2 matching records are exposed (acceptance #9)", () => {
    const check = openRisksCheck(metrics([risk("a", "open"), risk("b", "open")]));
    expect(check.count).toBe(check.records!.length);
    expect(check.count).toBe(2);
  });

  it("readiness is blocked while open risks remain, ready once cleared", () => {
    expect(computeCloseoutReadiness(metrics([risk("r1", "open")])).ready).toBe(false);
    expect(computeCloseoutReadiness(metrics([])).ready).toBe(true);
  });
});
