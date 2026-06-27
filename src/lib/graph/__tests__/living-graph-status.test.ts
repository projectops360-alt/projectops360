import { describe, it, expect } from "vitest";
import { buildAdjacency } from "@/lib/graph/living-graph-analysis";
import {
  resolveNodeExecutionStatus,
  computeGraphStatuses,
} from "@/lib/graph/living-graph-status";
import type { LivingGraphNode, LivingGraphEdge } from "@/types/living-graph";

function node(p: Partial<LivingGraphNode> & { id: string }): LivingGraphNode {
  return {
    projectId: "proj",
    nodeType: "task_transition",
    sourceEntityType: "roadmap_tasks",
    sourceEntityId: p.id,
    label: p.id,
    description: null,
    status: null,
    progress: null,
    startDate: null,
    endDate: null,
    durationDays: null,
    occurredAt: "2026-06-27T00:00:00Z",
    createdAt: "",
    updatedAt: "",
    riskLevel: null,
    isBlocked: false,
    isCritical: false,
    milestoneId: null,
    milestoneLabel: null,
    milestoneOrder: null,
    traceabilityScore: null,
    metadata: {},
    ...p,
  };
}

function edge(source: string, target: string): LivingGraphEdge {
  return {
    id: `${source}->${target}`,
    projectId: "proj",
    sourceNodeId: source,
    targetNodeId: target,
    edgeType: "enabled",
    weight: 1,
    lagDays: null,
    isCritical: false,
    riskLevel: null,
    metadata: {},
  };
}

describe("resolveNodeExecutionStatus (REG-008 / ADR-006)", () => {
  it("completed task with a STALE is_blocked flag is Completed, never Blocked", () => {
    const n = node({ id: "done", status: "done", progress: 100, isBlocked: true });
    const adj = buildAdjacency([n], []);
    expect(resolveNodeExecutionStatus(n, adj)).toBe("completed");
  });

  it("non-terminal task with an explicit impediment is Blocked", () => {
    const n = node({ id: "b", status: "in_progress", isBlocked: true });
    const adj = buildAdjacency([n], []);
    expect(resolveNodeExecutionStatus(n, adj)).toBe("blocked");
  });

  it("task waiting on an incomplete predecessor is Waiting on Dependency, not Blocked", () => {
    const pred = node({ id: "pred", status: "in_progress" });
    const succ = node({ id: "succ", status: "not_started" });
    const adj = buildAdjacency([pred, succ], [edge("pred", "succ")]);
    expect(resolveNodeExecutionStatus(succ, adj)).toBe("waiting_on_dependency");
  });

  it("task whose predecessor is complete is not waiting (Ready)", () => {
    const pred = node({ id: "pred", status: "done", progress: 100 });
    const succ = node({ id: "succ", status: "not_started" });
    const adj = buildAdjacency([pred, succ], [edge("pred", "succ")]);
    expect(resolveNodeExecutionStatus(succ, adj)).toBe("ready");
  });

  it("dependency waiting is NEVER counted as blocked", () => {
    const pred = node({ id: "pred", status: "in_progress" });
    const succ = node({ id: "succ", status: "not_started" });
    const adj = buildAdjacency([pred, succ], [edge("pred", "succ")]);
    const status = resolveNodeExecutionStatus(succ, adj);
    expect(status).not.toBe("blocked");
  });
});

describe("computeGraphStatuses — header counts", () => {
  it("counts blocked and waiting separately; a stale-blocked done task counts as neither", () => {
    const doneStale = node({ id: "done", status: "done", progress: 100, isBlocked: true });
    const realBlocked = node({ id: "blk", status: "in_progress", isBlocked: true });
    const pred = node({ id: "pred", status: "in_progress" });
    const waiting = node({ id: "wait", status: "not_started" });
    const nodes = [doneStale, realBlocked, pred, waiting];
    const adj = buildAdjacency(nodes, [edge("pred", "wait")]);
    const { counts } = computeGraphStatuses(nodes, adj);
    expect(counts.blockedCount).toBe(1); // only the real, non-terminal impediment
    expect(counts.waitingCount).toBe(1); // the successor of an incomplete predecessor
  });
});
