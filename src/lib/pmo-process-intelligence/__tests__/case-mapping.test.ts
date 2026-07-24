// ============================================================================
// CAP-047 M4 — case mapping (guard: PMO-PI-CASE-MAPPING)
// ============================================================================
// Fails if cases stop being real domain objects (project journeys at org
// level, business-object journeys at project level), if outcomes get
// invented, or if rows leak across projects during drill-down.
// ============================================================================

import { describe, it, expect } from "vitest";
import { casesByProject, casesBySubject, type PmoPiEventRow } from "../case-mapping";

function row(projectId: string, eventType: string, occurredAt: string, subjectId: string): PmoPiEventRow {
  return {
    event_id: `${projectId}-${subjectId}-${occurredAt}`,
    organization_id: "org-1",
    project_id: projectId,
    event_type: eventType,
    event_category: "task",
    occurred_at: occurredAt,
    recorded_at: occurredAt,
    event_lifecycle_class: "BUSINESS_EVENT",
    is_compensating_event: false,
    subject_type: "task",
    subject_id: subjectId,
    actor_type: "human",
    source_module: "roadmap",
  };
}

const rows: PmoPiEventRow[] = [
  row("p1", "TaskStarted", "2026-07-01T00:00:00Z", "t1"),
  row("p1", "TaskCompleted", "2026-07-01T01:00:00Z", "t1"),
  row("p1", "TaskStarted", "2026-07-02T00:00:00Z", "t2"),
  row("p2", "TaskStarted", "2026-07-03T00:00:00Z", "t9"),
];

describe("casesByProject (organization level)", () => {
  it("creates one case per project with its own events and canonical outcome", () => {
    const cases = casesByProject(rows, [
      { id: "p1", label: "Alpha", outcome: "open" },
      { id: "p2", label: "Beta", outcome: "success" },
      { id: "p3", label: "Empty", outcome: "open" },
    ]);
    expect(cases.map((c) => c.caseId)).toEqual(["p1", "p2", "p3"]);
    expect(cases[0].events).toHaveLength(3);
    expect(cases[1].events).toHaveLength(1);
    expect(cases[2].events).toHaveLength(0); // projects without events stay honest
    expect(cases[1].outcome).toBe("success");
    expect(cases[0].events.every((e) => e.caseId === "p1")).toBe(true);
  });
});

describe("casesBySubject (project drill-down)", () => {
  it("creates one case per business-object journey inside the project only", () => {
    const cases = casesBySubject(rows, "p1");
    expect(cases.map((c) => c.caseId)).toEqual(["task:t1", "task:t2"]);
    expect(cases[0].events).toHaveLength(2);
    // Rows from other projects never leak into the drill-down.
    expect(cases.some((c) => c.events.some((e) => e.projectId !== "p1"))).toBe(false);
  });

  it("never invents object-level outcomes", () => {
    for (const c of casesBySubject(rows, "p1")) expect(c.outcome).toBe("open");
  });
});
