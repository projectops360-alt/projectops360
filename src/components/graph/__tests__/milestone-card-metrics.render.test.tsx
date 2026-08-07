// ============================================================================
// MILESTONE-CARD-METRICS — the card renders the user's choice, and only that
// ============================================================================
// Two guards the pure catalogue test cannot give:
//
//   1. A card with nothing pinned is the card that existed before this feature.
//      Adding KPIs to the Living Graph must not change what every other user
//      already sees — the failure this repo keeps writing rules against.
//   2. A metric with no data renders a visible "—". Not a hidden chip (which
//      reads as a broken picker) and never a "$0" (which reads as "free").
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import type { LivingGraphNode as GNode } from "@/types/living-graph";
import { resolveMilestoneCardMetrics } from "@/lib/graph/milestone-card-metrics";
import type { MilestoneCostRollup } from "@/lib/roadmap/milestone-cost-rollup";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import { LivingGraphMilestoneNode } from "../living-graph-milestone-node";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

function milestoneNode(): GNode {
  return {
    id: "milestone:m1",
    projectId: "p1",
    nodeType: "milestone_gate",
    sourceEntityType: "milestones",
    sourceEntityId: "m1",
    label: "Preparación",
    description: null,
    status: "in_progress",
    progress: 40,
    startDate: "2026-01-12",
    endDate: "2026-03-06",
    durationDays: null,
    occurredAt: "2026-01-12T00:00:00.000Z",
    createdAt: "2026-01-12T00:00:00.000Z",
    updatedAt: "2026-01-12T00:00:00.000Z",
    riskLevel: "low",
    isBlocked: false,
    isCritical: false,
    milestoneId: "m1",
    milestoneLabel: "Preparación",
    milestoneOrder: 0,
    traceabilityScore: null,
    metadata: { tasksTotal: 53, tasksDone: 21 },
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function props(extra: Record<string, unknown> = {}): any {
  return {
    data: {
      node: milestoneNode(),
      metrics: null,
      emphasis: "normal",
      playback: "none",
      isSearchHit: false,
      isSimulationImpact: false,
      isSimulationOrigin: false,
      isDownstreamHighlight: false,
      isPathMember: false,
      isFocusNode: false,
      isDropTarget: false,
      clusterSize: 1,
      ...extra,
    },
    selected: false,
    sourcePosition: "right",
    targetPosition: "left",
  };
}

/** Preparación as it really is in production: budgeted, worked, no rates. */
const PREPARACION: MilestoneCostRollup = {
  milestoneId: "m1",
  taskCount: 53,
  tasksDone: 21,
  estimatedHours: 1296,
  actualHours: 332,
  varianceHours: -964,
  plannedDurationDays: 54,
  budget: 210300,
  materialCost: null,
  labourCost: null,
  tasksWithoutRate: 53,
  totalCost: 210300,
};

const EN = { locale: "en", currency: "USD", isEs: false };

describe("nothing pinned", () => {
  it("renders the card exactly as it did before KPIs existed", () => {
    const before = render(<LivingGraphMilestoneNode {...props()} />);
    const withEmpty = render(<LivingGraphMilestoneNode {...props({ cardMetrics: [] })} />);
    expect(withEmpty).toBe(before);
  });

  it("still shows the title, dates and task counter", () => {
    const html = render(<LivingGraphMilestoneNode {...props()} />);
    expect(html).toContain("Preparación");
    expect(html).toContain("21/53");
  });
});

describe("pinned KPIs", () => {
  it("shows the value and its short label", () => {
    const cardMetrics = resolveMilestoneCardMetrics(["actualHours"], PREPARACION, EN);
    const html = render(<LivingGraphMilestoneNode {...props({ cardMetrics })} />);
    expect(html).toContain("332 h");
    expect(html).toContain("actual");
  });

  it("keeps the task counter — a KPI adds, it never replaces", () => {
    const cardMetrics = resolveMilestoneCardMetrics(["budget"], PREPARACION, EN);
    expect(render(<LivingGraphMilestoneNode {...props({ cardMetrics })} />)).toContain("21/53");
  });

  it("shows a dash, not a zero, for a figure the data cannot support", () => {
    // No resource in this project has a rate, so labour cost is unknowable.
    const cardMetrics = resolveMilestoneCardMetrics(["labourCost"], PREPARACION, EN);
    const html = render(<LivingGraphMilestoneNode {...props({ cardMetrics })} />);
    expect(html).toContain("—");
    expect(html).not.toContain("$0");
  });

  it("renders every pinned metric, present or missing", () => {
    const cardMetrics = resolveMilestoneCardMetrics(
      ["budget", "labourCost", "actualHours", "plannedDurationDays"],
      PREPARACION,
      EN,
    );
    const html = render(<LivingGraphMilestoneNode {...props({ cardMetrics })} />);
    expect(html).toContain("332 h");
    expect(html).toContain("54 d");
    expect(html).toContain("—"); // labour, which has no rate
    expect(html).toMatch(/210/); // budget, compacted
  });

  it("colours an overrun differently from an underrun", () => {
    const over: MilestoneCostRollup = {
      ...PREPARACION,
      estimatedHours: 100,
      actualHours: 150,
      varianceHours: 50,
    };
    const overHtml = render(
      <LivingGraphMilestoneNode
        {...props({ cardMetrics: resolveMilestoneCardMetrics(["varianceHours"], over, EN) })}
      />,
    );
    const underHtml = render(
      <LivingGraphMilestoneNode
        {...props({
          cardMetrics: resolveMilestoneCardMetrics(
            ["varianceHours"],
            { ...PREPARACION, estimatedHours: 100, actualHours: 60, varianceHours: -40 },
            EN,
          ),
        })}
      />,
    );
    expect(overHtml).toContain("rose"); // danger
    expect(overHtml).toContain("+50 h");
    expect(underHtml).toContain("emerald"); // good
  });
});
