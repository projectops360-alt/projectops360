// ============================================================================
// CAP-048 — performance envelope (guard: PMO-LG-PERFORMANCE)
// ============================================================================
// A representative portfolio — 40 projects, ~2,200 nodes, ~3,700 edges — run
// through the whole pure pipeline. Thresholds are deliberately loose (they are
// a regression alarm, not a benchmark) because CI machines vary; what they
// catch is an accidental O(n²) creeping into a hot path.
//
// The load-bearing performance decision is not measured here but enforced by
// buildGraphWindow: the client never receives the whole portfolio. The default
// view keeps projects collapsed, so the browser renders anchors and their
// inter-project edges rather than 1,600 tasks.
// ============================================================================

import { describe, expect, it } from "vitest";
import { projectNodes, type CanonicalRows } from "../node-projection";
import { projectEdges, type CanonicalRelations } from "../edge-projection";
import { detectSharedResources, type ResourceAllocationRow } from "../shared-resources";
import {
  buildAdjacency,
  computeDegreeCentrality,
  detectCommunities,
  detectCrossProjectDependencies,
  findPath,
  getBlastRadius,
  identifyCriticalNodes,
} from "../graph-algorithms";
import { buildGraphWindow, defaultFilters } from "../subgraph";

const ORG = "org-1";
const PROJECT_COUNT = 40;
const MILESTONES_PER_PROJECT = 6;
const TASKS_PER_PROJECT = 40;
const RISKS_PER_PROJECT = 8;
const SUBTASKS_PER_TASK = 2;
const ALLOCATIONS_PER_PROJECT = 5;
/** Fewer profiles than allocations, so resources genuinely collide across projects. */
const RESOURCE_POOL = 12;

function buildSample() {
  const projects: CanonicalRows["projects"][number][] = [];
  const milestones: CanonicalRows["milestones"][number][] = [];
  const tasks: (CanonicalRows["tasks"][number] & { milestone_id: string | null })[] = [];
  const risks: (CanonicalRows["risks"][number] & {
    linked_task_id: string | null;
    linked_milestone_id: string | null;
  })[] = [];
  const subtasks: CanonicalRows["subtasks"][number][] = [];
  const taskDependencies: CanonicalRelations["taskDependencies"][number][] = [];
  const allocations: ResourceAllocationRow[] = [];

  for (let p = 0; p < PROJECT_COUNT; p += 1) {
    const pid = `p${p}`;
    projects.push({
      id: pid, organization_id: ORG, title: `Project ${p}`, status: "active",
      start_date: "2026-01-01", target_end_date: "2026-12-31", updated_at: null,
    });
    for (let m = 0; m < MILESTONES_PER_PROJECT; m += 1) {
      milestones.push({
        id: `${pid}-m${m}`, organization_id: ORG, project_id: pid, title: `Milestone ${m}`,
        description: null, status: "planned", target_date: null, progress_percent: 0,
        updated_at: null,
      });
    }
    for (let k = 0; k < TASKS_PER_PROJECT; k += 1) {
      tasks.push({
        id: `${pid}-t${k}`, organization_id: ORG, project_id: pid,
        milestone_id: `${pid}-m${k % MILESTONES_PER_PROJECT}`, title: `Task ${k}`,
        description: null, status: "in_progress", priority: "medium",
        start_date: null, end_date: null, is_critical: k % 7 === 0, slack_days: 0,
        estimate_hours: 8, actual_hours: 4, updated_at: null,
      });
      for (let sub = 0; sub < SUBTASKS_PER_TASK; sub += 1) {
        subtasks.push({
          id: `${pid}-t${k}-s${sub}`, organization_id: ORG, project_id: pid,
          task_id: `${pid}-t${k}`, title: `Subtask ${sub}`, description: null,
          status: "not_started", start_date: null, due_date: null,
          estimated_hours: 2, actual_hours: 0, progress: 0, updated_at: null,
        });
      }
      if (k > 0) {
        taskDependencies.push({
          id: `${pid}-d${k}`, organization_id: ORG, project_id: pid,
          predecessor_id: `${pid}-t${k - 1}`, successor_id: `${pid}-t${k}`,
          dependency_type: "finish_to_start", lag_days: 0,
        });
      }
    }
    for (let r = 0; r < RISKS_PER_PROJECT; r += 1) {
      risks.push({
        id: `${pid}-r${r}`, organization_id: ORG, project_id: pid, title: `Risk ${r}`,
        description: null, status: "open", severity: r % 3 === 0 ? "critical" : "medium",
        probability: "high", impact: "high", linked_task_id: `${pid}-t${r}`,
        linked_milestone_id: null, updated_at: null,
      });
    }
    for (let a = 0; a < ALLOCATIONS_PER_PROJECT; a += 1) {
      allocations.push({
        id: `${pid}-a${a}`, organization_id: ORG, project_id: pid,
        resource_profile_id: `rp${(p + a) % RESOURCE_POOL}`, display_name: `Person ${(p + a) % RESOURCE_POOL}`,
        allocation_percent: 60, start_date: "2026-01-01", end_date: "2026-12-31", status: "active",
      });
    }
  }

  return { projects, milestones, tasks, subtasks, risks, taskDependencies, allocations };
}

