// ============================================================================
// LIVING-GRAPH-SUBTASK-VISIBILITY-NOTEBOOKLM-MODE — node render guards
// ============================================================================
// Protects the Project Execution Map node renderer: a task node with subtasks
// shows a visible subtask indicator (count + expand/collapse chevron) that is
// a real affordance (button, aria-expanded); a task WITHOUT subtasks shows no
// indicator. Rendered with react-dom/server (React Flow handles mocked).
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import type { LivingFlowNode } from "../living-graph-flow-types";
import type { LivingGraphNode as GNode } from "@/types/living-graph";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import { LivingGraphNode } from "../living-graph-node";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

function gnode(overrides: Partial<GNode> = {}): GNode {
  return {
    id: "n1",
    projectId: "p1",
    nodeType: "task_transition",
    sourceEntityType: "roadmap_tasks",
    sourceEntityId: "t1",
    label: "Build QA pipeline",
    description: null,
    status: "in_progress",
    progress: 40,
    startDate: null,
    endDate: null,
    durationDays: null,
    occurredAt: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    riskLevel: "low",
    isBlocked: false,
    isCritical: false,
    milestoneId: "m1",
    milestoneLabel: "Phase 1",
    milestoneOrder: 0,
    traceabilityScore: null,
    metadata: {},
    ...overrides,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function props(node: GNode, extra: Partial<LivingFlowNode["data"]> = {}): any {
  return {
    data: {
      node,
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

describe("Living Graph node — subtask indicator", () => {
  it("shows a clickable subtask indicator (count + expand affordance) when the task has subtasks", () => {
    const node = gnode({
      metadata: { subtask_total: 5, subtask_completed: 2, subtask_blocked: 1, subtask_expanded: false },
    });
    const html = render(<LivingGraphNode {...props(node, { onToggleSubtasks: () => {} })} />);
    expect(html).toContain('data-testid="graph-subtask-indicator"');
    expect(html).toContain("2/5"); // completed/total
    expect(html).toContain('aria-expanded="false"'); // collapsed affordance
    expect(html).toContain("⛔ 1"); // blocked count
  });

  it("reflects the expanded state (aria-expanded=true)", () => {
    const node = gnode({
      metadata: { subtask_total: 3, subtask_completed: 3, subtask_blocked: 0, subtask_expanded: true },
    });
    const html = render(<LivingGraphNode {...props(node, { onToggleSubtasks: () => {} })} />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("3/3");
  });

  it("shows NO indicator for a task without subtasks (nothing dumped, no clutter)", () => {
    const html = render(<LivingGraphNode {...props(gnode())} />);
    expect(html).not.toContain('data-testid="graph-subtask-indicator"');
  });

  it("shows NO indicator when the toggle handler is absent (e.g. milestone level)", () => {
    const node = gnode({ metadata: { subtask_total: 4 } });
    const html = render(<LivingGraphNode {...props(node)} />); // no onToggleSubtasks
    expect(html).not.toContain('data-testid="graph-subtask-indicator"');
  });
});
