import { describe, expect, it } from "vitest";
import type { PmoPiCase, PmoPiFlowModel } from "../contracts";
import {
  buildExecutivePortfolioModel,
  classifyExecutiveStage,
} from "../executive-projection";

const event = (eventId: string, eventType: string, occurredAt: string) => ({
  eventId,
  eventType,
  eventCategory: "execution",
  occurredAt,
  lifecycleClass: "BUSINESS_EVENT",
  isCompensatingEvent: false,
  organizationId: "org-1",
  projectId: "p1",
  caseId: "p1",
  subjectType: "task",
  subjectId: `subject-${eventId}`,
  actorType: "user",
  recordedAt: occurredAt,
  sourceModule: "test",
});

const cases: PmoPiCase[] = [
  {
    caseId: "p1",
    caseLabel: "Proyecto Uno",
    organizationId: "org-1",
    projectId: "p1",
    outcome: "open",
    events: [
      event("e1", "ProjectCreated", "2026-01-01T00:00:00.000Z"),
      event("e2", "TaskCreated", "2026-01-02T00:00:00.000Z"),
      event("e3", "TaskStarted", "2026-01-03T00:00:00.000Z"),
      event("e4", "TaskStatusChanged", "2026-01-04T00:00:00.000Z"),
      event("e5", "TaskStatusChanged", "2026-01-05T00:00:00.000Z"),
    ],
  },
];

const technicalFlow: PmoPiFlowModel = {
  contractVersion: 1,
  scope: { organizationId: "org-1", projectIds: [], level: "organization" },
  nodes: [
    {
      id: "TaskStatusChanged",
      activity: "TaskStatusChanged",
      frequency: 2,
      caseCount: 1,
      avgIncomingWaitingMs: 86_400_000,
      reworkOccurrences: 1,
      bottleneckScore: 1,
      onDominantPath: true,
    },
  ],
  edges: [
    {
      from: "TaskStatusChanged",
      to: "TaskStatusChanged",
      frequency: 1,
      caseCount: 1,
      avgWaitingMs: 86_400_000,
      isRework: true,
      onDominantPath: false,
    },
  ],
  variants: {
    processType: "pmo_process_intelligence",
    totalCases: 1,
    analyzedCases: 1,
    variants: [
      {
        variantId: "v1",
        signature: cases[0].events.map((item) => item.eventType),
        caseIds: ["p1"],
        caseCount: 1,
        frequencyPct: 100,
        avgDurationMs: 345_600_000,
        medianDurationMs: 345_600_000,
        reworkRate: 0.2,
        successRate: null,
        decidedCaseCount: 0,
        isReference: false,
      },
    ],
    assignments: [],
    referenceVariantId: null,
    quality: {
      totalEventsSeen: 5,
      businessEventsUsed: 5,
      excludedEvents: 0,
      casesWithoutEvents: 0,
      casesWithKnownOutcome: 0,
    },
  },
  dominantPath: cases[0].events.map((item) => item.eventType),
  quality: {
    totalEventsSeen: 5,
    businessEventsUsed: 5,
    excludedEvents: 0,
    casesWithoutEvents: 0,
    dataQualityScore: 1,
  },
  generatedAt: "2026-01-05T00:00:00.000Z",
};

describe("executive portfolio projection", () => {
  it("maps technical events into five business stages", () => {
    expect(classifyExecutiveStage("ProjectCreated")).toBe("initiate");
    expect(classifyExecutiveStage("TaskCreated")).toBe("plan");
    expect(classifyExecutiveStage("TaskStarted")).toBe("execute");
    expect(classifyExecutiveStage("TaskStatusChanged")).toBe("control");
    expect(classifyExecutiveStage("ProjectClosed")).toBe("close");
  });

  it("enforces executive visual limits and hides technical detail in the default model", () => {
    const model = buildExecutivePortfolioModel({
      cases,
      technicalFlow,
      projects: [
        {
          id: "p1",
          title: "Proyecto Uno",
          status: "active",
          projectType: "software_development",
          startDate: "2026-01-01",
          targetEndDate: "2026-03-01",
          projectManager: "Ana PM",
          sponsor: "Carlos Sponsor",
        },
      ],
      finance: {
        rows: [
          {
            projectId: "p1",
            currency: "USD",
            originalBudget: 900,
            baseline: 1_000,
            authorizedFunding: 1_000,
            releasedFunding: 800,
            currentCommitment: 100,
            actualCost: 600,
            openAccrual: 50,
            remainingReserve: 100,
            latestEac: 1_200,
            p50Eac: null,
            p80Eac: null,
            cpi: 0.8,
            spi: 0.85,
            vac: -200,
            tcpi: null,
            qualityStatus: "reconciled",
            dataDate: "2026-01-05",
          },
        ],
        alerts: [],
        portfolioCpi: 0.8,
        assumptions: [],
        source: "financial_project_cockpit",
      },
      overlays: null,
      generatedAt: "2026-01-05T00:00:00.000Z",
    });

    expect(model.stages).toHaveLength(5);
    expect(model.connections.length).toBeLessThanOrEqual(8);
    expect(model.variants.length).toBeLessThanOrEqual(3);
    expect(model.bottlenecks.length).toBeLessThanOrEqual(3);
    expect(model.reworkLoops.length).toBeLessThanOrEqual(3);
    expect(model.projects[0]).toMatchObject({
      currentStage: "control",
      originalBudget: 900,
      currentBaseline: 1_000,
      actualCost: 600,
      accruedCost: 50,
      eac: 1_200,
      vac: -200,
    });
  });
});
