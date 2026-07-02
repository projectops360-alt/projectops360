// ============================================================================
// REG-018 / CAP-001 — Living Graph milestone census == canonical owner
// ============================================================================
// Protects against the projection-consistency violation where the Living Graph
// milestone card counter + UX-008 edge tooltip derived task counts from
// process_nodes (which drop not_started tasks) while the Workboard read
// roadmap_tasks — showing DIFFERENT task info for the SAME milestone.
//
// Contract: any projection of "a milestone's tasks" must consume the canonical
// census over roadmap_tasks (computeMilestoneTaskCensus). "Different views,
// same truth." This test fails if the Living Graph ever undercounts again.
// ============================================================================

import { describe, it, expect } from "vitest";
import { aggregateByMilestone } from "@/lib/graph/living-graph-analysis";
import { computeMilestoneTaskCensus } from "@/lib/roadmap/milestone-task-census";
import type { LivingGraphNode } from "@/types/living-graph";
import type { RoadmapTask } from "@/types/database";

const M = "11111111-1111-1111-1111-111111111111";

function task(p: Partial<RoadmapTask> & { id: string }): RoadmapTask {
  return {
    project_id: "proj",
    organization_id: "org",
    milestone_id: M,
    title: p.id,
    status: "not_started",
    is_blocked: false,
    ...p,
  } as RoadmapTask;
}

// A graph task node — as normalized from a process_node (only exists for tasks
// that transitioned; not_started tasks have none).
function taskNode(p: Partial<LivingGraphNode> & { id: string }): LivingGraphNode {
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
    occurredAt: "2026-07-01T00:00:00Z",
    createdAt: "",
    updatedAt: "",
    riskLevel: null,
    isBlocked: false,
    isCritical: false,
    milestoneId: M,
    milestoneLabel: "Phase 1",
    milestoneOrder: 0,
    traceabilityScore: null,
    metadata: {},
    ...p,
  };
}

describe("computeMilestoneTaskCensus (REG-018 canonical resolver)", () => {
  it("counts every owner task incl. not_started; done/blocked follow canonical rules", () => {
    const tasks = [
      task({ id: "t-done", status: "done" }),
      task({ id: "t-active", status: "in_progress" }),
      task({ id: "t-blocked", status: "in_progress", is_blocked: true }),
      task({ id: "t-new", status: "not_started" }),
      task({ id: "t-stale", status: "done", is_blocked: true }), // stale flag → not blocked
    ];
    const census = computeMilestoneTaskCensus(tasks).get(M)!;

    expect(census.tasksTotal).toBe(5); // includes not_started
    expect(census.tasksDone).toBe(2); // t-done + t-stale
    expect(census.tasksStarted).toBe(2); // t-active + t-blocked (not not_started)
    expect(census.anyBlocked).toBe(true); // t-blocked
    expect(census.taskList).toHaveLength(5);
    // REG-008/010: a completed task with a stale is_blocked flag is never blocked
    expect(census.taskList.find((t) => t.id === "t-stale")!.isBlocked).toBe(false);
  });

  it("omits tasks without a milestone", () => {
    const census = computeMilestoneTaskCensus([task({ id: "orphan", milestone_id: null })]);
    expect(census.size).toBe(0);
  });
});

describe("aggregateByMilestone milestone card == owner (REG-018 / CAP-001)", () => {
  // Owner: 3 tasks — but only the transitioned ones have process nodes.
  const owner = [
    task({ id: "a", status: "done" }),
    task({ id: "b", status: "in_progress" }),
    task({ id: "c", status: "not_started" }), // <-- no process node exists
  ];
  const graphNodes = [
    taskNode({ id: "a", status: "done" }),
    taskNode({ id: "b", status: "in_progress" }),
    // note: no node for "c" — this is exactly what CAP-001 reproduced
  ];

  it("uses the canonical census: counts + taskList match the owner (incl. not_started)", () => {
    const census = computeMilestoneTaskCensus(owner);
    const { nodes } = aggregateByMilestone(graphNodes, [], census);
    const card = nodes.find((n) => n.id === `milestone:${M}`)!;

    expect(card.metadata.tasksTotal).toBe(3); // matches Workboard, NOT the 2 nodes
    expect(card.metadata.tasksDone).toBe(1);
    const ids = (card.metadata.taskList as { id: string }[]).map((t) => t.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("regression guard: WITHOUT a census it undercounts not_started (the old bug)", () => {
    const { nodes } = aggregateByMilestone(graphNodes, []);
    const card = nodes.find((n) => n.id === `milestone:${M}`)!;
    // Documents the pre-fix behavior the census path must never reproduce.
    expect(card.metadata.tasksTotal).toBe(2);
  });

  it("edge tooltip (UX-008) inherits the canonical taskList of the target milestone", () => {
    const M2 = "22222222-2222-2222-2222-222222222222";
    const owner2 = [
      ...owner,
      task({ id: "d", milestone_id: M2, status: "not_started" }),
      task({ id: "e", milestone_id: M2, status: "in_progress" }),
    ];
    const nodes2 = [
      ...graphNodes,
      taskNode({ id: "e", milestoneId: M2, milestoneLabel: "Phase 2", milestoneOrder: 1, status: "in_progress" }),
    ];
    const census = computeMilestoneTaskCensus(owner2);
    const { edges } = aggregateByMilestone(nodes2, [], census);
    const chain = edges.find((e) => e.metadata.milestone_chain === true)!;
    // The chain edge carries the TARGET milestone's canonical task list (UX-008).
    const tooltipIds = (chain.metadata.taskList as { id: string }[]).map((t) => t.id).sort();
    expect(tooltipIds).toEqual(["d", "e"]);
    expect(chain.metadata.tasks).toBe(2);
  });
});
