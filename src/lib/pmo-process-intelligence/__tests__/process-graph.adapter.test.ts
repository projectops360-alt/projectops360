import { describe, expect, it } from "vitest";
import type {
  PmoPiExecutivePortfolioModel,
  PmoPiExecutiveProject,
  PmoPiExecutiveStage,
  PmoPiExecutiveStageKey,
} from "../executive-projection";
import { EXECUTIVE_STAGE_ORDER } from "../executive-projection";
import { buildProcessGraphProjection } from "../process-graph.adapter";
import type {
  ProcessGraphActivity,
  ProcessGraphBuildInput,
  ProcessGraphHierarchyModel,
} from "../process-graph.types";

const ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
const PROJECT_ID = "10000000-0000-4000-8000-000000000001";
const MILESTONE_ID = "20000000-0000-4000-8000-000000000001";

function stage(key: PmoPiExecutiveStageKey): PmoPiExecutiveStage {
  const containsProject = key === "execute";
  return {
    key,
    projectIds: containsProject ? [PROJECT_ID] : [],
    projectCount: containsProject ? 1 : 0,
    activeProjectCount: containsProject ? 1 : 0,
    averageCycleTimeMs: containsProject ? 86_400_000 : null,
    targetCycleTimeMs: null,
    outsideSlaProjectCount: null,
    reworkOccurrences: 0,
    baselineBudget: containsProject ? 100_000 : 0,
    actualCost: containsProject ? 40_000 : 0,
    eac: containsProject ? 110_000 : 0,
    forecastVariance: containsProject ? -10_000 : 0,
    activeRisks: containsProject ? 2 : 0,
    overallocatedResources: 0,
    trend: containsProject ? "worsening" : "unavailable",
    status: containsProject ? "attention" : "insufficient",
  };
}

const project: PmoPiExecutiveProject = {
  id: PROJECT_ID,
  title: "Atlas SAP",
  status: "active",
  projectType: "sap",
  startDate: "2026-01-01",
  targetEndDate: "2026-10-31",
  projectManager: "Ana PM",
  sponsor: "Carlos Sponsor",
  currentStage: "execute",
  healthScore: 62,
  processEventCount: 20,
  cycleTimeMs: 86_400_000,
  forecastFinish: "2026-11-15",
  delayProbabilityPct: 45,
  originalBudget: 90_000,
  currentBaseline: 100_000,
  approvedBudget: 100_000,
  committedCost: 50_000,
  actualCost: 40_000,
  accruedCost: 5_000,
  etc: 70_000,
  eac: 110_000,
  vac: -10_000,
  cpi: 0.88,
  spi: 0.91,
  contingency: 10_000,
  criticalRisks: 2,
  activeRisks: 4,
  overallocatedResources: 0,
  dependencyCount: 1,
  latestSignificantEvents: [],
};

const executive: PmoPiExecutivePortfolioModel = {
  stages: EXECUTIVE_STAGE_ORDER.map(stage),
  connections: [],
  variants: [],
  bottlenecks: [{ stage: "execute", affectedProjectIds: [PROJECT_ID], affectedProjectCount: 1, averageWaitMs: 1000, financialImpact: 0, score: 1, technicalActivities: [] }],
  reworkLoops: [],
  projects: [project],
  portfolioHealthScore: 62,
  generatedAt: "2026-07-23T00:00:00.000Z",
  dataQualityScore: 0.86,
  limitations: ["portfolio_and_program_taxonomy_not_configured"],
};

function activity(index: number): ProcessGraphActivity {
  const suffix = (index + 1).toString(16).padStart(12, "0");
  return {
    id: `30000000-0000-4000-8000-${suffix}`,
    organizationId: ORGANIZATION_ID,
    projectId: PROJECT_ID,
    milestoneId: MILESTONE_ID,
    title: `Activity ${index + 1}`,
    description: null,
    status: index === 0 ? "blocked" : "in_progress",
    priority: "medium",
    progressPercent: index,
    estimateHours: 8,
    actualHours: 4,
    startDate: null,
    endDate: null,
    isBlocked: index === 0,
    blockerReason: index === 0 ? "Test blocker" : null,
    isCritical: index < 3,
    assignedTo: null,
    orderIndex: index,
  };
}

