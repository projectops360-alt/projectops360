// ============================================================================
// Hover card guard (guard: PROCESS-GRAPH-HOVER-CARD)
// ============================================================================
// The hover card used to open the instant the pointer touched a node, with the
// full metric table. Merely crossing the canvas popped a 320px panel over
// everything, and it was awkward to get rid of. It must now stay closed until
// the pointer has actually rested on the node, and it must stay a summary —
// the exhaustive table belongs to the click-opened detail drawer.
// ============================================================================

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HOVER_OPEN_DELAY_MS,
  ProcessNodeTooltip,
} from "../graph/process-node-tooltip";
import type { ProcessGraphEntity } from "@/lib/pmo-process-intelligence/process-graph.types";

const ENTITY = {
  id: "project:p1",
  kind: "project",
  label: "Terminal Expansion",
  definition: "Authorized project inside this projection.",
  status: "in_progress",
  includedEntityIds: [],
  evidence: [],
  metrics: {
    healthScore: 72,
    progressPercent: 41,
    eac: 1_400_000,
    criticalRisks: 3,
    approvedBudget: 1_200_000,
    actualCost: 800_000,
    cpi: 0.92,
    spi: 0.88,
    overallocatedResources: 2,
    projectManager: "A. Rivera",
    delayProbabilityPct: 35,
    forecastFinish: "2026-11-02",
  },
} as unknown as ProcessGraphEntity;

describe("ProcessNodeTooltip", () => {
  it("renders nothing on the first paint of a hover", () => {
    const markup = renderToStaticMarkup(
      <ProcessNodeTooltip entity={ENTITY} locale="en" active />,
    );

    expect(markup).toBe("");
  });

  it("renders nothing when the node is not hovered", () => {
    const markup = renderToStaticMarkup(
      <ProcessNodeTooltip entity={ENTITY} locale="en" active={false} />,
    );

    expect(markup).toBe("");
  });

  it("waits long enough that crossing the canvas does not open cards", () => {
    expect(HOVER_OPEN_DELAY_MS).toBeGreaterThanOrEqual(300);
  });
});
