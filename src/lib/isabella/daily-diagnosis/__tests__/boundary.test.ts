// ============================================================================
// ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE — boundaries + server entry
// ============================================================================
// No root-cause conclusions, no recommendation plans, read-only, consumes the
// approved context builder (never raw project data). Server entry uses a
// provided context or the Task 2 builder — mocked here (no live DB).
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

import { assembleDailyDiagnosis, buildIsabellaDailyProcessDiagnosis, formatDailyDiagnosisForIsabella } from "@/lib/isabella/daily-diagnosis";
import type { IsabellaProcessContext } from "@/lib/isabella/process-context/types";

function readyCtx(): IsabellaProcessContext {
  return {
    scope: { projectId: "p1", organizationId: "org1", userId: "u1", locale: "en" },
    project: { projectId: "p1", name: "Tower A", citationRef: "project:p1" },
    snapshotAt: "2026-07-15T00:00:00Z",
    included: ["project", "tasks", "milestones", "blockers"],
    evidencePackets: [],
    citations: [],
    taskContext: { totalVisibleTasks: 3, tasks: [], subtasks: [], byStatus: { in_progress: 1, done: 1, not_started: 1 }, byPriority: {}, withoutMilestoneCount: 1, withoutOwnerCount: 1, overdueCount: 1, blockedCount: 1 },
    processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [] },
    limitations: ["Risk evidence is not available in this layer yet."],
    status: "ready",
  };
}

describe("root-cause / recommendation boundaries", () => {
  const d = assembleDailyDiagnosis(readyCtx(), "en");
  const text = formatDailyDiagnosisForIsabella(d, "en").toLowerCase();

  it("never states a root cause or a recovery/next-best-action plan", () => {
    expect(text).not.toMatch(/root cause is|the cause is|caused by/);
    expect(text).not.toMatch(/next-best-action|recovery plan|mitigation plan|action plan/);
  });
  it("hands off deeper analysis via structured hints (not conclusions)", () => {
    expect(d.nextEngineHints?.some((x) => x.engine === "root_cause")).toBe(true);
    // hints carry a reason but the engine itself asserts no conclusion
    expect(d.sections.blockers.items.every((i) => !/root cause|caused by/i.test(i.detail))).toBe(true);
  });
  it("labels attention signals as such, not formal risks", () => {
    expect(d.sections.risksOrAttention.title.toLowerCase()).toMatch(/attention/);
    expect((d.sections.risksOrAttention.limitations ?? []).join(" ")).toMatch(/risk evidence is not available/i);
  });
});

describe("server entry", () => {
  it("uses the Task 2 context builder when no context is supplied", async () => {
    h.calls = 0;
    h.ctx = readyCtx();
    const d = await buildIsabellaDailyProcessDiagnosis({ projectId: "p1", locale: "en" });
    expect(h.calls).toBe(1);
    expect(d.status).toBe("ready");
    expect(d.overallHealth.level).toBe("at_risk"); // overdue + blocked present
  });
  it("reuses a provided context WITHOUT calling the builder", async () => {
    h.calls = 0;
    const d = await buildIsabellaDailyProcessDiagnosis({ context: readyCtx(), locale: "en" });
    expect(h.calls).toBe(0);
    expect(d.projectId).toBe("p1");
  });
});

describe("import boundaries (read-only, no raw sources)", () => {
  const dir = fileURLToPath(new URL("../", import.meta.url));
  it("never queries the DB / event log / process graph and never mutates", () => {
    for (const f of ["types.ts", "metrics.ts", "health.ts", "sections.ts", "evidence.ts", "formatter.ts", "engine.ts", "index.ts"]) {
      const src = readFileSync(dir + f, "utf8");
      expect(src, f).not.toMatch(/from\s+["']@\/lib\/supabase/);
      expect(src, f).not.toMatch(/\.from\(["']/);
      expect(src, f).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
      expect(src, f).not.toMatch(/project_event_log|process_nodes|process_edges/);
    }
  });
});