function hierarchy(activityCount = 2): ProcessGraphHierarchyModel {
  const activities = Array.from({ length: activityCount }, (_, index) =>
    activity(index),
  );
  return {
    organizationId: ORGANIZATION_ID,
    milestones: [
      {
        id: MILESTONE_ID,
        organizationId: ORGANIZATION_ID,
        projectId: PROJECT_ID,
        title: "Deployment",
        description: "Deploy the SAP solution.",
        status: "in_progress",
        startDate: null,
        targetDate: "2026-09-30",
        completedDate: null,
        progressPercent: 50,
        orderIndex: 0,
      },
    ],
    activities,
    dependencies:
      activities.length > 1
        ? [
            {
              id: "40000000-0000-4000-8000-000000000001",
              organizationId: ORGANIZATION_ID,
              projectId: PROJECT_ID,
              predecessorId: activities[0].id,
              successorId: activities[1].id,
              dependencyType: "finish_to_start",
              lagDays: 1,
            },
          ]
        : [],
    truncated: false,
    limitations: [
      "portfolio_and_program_taxonomy_not_configured_in_current_project_schema",
    ],
  };
}

function input(
  overrides: Partial<ProcessGraphBuildInput> = {},
): ProcessGraphBuildInput {
  return {
    locale: "en",
    base: "",
    executive,
    hierarchy: hierarchy(),
    navigation: {
      level: "organization",
      stageKey: null,
      projectId: null,
      milestoneId: null,
    },
    semanticZoom: "far",
    expandedNodeIds: new Set(),
    layer: "process",
    ...overrides,
  };
}

describe("Process Intelligence graph adapter", () => {
  it("starts with five movable stage nodes and honest reference edges", () => {
    const projection = buildProcessGraphProjection(input());

    expect(projection.entities.map((entity) => entity.id)).toEqual([
      "stage:initiate",
      "stage:plan",
      "stage:execute",
      "stage:control",
      "stage:close",
    ]);
    expect(projection.connections).toHaveLength(4);
    expect(
      projection.connections.every((connection) =>
        connection.evidence.includes("no observed transition is claimed"),
      ),
    ).toBe(true);
    expect(projection.connections[0]).toMatchObject({
      sourceLabel: "Initiate",
      targetLabel: "Plan",
      frequency: 0,
    });
  });

  it("uses semantic zoom plus explicit expansion for progressive disclosure", () => {
    const far = buildProcessGraphProjection(
      input({ expandedNodeIds: new Set(["stage:execute"]) }),
    );
    expect(far.entities).toHaveLength(5);

    const intermediate = buildProcessGraphProjection(
      input({
        semanticZoom: "intermediate",
        expandedNodeIds: new Set(["stage:execute"]),
      }),
    );
    expect(intermediate.entities.map((entity) => entity.id)).toContain(
      `project:${PROJECT_ID}`,
    );
  });

  it("drills through project, milestone and canonical activity dependencies", () => {
    const projectView = buildProcessGraphProjection(
      input({
        navigation: {
          level: "project",
          stageKey: "execute",
          projectId: PROJECT_ID,
          milestoneId: null,
        },
        semanticZoom: "close",
      }),
    );
    expect(projectView.entities.map((entity) => entity.kind)).toEqual([
      "project",
      "milestone",
    ]);

    const milestoneView = buildProcessGraphProjection(
      input({
        navigation: {
          level: "milestone",
          stageKey: "execute",
          projectId: PROJECT_ID,
          milestoneId: MILESTONE_ID,
        },
        semanticZoom: "deep",
        layer: "dependencies",
      }),
    );
    expect(milestoneView.entities.filter((entity) => entity.kind === "activity")).toHaveLength(2);
    expect(milestoneView.connections).toHaveLength(1);
    expect(milestoneView.connections[0]).toMatchObject({
      kind: "dependency",
      sourceLabel: "Activity 1",
      targetLabel: "Activity 2",
    });
  });

  it("builds a 200-activity deep view without changing canonical hierarchy", () => {
    const denseInput = input({
      hierarchy: hierarchy(200),
      navigation: {
        level: "milestone",
        stageKey: "execute",
        projectId: PROJECT_ID,
        milestoneId: MILESTONE_ID,
      },
      semanticZoom: "deep",
    });
    const started = performance.now();
    const projection = buildProcessGraphProjection(denseInput);
    const elapsedMs = performance.now() - started;

    expect(projection.entities).toHaveLength(201);
    expect(projection.limitations).toContain(
      "portfolio_and_program_taxonomy_not_configured_in_current_project_schema",
    );
    expect(elapsedMs).toBeLessThan(1_000);
  });
});
