// ============================================================================
// CAP-045 extension — Canonical-event Relationship Projection (unit tests)
// ============================================================================
// PURE module tests: no DB, no I/O. Proves the 11 projection responsibilities
// and the no-inference-of-causality contract.
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  projectEventRelationships,
  type CanonicalEventLogRow,
  type CanonicalEventObjectRow,
} from "@/lib/graph/event-relationship-projection";

const ORG = "00000000-0000-0000-0000-000000000001";
const PROJECT = "00000000-0000-0000-0000-000000000010";
const OTHER_PROJECT = "00000000-0000-0000-0000-000000000099";

let seq = 0;
function logRow(over: Partial<CanonicalEventLogRow>): CanonicalEventLogRow {
  seq += 1;
  const event_id = over.event_id ?? `evt-${seq}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    event_id,
    organization_id: ORG,
    project_id: PROJECT,
    case_id: PROJECT,
    event_category: "risk",
    event_type: "risk_registered",
    event_schema_version: 1,
    event_importance: "MEDIUM",
    event_lifecycle_class: "BUSINESS_EVENT",
    subject_type: "risk",
    subject_id: "risk-1",
    actor_type: "human",
    actor_id: "user-1",
    occurred_at: `2026-01-0${(seq % 9) + 1}T10:00:00.000Z`,
    recorded_at: `2026-01-0${(seq % 9) + 1}T10:00:01.000Z`,
    sequence_number: over.sequence_number ?? seq,
    source_module: "test",
    source_entity_type: "risks",
    source_entity_id: "risk-1",
    from_state: null,
    to_state: null,
    caused_by: null,
    is_compensating_event: null,
    compensates_event_id: null,
    event_hash: `h${seq}`,
    previous_event_hash: seq === 1 ? null : `h${seq - 1}`,
    provenance: { capture_method: "direct" },
    confidence: null,
    payload: null,
    visibility: "members",
    ...over,
  };
}

function objRow(
  event_id: string,
  object_type: string,
  object_id: string,
  role: string,
): CanonicalEventObjectRow {
  return { event_id, object_type, object_id, role };
}

describe("CAP-045 event-relationship projection", () => {
  it("1. a 1→2→3 sequence produces exactly two project_sequence_next edges (order only)", () => {
    const rows = [
      logRow({ event_id: "e1", sequence_number: 1 }),
      logRow({ event_id: "e2", sequence_number: 2 }),
      logRow({ event_id: "e3", sequence_number: 3 }),
    ];
    const { canonicalEvents, eventRelationships } = projectEventRelationships(rows, [], PROJECT);
    expect(canonicalEvents).toHaveLength(3);
    const seqNext = eventRelationships.filter((r) => r.relationshipType === "project_sequence_next");
    expect(seqNext).toHaveLength(2);
    expect(seqNext.every((r) => r.relationshipClass === "temporal")).toBe(true);
    expect(seqNext.every((r) => r.evidence === "deterministic_projection")).toBe(true);
    // e1→e2, e2→e3
    expect(seqNext.map((r) => [r.sourceEventId, r.targetEventId]).sort()).toEqual(
      [["e1", "e2"], ["e2", "e3"]].sort(),
    );
    // NO causal edges were invented from adjacency.
    expect(eventRelationships.some((r) => r.relationshipClass === "causal")).toBe(false);
  });

  it("2. events sharing the SAME focal object produce object_sequence_next", () => {
    const rows = [
      logRow({ event_id: "e1", sequence_number: 1 }),
      logRow({ event_id: "e2", sequence_number: 2 }),
    ];
    const objs = [objRow("e1", "risk", "risk-1", "focal"), objRow("e2", "risk", "risk-1", "focal")];
    const { eventRelationships } = projectEventRelationships(rows, objs, PROJECT);
    const objSeq = eventRelationships.filter((r) => r.relationshipType === "object_sequence_next");
    expect(objSeq).toHaveLength(1);
    expect(objSeq[0].sourceEventId).toBe("e1");
    expect(objSeq[0].targetEventId).toBe("e2");
    expect(objSeq[0].relationshipClass).toBe("temporal");
    expect(objSeq[0].objectRole).toBe("focal");
  });

  it("3. events touching DIFFERENT objects are NOT connected by object_sequence_next", () => {
    const rows = [
      logRow({ event_id: "e1", sequence_number: 1, subject_id: "risk-A" }),
      logRow({ event_id: "e2", sequence_number: 2, subject_id: "risk-B" }),
    ];
    const objs = [objRow("e1", "risk", "risk-A", "focal"), objRow("e2", "risk", "risk-B", "focal")];
    const { eventRelationships } = projectEventRelationships(rows, objs, PROJECT);
    const objSeq = eventRelationships.filter((r) => r.relationshipType === "object_sequence_next");
    expect(objSeq).toHaveLength(0);
  });

  it("4. caused_by (recorded) creates a CAUSAL edge with evidence=explicit", () => {
    const rows = [
      logRow({ event_id: "e1", sequence_number: 1 }),
      logRow({ event_id: "e2", sequence_number: 2, caused_by: ["e1"] }),
    ];
    const { eventRelationships } = projectEventRelationships(rows, [], PROJECT);
    const causal = eventRelationships.filter((r) => r.relationshipType === "caused_by");
    expect(causal).toHaveLength(1);
    expect(causal[0].sourceEventId).toBe("e1");
    expect(causal[0].targetEventId).toBe("e2");
    expect(causal[0].relationshipClass).toBe("causal");
    expect(causal[0].evidence).toBe("explicit");
  });

  it("5. absence of caused_by creates NO causal edge (no inference from proximity)", () => {
    const rows = [
      logRow({ event_id: "e1", sequence_number: 1 }),
      logRow({ event_id: "e2", sequence_number: 2 }), // adjacent but NOT caused_by
    ];
    const { eventRelationships } = projectEventRelationships(rows, [], PROJECT);
    expect(eventRelationships.some((r) => r.relationshipClass === "causal")).toBe(false);
    // temporal adjacency is still present, but it is NOT causal.
    expect(eventRelationships.some((r) => r.relationshipType === "project_sequence_next")).toBe(true);
  });

  it("6. compensates_event_id creates a COMPENSATION edge with evidence=explicit", () => {
    const rows = [
      logRow({ event_id: "e1", sequence_number: 1 }),
      logRow({
        event_id: "e2",
        sequence_number: 2,
        is_compensating_event: true,
        compensates_event_id: "e1",
        event_type: "risk_voided",
      }),
    ];
    const { eventRelationships } = projectEventRelationships(rows, [], PROJECT);
    const comp = eventRelationships.filter((r) => r.relationshipType === "compensates");
    expect(comp).toHaveLength(1);
    expect(comp[0].sourceEventId).toBe("e2");
    expect(comp[0].targetEventId).toBe("e1");
    expect(comp[0].relationshipClass).toBe("compensation");
    expect(comp[0].evidence).toBe("explicit");
  });

  it("7. relates_to_object conserves object_type / object_id / role verbatim", () => {
    const rows = [logRow({ event_id: "e1", sequence_number: 1 })];
    const objs = [
      objRow("e1", "risk", "risk-1", "focal"),
      objRow("e1", "project_memory_item", "mem-9", "evidence"),
      objRow("e1", "project", "proj-1", "context"),
      objRow("e1", "milestone", "milestone-1", "phase"),
      objRow("e1", "user", "user-1", "responsibility"),
      objRow("e1", "task", "task-0", "predecessor"),
    ];
    const { eventRelationships } = projectEventRelationships(rows, objs, PROJECT);
    const refs = eventRelationships.filter((r) => r.relationshipType === "relates_to_object");
    expect(refs).toHaveLength(6);
    const byTriple = new Map(refs.map((r) => [`${r.objectType}:${r.objectId}:${r.objectRole}`, r]));
    expect(byTriple.get("risk:risk-1:focal")).toBeDefined();
    expect(byTriple.get("project_memory_item:mem-9:evidence")).toBeDefined();
    expect(byTriple.get("project:proj-1:context")).toBeDefined();
    expect(byTriple.get("milestone:milestone-1:phase")).toBeDefined();
    expect(byTriple.get("user:user-1:responsibility")).toBeDefined();
    expect(byTriple.get("task:task-0:predecessor")).toBeDefined();
  });

  it("8. cross-project rows are REJECTED (no links form across projects)", () => {
    const rows = [
      logRow({ event_id: "e1", sequence_number: 1, project_id: PROJECT }),
      logRow({ event_id: "e2", sequence_number: 2, project_id: OTHER_PROJECT }),
      // a caused_by pointing cross-project must NOT create an edge
      logRow({ event_id: "e3", sequence_number: 3, project_id: PROJECT, caused_by: ["e2"] }),
    ];
    const { canonicalEvents, eventRelationships } = projectEventRelationships(rows, [], PROJECT);
    // Only PROJECT events survive scoping.
    expect(canonicalEvents.every((e) => e.projectId === PROJECT)).toBe(true);
    expect(canonicalEvents.map((e) => e.eventId).sort()).toEqual(["e1", "e3"]);
    // e3→e2 causal must NOT form (e2 is another project).
    const causal = eventRelationships.filter((r) => r.relationshipType === "caused_by");
    expect(causal).toHaveLength(0);
    // project_sequence_next only among the scoped events (e1→e3 by sequence).
    const seqNext = eventRelationships.filter((r) => r.relationshipType === "project_sequence_next");
    expect(seqNext).toHaveLength(1);
    expect([seqNext[0].sourceEventId, seqNext[0].targetEventId]).toEqual(["e1", "e3"]);
  });

  it("9. relationship ids are DETERMINISTIC (same inputs ⇒ same ids)", () => {
    const rows = [
      logRow({ event_id: "e1", sequence_number: 1 }),
      logRow({ event_id: "e2", sequence_number: 2, caused_by: ["e1"] }),
    ];
    const objs = [objRow("e1", "risk", "risk-1", "focal")];
    const a = projectEventRelationships(rows, objs, PROJECT);
    const b = projectEventRelationships(rows, objs, PROJECT);
    expect(a.eventRelationships.map((r) => r.id)).toEqual(b.eventRelationships.map((r) => r.id));
    expect(a.canonicalEvents.map((e) => e.eventId)).toEqual(b.canonicalEvents.map((e) => e.eventId));
  });

  it("10. inputs are NOT mutated", () => {
    const rows = [
      logRow({ event_id: "e1", sequence_number: 1 }),
      logRow({ event_id: "e2", sequence_number: 2, caused_by: ["e1"] }),
    ];
    const objs = [objRow("e1", "risk", "risk-1", "focal")];
    const rowsSnapshot = JSON.parse(JSON.stringify(rows));
    const objsSnapshot = JSON.parse(JSON.stringify(objs));
    projectEventRelationships(rows, objs, PROJECT);
    expect(JSON.parse(JSON.stringify(rows))).toEqual(rowsSnapshot);
    expect(JSON.parse(JSON.stringify(objs))).toEqual(objsSnapshot);
  });

  it("11. retry / re-run produces the SAME result (idempotent projection)", () => {
    const rows = [
      logRow({ event_id: "e1", sequence_number: 1 }),
      logRow({ event_id: "e2", sequence_number: 2 }),
      logRow({ event_id: "e3", sequence_number: 3, caused_by: ["e1"], is_compensating_event: true, compensates_event_id: "e1" }),
    ];
    const objs = [objRow("e1", "risk", "r", "focal"), objRow("e2", "risk", "r", "focal")];
    const a = projectEventRelationships(rows, objs, PROJECT);
    const b = projectEventRelationships(rows, objs, PROJECT);
    expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(b)));
  });

  it("lateRecorded flag is derived from recorded values only (never recalculated/invented)", () => {
    const rows = [
      logRow({
        event_id: "e-late",
        sequence_number: 1,
        occurred_at: "2026-01-01T10:00:00.000Z",
        recorded_at: "2026-01-01T10:05:00.000Z", // 5 min later → late
      }),
      logRow({
        event_id: "e-ontime",
        sequence_number: 2,
        occurred_at: "2026-01-02T10:00:00.000Z",
        recorded_at: "2026-01-02T10:00:02.000Z", // 2 s later → not late
      }),
    ];
    const { canonicalEvents } = projectEventRelationships(rows, [], PROJECT);
    const late = canonicalEvents.find((e) => e.eventId === "e-late");
    const ontime = canonicalEvents.find((e) => e.eventId === "e-ontime");
    expect(late?.lateRecorded).toBe(true);
    expect(ontime?.lateRecorded).toBe(false);
  });

  it("a cause pointing outside the recovered set creates NO causal edge (no invention)", () => {
    const rows = [logRow({ event_id: "e2", sequence_number: 2, caused_by: ["e-missing"] })];
    const { eventRelationships } = projectEventRelationships(rows, [], PROJECT);
    expect(eventRelationships.some((r) => r.relationshipType === "caused_by")).toBe(false);
  });
});
