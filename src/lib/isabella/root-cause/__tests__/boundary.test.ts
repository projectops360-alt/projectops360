// ============================================================================
// ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE — boundaries + server entry
// ============================================================================
// No recommendations/plans, no invented capacity/dependency, read-only, consumes
// the approved context/diagnosis builders (never raw project data). Server entry
// reuses a provided context or the Task 2/3 builders — mocked here (no live DB).
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

import { assembleRootCauseAnalysis, buildIsabellaRootCauseAnalysis, formatRootCauseAnalysisForIsabella, classifyConstraintSignals, classifyRootCauseFindings } from "@/lib/isabella/root-cause";
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
    taskContext: { totalVisibleTasks: 3, tasks: [], subtasks: [], byStatus: { in_progress: 2, not_started: 1 }, byPriority: {}, withoutMilestoneCount: 1, withoutOwnerCount: 2, overdueCount: 1, blockedCount: 1 },
    processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [packet()] },
    limitations: ["Risk evidence is not available in this layer yet."], status: "ready",
  };
}

describe("recommendation / invention boundaries", () => {
  const a = assembleRootCauseAnalysis(readyCtx(), undefined, undefined, "en");
  const text = formatRootCauseAnalysisForIsabella(a, "en").toLowerCase();
  it("never emits a recommendation / next-best-action / recovery / mitigation plan", () => {
    expect(text).not.toMatch(/next-best-action|recovery plan|mitigation plan|action plan|you should do|do these \d/);
  });
  it("hands off to the recommendation engine as a structured hint, not a plan", () => {
    expect(a.recommendationHandoffHints.length).toBeGreaterThan(0);
    expect(a.recommendationHandoffHints.every((x) => x.allowedForRecommendationEngine === true)).toBe(true);
  });
  it("does not invent capacity / dependency / decision / approval evidence", () => {
    const cs = classifyConstraintSignals(readyCtx(), "en").map((c) => c.type);
    expect(cs).not.toContain("capacity_signal");
    expect(cs).not.toContain("dependency_constraint");
    expect(cs).not.toContain("decision_delay");
    expect(cs).not.toContain("approval_delay");
    const owner = classifyRootCauseFindings(readyCtx(), classifyConstraintSignals(readyCtx(), "en"), "en").find((f) => f.constraintType === "ownership_gap")!;
    expect((owner.limitations ?? []).join(" ")).toMatch(/capacity/i); // capacity is a limitation, not a confirmed cause
  });
});

describe("server entry", () => {
  it("uses the Task 2 context builder + derives the diagnosis when none supplied", async () => {
    h.calls = 0; h.ctx = readyCtx();
    const a = await buildIsabellaRootCauseAnalysis({ projectId: "p1", locale: "en" });
    expect(h.calls).toBe(1);
    expect(a.status).toBe("ready");
    expect(a.analysisScope.source).toBe("daily_diagnosis"); // diagnosis derived from ready context
    expect(a.findings.some((f) => f.classification === "confirmed_cause")).toBe(true);
  });
  it("reuses a provided context WITHOUT calling the builder", async () => {
    h.calls = 0;
    const a = await buildIsabellaRootCauseAnalysis({ context: readyCtx(), locale: "en" });
    expect(h.calls).toBe(0);
    expect(a.projectId).toBe("p1");
  });
});

describe("import boundaries (read-only, no raw sources)", () => {
  const dir = fileURLToPath(new URL("../", import.meta.url));
  it("never queries the DB / event log / process graph and never mutates", () => {
    for (const f of ["types.ts", "taxonomy.ts", "signals.ts", "evidence-chain.ts", "confidence.ts", "engine.ts", "formatter.ts", "index.ts"]) {
      const src = readFileSync(dir + f, "utf8");
      expect(src, f).not.toMatch(/from\s+["']@\/lib\/supabase/);
      expect(src, f).not.toMatch(/\.from\(["']/);
      expect(src, f).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
      expect(src, f).not.toMatch(/project_event_log|process_nodes|process_edges/);
    }
  });
});