describe("performance envelope (PMO-LG-PERFORMANCE)", () => {
  const sample = buildSample();

  const rows: CanonicalRows = {
    organization: { id: ORG, name: "Sample Org" },
    projects: sample.projects,
    milestones: sample.milestones,
    tasks: sample.tasks,
    subtasks: sample.subtasks,
    risks: sample.risks,
    decisions: [], resources: [], stakeholders: [], kpis: [], budgetItems: [],
  };

  const nodes = projectNodes(rows);
  const sharedResources = detectSharedResources(sample.allocations, ORG);
  const edges = projectEdges(
    {
      projects: sample.projects, milestones: sample.milestones, tasks: sample.tasks,
      subtasks: sample.subtasks, taskDependencies: sample.taskDependencies, risks: sample.risks,
      budgetItems: [], traceabilityLinks: [],
    },
    sharedResources,
    ORG,
  );
  const index = buildAdjacency(edges);
  const nodeIds = nodes.map((node) => node.id);

  it("produces a portfolio of the expected size", () => {
    // 1 org + 40 projects + 240 milestones + 1,600 tasks + 3,200 subtasks + 320 risks
    expect(nodes).toHaveLength(5_401);
    expect(edges.length).toBeGreaterThan(3_500);
    expect(sharedResources.length).toBeGreaterThan(0);
  });

  it("projects nodes and edges well inside a request budget", () => {
    const start = performance.now();
    const freshNodes = projectNodes(rows);
    projectEdges(
      {
        projects: sample.projects, milestones: sample.milestones, tasks: sample.tasks,
        subtasks: sample.subtasks, taskDependencies: sample.taskDependencies, risks: sample.risks,
        budgetItems: [], traceabilityLinks: [],
      },
      sharedResources,
      ORG,
    );
    const elapsed = performance.now() - start;

    expect(freshNodes.length).toBe(nodes.length);
    expect(elapsed).toBeLessThan(1_000);
  });

  it("detects shared resources without pairing every allocation with every other", () => {
    const start = performance.now();
    detectSharedResources(sample.allocations, ORG);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("computes centrality, communities and critical nodes within budget", () => {
    const start = performance.now();
    const centrality = computeDegreeCentrality(index, nodeIds);
    const crossProject = detectCrossProjectDependencies(edges, nodes);
    identifyCriticalNodes(nodes, index, centrality, crossProject);
    detectCommunities(index, nodeIds);
    expect(performance.now() - start).toBeLessThan(2_000);
  });

  it("answers path and blast-radius queries interactively", () => {
    const start = performance.now();
    findPath(index, "task:p0-t0", "task:p39-t39");
    getBlastRadius(index, "project:p0", 3);
    expect(performance.now() - start).toBeLessThan(300);
  });

  it("hands the client a small window, never the whole portfolio", () => {
    const start = performance.now();
    const window = buildGraphWindow(nodes, edges, {
      zoom: "far",
      expandedProjectIds: [],
      filters: defaultFilters(),
    });
    const elapsed = performance.now() - start;

    // 1 organization + 40 projects — not 5,401 nodes.
    expect(window.nodes).toHaveLength(PROJECT_COUNT + 1);
    expect(elapsed).toBeLessThan(300);
  });

  it("keeps one expanded project bounded", () => {
    const window = buildGraphWindow(nodes, edges, {
      zoom: "near",
      expandedProjectIds: ["p0"],
      filters: defaultFilters(),
    });

    // One project's internals plus every project anchor — still far from the full graph.
    expect(window.nodes.length).toBeLessThan(400);
  });

  it("caps and reports truncation when everything is expanded at full detail", () => {
    const window = buildGraphWindow(nodes, edges, {
      zoom: "near",
      expandedProjectIds: sample.projects.map((project) => project.id),
      filters: defaultFilters(),
      nodeLimit: 600,
    });

    expect(window.nodes).toHaveLength(600);
    expect(window.truncated).toBe(true);
    expect(window.totalNodeCount).toBe(5_401);
  });
});
