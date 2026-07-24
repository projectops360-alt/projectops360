// ============================================================================
// CAP-047 M6 — risk/dependency overlays (guard: PMO-PI-OVERLAYS)
// ============================================================================
// Fails if: risk propagation stops following EXPLICIT dependencies only,
// closed risks leak into exposure, systemic risks appear without a linked
// task, dependency hubs stop being calculated from out-degree, or the
// intra-project limitation stops being declared.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  buildRiskOverlay,
  buildDependencyOverlay,
  downstreamReach,
  type PmoPiDependencyInput,
  type PmoPiRiskInput,
} from "../overlays";

const deps: PmoPiDependencyInput[] = [
  { projectId: "p1", predecessorId: "t1", successorId: "t2" },
  { projectId: "p1", predecessorId: "t2", successorId: "t3" },
  { projectId: "p1", predecessorId: "t2", successorId: "t4" },
  { projectId: "p2", predecessorId: "x1", successorId: "x2" },
];

function risk(overrides: Partial<PmoPiRiskInput>): PmoPiRiskInput {
  return {
    id: "r1", projectId: "p1", title: "Risk", category: "schedule",
    probability: "high", impact: "high", severity: "high", status: "open",
    linkedTaskId: null, ...overrides,
  };
}

describe("downstreamReach", () => {
  it("counts only tasks reachable via recorded dependencies", () => {
    expect(downstreamReach("t1", deps)).toBe(3); // t2, t3, t4
    expect(downstreamReach("t3", deps)).toBe(0);
    expect(downstreamReach("unknown", deps)).toBe(0);
  });

  it("survives dependency cycles without infinite loops", () => {
    const cyclic = [...deps, { projectId: "p1", predecessorId: "t3", successorId: "t1" }];
    expect(downstreamReach("t1", cyclic)).toBeGreaterThan(0);
  });
});

describe("buildRiskOverlay (CAP-047 M6)", () => {
  it("aggregates OPEN risks by project and severity; closed ones never count", () => {
    const o = buildRiskOverlay(
      [
        risk({ id: "r1", severity: "critical" }),
        risk({ id: "r2", severity: "high" }),
        risk({ id: "r3", severity: "low", status: "resolved" }),
        risk({ id: "r4", projectId: "p2", severity: "medium", status: "mitigating" }),
      ],
      deps,
    );
    expect(o.totalOpenCount).toBe(3);
    expect(o.criticalOpenCount).toBe(1);
    const p1 = o.rows.find((r) => r.projectId === "p1")!;
    expect(p1.openCount).toBe(2);
    expect(p1.criticalCount).toBe(1);
    expect(p1.highCount).toBe(1);
  });

  it("marks systemic risks ONLY when linked to a task with recorded downstream reach", () => {
    const o = buildRiskOverlay(
      [
        risk({ id: "r1", severity: "critical", linkedTaskId: "t1" }), // reaches 3
        risk({ id: "r2", severity: "critical", linkedTaskId: null }), // no link → never systemic
        risk({ id: "r3", severity: "critical", linkedTaskId: "t3" }), // reach 0 → not systemic
      ],
      deps,
    );
    expect(o.systemic).toHaveLength(1);
    expect(o.systemic[0]).toMatchObject({ riskId: "r1", downstreamTaskCount: 3 });
    expect(o.source).toBe("risks + task_dependencies");
  });
});

describe("buildDependencyOverlay (CAP-047 M6)", () => {
  const o = buildDependencyOverlay(deps);

  it("counts dependencies per project and finds unblock hubs by out-degree", () => {
    expect(o.totalDependencies).toBe(4);
    expect(o.perProject.find((p) => p.projectId === "p1")?.dependencyCount).toBe(3);
    expect(o.hubs[0]).toMatchObject({ taskId: "t2", outDegree: 2 });
  });

  it("declares the intra-project limitation honestly", () => {
    expect(o.limitations).toContain("only_intra_project_dependencies_are_recorded");
    expect(o.source).toBe("task_dependencies");
  });
});
