// ============================================================================
// ISABELLA-RECOMMENDATION-NEXT-BEST-ACTION-ENGINE — safety boundaries + server
// ============================================================================
// Advisory only: no execution, no mutation, human approval always required,
// read-only. Server entry reuses a provided context/analysis or the approved
// Task 2/3/4 builders — mocked here (no live DB).
// ============================================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";

const h = vi.hoisted(() => ({ calls: 0, ctx: null as unknown }));
vi.mock("@/lib/isabella/process-context", () => ({
  buildIsabellaProcessContext: async () => {
    h.calls += 1;
    return h.ctx;
  },
}));

import { assembleRecommendationPlan, buildIsabellaRecommendationPlan, formatRecommendationPlanForIsabella } from "@/lib/isabella/recommendations";
import { assembleRootCauseAnalysis } from "@/lib/isabella/root-cause";
import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";
import type { IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence/types";

function packet(): IsabellaEvidencePacket {
  return { evidenceId: "e1", evidenceType: "blocker", sourceKind: "risk_decision_approval_blocker", sourceId: "task:t1", projectId: "p1", organizationId: "org1", title: "QA", summary: "Blocked: env down", citationLabel: "Recorded blocker", citationRef: "blocker:t1", confidence: "high", visibility: "project" };
}
function readyCtx(): IsabellaProcessContext {
  return {
    scope: { projectId: "p1", organizationId: "org1", userId: "u1", locale: "en" },
    project: { projectId: "p1", name: "Tower A", citationRef: "project:p1" },
    snapshotAt: "2026-07-15T00:00:00Z", included: ["project", "tasks", "milestones", "blockers"],
    evidencePackets: [], citations: [],
    taskContext: { totalVisibleTasks: 4, tasks: [], subtasks: [], byStatus: { in_progress: 2, not_started: 1 }, byPriority: {}, withoutMilestoneCount: 1, withoutOwnerCount: 2, overdueCount: 1, blockedCount: 1 },
    processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [packet()] },
    limitations: ["Risk evidence is not available in this layer yet."], status: "ready",
  };
}

describe("advisory safety guarantees", () => {
  const c = readyCtx();
  const plan = assembleRecommendationPlan(c, assembleRootCauseAnalysis(c, undefined, undefined, "en"), undefined, "en");
  it("every recommendation requires human approval and is not executable now", () => {
    expect(plan.recommendations.length).toBeGreaterThan(0);
    for (const r of plan.recommendations) {
      expect(r.humanApprovalRequired).toBe(true);
      expect(r.executableNow).toBe(false);
    }
  });
  it("formatter never claims an action was taken and never guarantees an outcome", () => {
    const text = formatRecommendationPlanForIsabella(plan, "en").toLowerCase();
    expect(text).toMatch(/not executed automatically/);
    expect(text).not.toMatch(/i assigned|i moved|i fixed|i changed|will solve|guaranteed/);
  });
});

describe("server entry", () => {
  it("uses the Task 2 builder + derives diagnosis/root-cause when none supplied", async () => {
    h.calls = 0; h.ctx = readyCtx();
    const plan = await buildIsabellaRecommendationPlan({ projectId: "p1", locale: "en" });
    expect(h.calls).toBe(1);
    expect(plan.status).toBe("ready");
    expect(plan.recommendations[0].category).toBe("resolve_explicit_blocker");
  });
  it("reuses a provided context WITHOUT calling the builder", async () => {
    h.calls = 0;
    const plan = await buildIsabellaRecommendationPlan({ context: readyCtx(), locale: "en" });
    expect(h.calls).toBe(0);
    expect(plan.projectId).toBe("p1");
  });
});

describe("import boundaries (read-only, no raw sources, no mutation)", () => {
  const dir = fileURLToPath(new URL("../", import.meta.url));
  it("never queries the DB / event log / process graph and never mutates", () => {
    for (const f of ["types.ts", "categories.ts", "candidates.ts", "scoring.ts", "dedupe.ts", "evidence.ts", "engine.ts", "formatter.ts", "index.ts"]) {
      const src = readFileSync(dir + f, "utf8");
      expect(src, f).not.toMatch(/from\s+["']@\/lib\/supabase/);
      expect(src, f).not.toMatch(/\.from\(["']/);
      expect(src, f).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
      expect(src, f).not.toMatch(/project_event_log|process_nodes|process_edges/);
    }
  });
});
