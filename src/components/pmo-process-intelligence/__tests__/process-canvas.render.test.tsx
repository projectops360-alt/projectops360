// ============================================================================
// CAP-047 M4 — Process Canvas render guards (guard: PMO-PI-CANVAS)
// ============================================================================
// Pins the analytical-map contract: rework is marked with TEXT (never color
// alone), bottleneck badges are calculated from the model, dominant path is
// distinguished, the empty state is honest, zoom controls exist, and the
// whole canvas renders from the PmoPiFlowModel contract only.
// ============================================================================

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProcessCanvas, activityLabel, filterModelForDisplay } from "../process-canvas";
import { deriveKpis } from "../command-center-shell";
import { buildFlowModel } from "@/lib/pmo-process-intelligence/flow-projection";
import type { PmoPiCase, PmoPiEventRecord, PmoPiScope } from "@/lib/pmo-process-intelligence/contracts";

const SCOPE: PmoPiScope = { organizationId: "org-1", projectIds: [], level: "organization" };

let n = 0;
function ev(caseId: string, eventType: string, occurredAt: string): PmoPiEventRecord {
  n++;
  return {
    eventId: `e${n}`, eventType, eventCategory: "task", occurredAt,
    lifecycleClass: "BUSINESS_EVENT", isCompensatingEvent: false,
    organizationId: "org-1", projectId: "p1", caseId, subjectType: "task",
    subjectId: `t${n}`, actorType: "human", recordedAt: occurredAt, sourceModule: "roadmap",
  };
}
const mkCase = (id: string, events: PmoPiEventRecord[]): PmoPiCase => ({
  caseId: id, caseLabel: id, organizationId: "org-1", projectId: "p1", events, outcome: "open",
});

const model = buildFlowModel(SCOPE, [
  mkCase("c1", [ev("c1", "TaskStarted", "2026-07-01T00:00:00Z"), ev("c1", "TaskCompleted", "2026-07-01T01:00:00Z"), ev("c1", "MilestoneAchieved", "2026-07-03T00:00:00Z")]),
  mkCase("c2", [ev("c2", "TaskStarted", "2026-07-02T00:00:00Z"), ev("c2", "TaskCompleted", "2026-07-02T01:00:00Z"), ev("c2", "TaskStarted", "2026-07-02T02:00:00Z"), ev("c2", "MilestoneAchieved", "2026-07-06T00:00:00Z")]),
], "2026-07-23T00:00:00Z");

describe("ProcessCanvas (CAP-047 M4)", () => {
  const html = renderToStaticMarkup(<ProcessCanvas model={model} locale="en" />);

  it("renders every activity node with frequency and case counts", () => {
    expect(html).toContain("Task Started");
    expect(html).toContain("Task Completed");
    expect(html).toContain("Milestone Achieved");
    expect(html).toContain("cases");
  });

  it("marks rework with a text marker, never color alone", () => {
    expect(html).toContain("rework");
    expect(html).toContain("↩");
  });

  it("shows a calculated bottleneck badge from the model", () => {
    expect(html).toContain("Bottleneck");
    expect(model.nodes.some((node) => node.bottleneckScore >= 0.7)).toBe(true);
  });

  it("offers zoom controls and a variant isolation filter", () => {
    expect(html).toContain("Zoom in");
    expect(html).toContain("Zoom out");
    expect(html).toContain("Variant");
    expect(html).toContain("Min frequency");
  });

  it("renders the honest empty state when no events are in scope", () => {
    const empty = buildFlowModel(SCOPE, [], "2026-07-23T00:00:00Z");
    const emptyHtml = renderToStaticMarkup(<ProcessCanvas model={empty} locale="es" />);
    expect(emptyHtml).toContain("Aún no hay eventos de proceso en alcance");
    expect(emptyHtml).not.toContain("<rect");
  });

  it("renders in Spanish (UX-012)", () => {
    const es = renderToStaticMarkup(<ProcessCanvas model={model} locale="es" />);
    expect(es).toContain("Frecuencia mínima");
    expect(es).toContain("retrabajo");
    expect(es).toContain("Cuello de botella");
  });
});

describe("filterModelForDisplay (LOD)", () => {
  it("drops nodes below the frequency floor and orphan edges with them", () => {
    const filtered = filterModelForDisplay(model, 3, false);
    for (const node of filtered.nodes) expect(node.frequency).toBeGreaterThanOrEqual(3);
    const kept = new Set(filtered.nodes.map((x) => x.id));
    for (const e of filtered.edges) {
      expect(kept.has(e.from)).toBe(true);
      expect(kept.has(e.to)).toBe(true);
    }
  });
});

describe("deriveKpis (presentation-only)", () => {
  it("derives dominant share, rework % and bottleneck count from the model", () => {
    const k = deriveKpis(model);
    expect(k.dominantSharePct).toBe(50); // c1's path — 1 of 2 cases
    expect(k.reworkPct).toBeGreaterThan(0);
    expect(k.bottleneckCount).toBeGreaterThanOrEqual(1);
  });

  it("returns honest nulls without a model", () => {
    expect(deriveKpis(null)).toEqual({ dominantSharePct: null, reworkPct: null, bottleneckCount: null });
  });
});

describe("activityLabel", () => {
  it("prettifies registry event types", () => {
    expect(activityLabel("TaskStatusChanged")).toBe("Task Status Changed");
    expect(activityLabel("risk_registered")).toBe("risk registered");
  });
});
