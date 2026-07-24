import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutivePortfolioFlow } from "../executive-portfolio-flow";
import {
  EXECUTIVE_STAGE_ORDER,
  type PmoPiExecutivePortfolioModel,
} from "@/lib/pmo-process-intelligence/executive-projection";

const model: PmoPiExecutivePortfolioModel = {
  stages: EXECUTIVE_STAGE_ORDER.map((key, index) => ({
    key,
    projectIds: [`p${index + 1}`],
    projectCount: 1,
    activeProjectCount: 1,
    averageCycleTimeMs: 3_600_000 * (index + 1),
    targetCycleTimeMs: null,
    outsideSlaProjectCount: null,
    reworkOccurrences: index,
    baselineBudget: 100_000,
    actualCost: 40_000,
    eac: 110_000,
    forecastVariance: -10_000,
    activeRisks: index,
    overallocatedResources: index === 3 ? 2 : 0,
    trend: "unavailable",
    status: index === 3 ? "critical" : "stable",
  })),
  connections: [
    { from: "initiate", to: "plan", projectCount: 5, frequency: 12, status: "stable" },
    { from: "plan", to: "execute", projectCount: 4, frequency: 9, status: "stable" },
    { from: "execute", to: "control", projectCount: 3, frequency: 7, status: "attention" },
    { from: "control", to: "close", projectCount: 2, frequency: 3, status: "stable" },
  ],
  variants: [
    {
      id: "dominant",
      kind: "dominant",
      stagePath: ["initiate", "plan", "execute", "control", "close"],
      projectIds: ["p1", "p2", "p3"],
      projectCount: 3,
      sharePct: 60,
      averageCycleTimeMs: 86_400_000,
      reworkRate: 0.1,
      financialImpact: 10_000,
      activeRiskCount: 2,
    },
    {
      id: "critical",
      kind: "critical",
      stagePath: ["plan", "execute", "control", "execute", "control"],
      projectIds: ["p4"],
      projectCount: 1,
      sharePct: 20,
      averageCycleTimeMs: 172_800_000,
      reworkRate: 0.5,
      financialImpact: 40_000,
      activeRiskCount: 5,
    },
  ],
  bottlenecks: [
    {
      stage: "control",
      affectedProjectIds: ["p3", "p4"],
      affectedProjectCount: 2,
      averageWaitMs: 7_200_000,
      financialImpact: 40_000,
      score: 0.9,
      technicalActivities: ["TaskStatusChanged"],
    },
  ],
  reworkLoops: [
    {
      from: "control",
      to: "execute",
      frequency: 4,
      affectedProjectCount: 2,
      technicalTransitions: ["TaskStatusChanged:TaskStarted"],
    },
  ],
  projects: [],
  portfolioHealthScore: 72,
  generatedAt: "2026-07-23T00:00:00Z",
  dataQualityScore: 0.8,
  limitations: [],
};

function render(overlay: "process" | "finance" = "process") {
  return renderToStaticMarkup(
    <ExecutivePortfolioFlow
      model={model}
      locale="es"
      overlay={overlay}
      selectedStage={null}
      onSelectStage={() => {}}
      onShowProjects={() => {}}
    />,
  );
}

describe("ExecutivePortfolioFlow BPM canvas", () => {
  it("renders the BPM/Sankey canvas as the dominant visualization", () => {
    const html = render();
    expect(html).toContain('aria-label="Mapa BPM ejecutivo"');
    expect(html).toContain("<svg");
    expect(html).toContain("Ruta principal observada");
    expect(html).toContain("Grosor = frecuencia");
    expect(html).toContain("Variantes del proceso");
    expect(html).toContain('stroke-width="10.5"');
  });

  it("keeps technical event names and rework arcs hidden by default", () => {
    const html = render();
    expect(html).not.toContain("TaskStatusChanged");
    expect(html).not.toContain("TaskStarted");
    expect(html).not.toContain("↩ 4");
    expect(html).toContain("Mostrar loops");
  });

  it("uses the same map for the finance overlay", () => {
    const html = render("finance");
    expect(html).toContain("Capa: finance");
    expect(html).toContain("US$40K / US$110K");
    expect(html).toContain("Variación prevista");
    expect(html).toContain("<svg");
  });
});
