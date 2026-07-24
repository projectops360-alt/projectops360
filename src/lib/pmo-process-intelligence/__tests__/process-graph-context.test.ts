import { describe, expect, it } from "vitest";
import { sanitizeProcessGraphScreenContext } from "../process-graph-assistant.server";
import { buildProcessGraphViewKey } from "../process-graph-layout-storage";
import type { ProcessGraphScreenContext } from "../process-graph.types";

const USER_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";
const SPOOFED_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000999";
const PROJECT_ID = "10000000-0000-4000-8000-000000000001";

function context(): ProcessGraphScreenContext {
  return {
    route: "/es/process-intelligence",
    dashboardMode: "process-intelligence-beta",
    organizationId: SPOOFED_ORGANIZATION_ID,
    portfolioId: "not-trusted",
    programId: "not-trusted",
    projectId: PROJECT_ID,
    hierarchyLevel: "project",
    activeLayer: "finance",
    hoveredNodeId: `project:${PROJECT_ID}`,
    hoveredEdgeId: "contains:stage:execute:project:test",
    selectedNodeIds: [`project:${PROJECT_ID}`],
    selectedEdgeIds: [],
    visibleNodeIds: [`project:${PROJECT_ID}`],
    visibleNodeCount: 1,
    visibleEdgeIds: [],
    visibleEdgeCount: 0,
    dateRange: { from: "2026-01-01", to: "2026-12-31" },
    filters: {
      projectIds: [PROJECT_ID],
      search: "Atlas",
      stageKey: "execute",
    },
    viewport: { x: 10, y: 20, zoom: 1.2 },
    currentMetrics: { healthScore: 62 },
    activeBottleneck: "stage:execute",
    activeVariant: "variant-1",
    dataQuality: 0.86,
    language: "es",
    visibleNodeLabels: ["Atlas SAP"],
  };
}

describe("Process Intelligence screen context", () => {
  it("re-stamps the trusted tenant and rejects client taxonomy claims", () => {
    const sanitized = sanitizeProcessGraphScreenContext(
      context(),
      USER_ORGANIZATION_ID,
    );

    expect(sanitized).toMatchObject({
      organizationId: USER_ORGANIZATION_ID,
      portfolioId: null,
      programId: null,
      projectId: PROJECT_ID,
    });
  });

  it("scopes saved layouts by hierarchy, layer, project filters and dates", () => {
    const base = {
      navigation: {
        level: "project" as const,
        stageKey: "execute" as const,
        projectId: PROJECT_ID,
        milestoneId: null,
      },
      activeLayer: "process",
      projectIds: [PROJECT_ID],
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    };
    const processKey = buildProcessGraphViewKey(base);
    const financeKey = buildProcessGraphViewKey({
      ...base,
      activeLayer: "finance",
    });
    const otherDateKey = buildProcessGraphViewKey({
      ...base,
      dateTo: "2027-01-31",
    });

    expect(processKey).not.toBe(financeKey);
    expect(processKey).not.toBe(otherDateKey);
    expect(processKey).toContain("project");
    expect(processKey).toContain(PROJECT_ID);
  });
});
