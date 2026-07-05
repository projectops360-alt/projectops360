// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION — runtime
// ============================================================================
// Engine orchestration via a MOCKED Task 2 context builder (no live DB).
// ============================================================================

import { describe, it, expect } from "vitest";
import { runIsabellaProcessIntelligence } from "@/lib/isabella/process-intelligence-runtime/runtime";
import type { IsabellaProcessContext, IsabellaContextStatus } from "@/lib/isabella/process-context/types";
import type { IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence/types";

function packet(): IsabellaEvidencePacket {
  return { evidenceId: "e1", evidenceType: "blocker", sourceKind: "risk_decision_approval_blocker", sourceId: "task:t1", projectId: "p1", organizationId: "org1", title: "QA", summary: "Blocked: env down", citationLabel: "Recorded blocker", citationRef: "blocker:t1", confidence: "high", visibility: "project" };
}
function ctx(status: IsabellaContextStatus = "ready", message?: string): IsabellaProcessContext {
  return {
    scope: { projectId: "p1", organizationId: "org1", userId: "u1", locale: "en" },
    project: { projectId: "p1", name: "Tower A", citationRef: "project:p1" },
    snapshotAt: "2026-07-15T00:00:00Z", included: ["project", "tasks", "milestones", "blockers"],
    evidencePackets: [], citations: [{ sourceLabel: "Workboard", entityType: "task", entityTitle: "QA", confidence: "verified" }],
    taskContext: { totalVisibleTasks: 5, tasks: [], subtasks: [], byStatus: { in_progress: 2, not_started: 1 }, byPriority: {}, withoutMilestoneCount: 1, withoutOwnerCount: 2, overdueCount: 1, blockedCount: 1 },
    processSignals: { blockedCount: 1, advancedFindingsAvailable: false, packets: [packet()] },
    limitations: ["Risk evidence is not available in this layer yet."], status, message,
  };
}
const build = (status: IsabellaContextStatus = "ready", message?: string) => async () => ctx(status, message);
const req = (question: string, extra = {}) => ({ question, locale: "en", projectId: "p1", ...extra });

describe("route fallback (existing pipeline handles it)", () => {
  it("product_help and factual_project_data → status fallback, empty answer", async () => {
    const help = await runIsabellaProcessIntelligence(req("How do I create a project?"), { buildContext: build() });
    expect(help.status).toBe("fallback");
    expect(help.answer).toBe("");
    const data = await runIsabellaProcessIntelligence(req("list all blocked tasks"), { buildContext: build() });
    expect(data.status).toBe("fallback");
    expect(data.route).toBe("factual_project_data");
  });
});

describe("engine orchestration", () => {
  it("daily_diagnosis calls diagnosis engine with authorized context", async () => {
    const r = await runIsabellaProcessIntelligence(req("What needs my attention?"), { buildContext: build() });
    expect(r.status).toBe("answered");
    expect(r.route).toBe("daily_diagnosis");
    expect(r.audit.enginesUsed).toEqual(["daily_diagnosis"]);
    expect(r.answer.length).toBeGreaterThan(0);
    expect(r.structuredResult).toBeDefined();
  });
  it("root_cause chains diagnosis + root cause", async () => {
    const r = await runIsabellaProcessIntelligence(req("Why is this blocked?"), { buildContext: build() });
    expect(r.status).toBe("answered");
    expect(r.audit.enginesUsed).toEqual(["daily_diagnosis", "root_cause"]);
  });
  it("recommendation chains diagnosis + root cause + recommendations and requires human approval", async () => {
    const r = await runIsabellaProcessIntelligence(req("What should I do next?"), { buildContext: build() });
    expect(r.status).toBe("answered");
    expect(r.audit.enginesUsed).toEqual(["daily_diagnosis", "root_cause", "recommendations"]);
    expect(r.answer.toLowerCase()).toMatch(/not executed automatically/);
    expect(r.answer.toLowerCase()).toMatch(/requires human approval/);
  });
  it("mixed produces a concise combined answer without long duplication", async () => {
    const r = await runIsabellaProcessIntelligence(req("What is happening and what should I do next?"), { buildContext: build() });
    expect(r.route).toBe("mixed");
    expect(r.answer).toMatch(/What is happening/);
    expect(r.answer).toMatch(/What to do next/);
    expect(r.audit.enginesUsed).toEqual(["daily_diagnosis", "root_cause", "recommendations"]);
  });
});

describe("access + safety states", () => {
  it("unauthorized context → unauthorized, no data leak", async () => {
    const r = await runIsabellaProcessIntelligence(req("Why is this blocked?"), { buildContext: build("unauthorized", "Not authorized") });
    expect(r.status).toBe("unauthorized");
    expect(r.audit.resultStatus).toBe("unauthorized");
  });
  it("missing context → missing_context", async () => {
    const r = await runIsabellaProcessIntelligence(req("What should I do next?"), { buildContext: build("missing_context", "Select a project") });
    expect(r.status).toBe("missing_context");
  });
  it("partial context is answered with limitations", async () => {
    const r = await runIsabellaProcessIntelligence(req("What needs attention?"), { buildContext: build("partial") });
    expect(r.status).toBe("answered");
    expect(r.limitations!.length).toBeGreaterThan(0);
  });
  it("engine route with no scope → needs_clarification, no context call", async () => {
    let called = 0;
    const r = await runIsabellaProcessIntelligence({ question: "What should I do next?", locale: "en" }, { buildContext: async () => { called++; return ctx(); } });
    expect(r.status).toBe("needs_clarification");
    expect(called).toBe(0);
  });
});

describe("audit metadata (compact, no raw payloads)", () => {
  it("records route/engines/counts without structured bodies", async () => {
    const r = await runIsabellaProcessIntelligence(req("What should I do next?"), { buildContext: build() });
    const a = r.audit;
    expect(a.processIntelligenceEnabled).toBe(true);
    expect(a.route).toBe("recommendation");
    expect(typeof a.evidenceRefCount).toBe("number");
    expect(typeof a.executionMs).toBe("number");
    // No raw rows / payloads embedded in the audit.
    const json = JSON.stringify(a);
    expect(json).not.toMatch(/env down|Blocked:/);
  });
});
