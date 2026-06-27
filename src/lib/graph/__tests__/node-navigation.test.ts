import { describe, it, expect } from "vitest";
import { getNodeNavActions, nodeHasNavigation } from "@/lib/graph/node-navigation";
import type { LivingGraphNode } from "@/types/living-graph";

function node(
  p: Omit<Partial<LivingGraphNode>, "sourceEntityType"> & { sourceEntityType: string },
): LivingGraphNode {
  return {
    id: "n",
    projectId: "proj",
    nodeType: "task_transition",
    sourceEntityType: p.sourceEntityType as unknown as LivingGraphNode["sourceEntityType"],
    sourceEntityId: "e1",
    label: "n",
    description: null,
    status: null,
    progress: null,
    startDate: null,
    endDate: null,
    durationDays: null,
    occurredAt: "",
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
  };
}

describe("getNodeNavActions (Sprint #4 — navigation hub)", () => {
  it("a task node deep-links to the Workboard", () => {
    const [a] = getNodeNavActions(node({ sourceEntityType: "roadmap_tasks" }), "p1");
    expect(a.enabled).toBe(true);
    expect(a.href).toBe("/projects/p1/workboard");
    expect(nodeHasNavigation(node({ sourceEntityType: "roadmap_tasks" }))).toBe(true);
  });

  it("a milestone node deep-links to the Execution Map", () => {
    const [a] = getNodeNavActions(node({ sourceEntityType: "milestones" }), "p1");
    expect(a.href).toBe("/projects/p1/execution-map");
  });

  it("a Project Memory node deep-links to Project Memory", () => {
    const [a] = getNodeNavActions(node({ sourceEntityType: "project_memory_items" }), "p1");
    expect(a.href).toBe("/projects/p1/memory");
  });

  it("a record type with no page yet returns a DISABLED action with an honest reason (no fake nav)", () => {
    const [a] = getNodeNavActions(node({ sourceEntityType: "risks" }), "p1");
    expect(a.enabled).toBe(false);
    expect(a.href).toBeNull();
    expect(a.disabledReason_i18n?.en).toBeTruthy();
    expect(nodeHasNavigation(node({ sourceEntityType: "risks" }))).toBe(false);
  });

  it("always returns at least one action", () => {
    expect(getNodeNavActions(node({ sourceEntityType: "unknown_thing" }), "p1").length).toBeGreaterThan(0);
  });
});
