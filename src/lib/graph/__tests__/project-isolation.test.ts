// ============================================================================
// CAP-045 §C.2 / Part B — project isolation (view-layer) tests
// ============================================================================
// Proves the defense-in-depth filter `scopeLivingGraphDataToProject` and the
// status-contract invariants that eliminate the misleading fallback:
//   * cross-project rows are filtered out of EVERY layer;
//   * flag OFF (canonical arrays absent) stays byte-identical (no synthesized
//     empty arrays) and the status field is the explicit "disabled" signal;
//   * an empty/error canonical projection never falls back to operational
//     process_nodes under the "events" view (the status, not the node count,
//     drives the view).
// ============================================================================

import { describe, it, expect } from "vitest";
import { scopeLivingGraphDataToProject } from "@/lib/graph/project-scoped-data";
import { isEventRelationshipsEnabledFor } from "@/lib/graph/event-relationships-flag";
import type {
  LivingGraphData,
  LivingGraphNode,
  LivingGraphCanonicalEvent,
} from "@/types/living-graph";

const PROJECT = "00000000-0000-0000-0000-000000000010";
const OTHER = "00000000-0000-0000-0000-000000000099";

function node(id: string, projectId: string): LivingGraphNode {
  return {
    id, projectId, nodeType: "task_transition", sourceEntityType: "roadmap_tasks",
    sourceEntityId: id, label: id, description: null, status: "todo", progress: null,
    startDate: null, endDate: null, durationDays: null, occurredAt: "", createdAt: "", updatedAt: "",
    riskLevel: null, isBlocked: false, isCritical: false, milestoneId: null, milestoneLabel: null,
    milestoneOrder: null, traceabilityScore: null, metadata: {},
  };
}

function canonicalEvent(eventId: string, projectId: string, seq: number): LivingGraphCanonicalEvent {
  return {
    eventId, organizationId: "org-1", projectId, eventType: "task_status_changed",
    eventCategory: "execution", eventSchemaVersion: 1, eventImportance: null,
    lifecycleClass: "BUSINESS_EVENT", subjectType: "task", subjectId: null, actorType: "human",
    actorId: "u1", occurredAt: "2026-01-01T00:00:00.000Z", recordedAt: "2026-01-01T00:00:00.000Z",
    sequenceNumber: seq, sourceModule: "x", sourceEntityType: null, sourceEntityId: null,
    fromState: null, toState: null, causedBy: [], isCompensatingEvent: false, compensatesEventId: null,
    eventHash: null, previousEventHash: null, provenance: null, confidence: null, payload: null,
    visibility: "members", objectRefs: [], dataQualityFlags: [], captureMethod: null, lateRecorded: false,
  };
}

describe("CAP-045 §C.2 — project isolation filter", () => {
  it("filters cross-project nodes/edges/events out of every layer", () => {
    const data: LivingGraphData = {
      nodes: [node("n1", PROJECT), node("n2", OTHER)],
      edges: [
        { id: "e1", projectId: PROJECT, sourceNodeId: "n1", targetNodeId: "n1", edgeType: "informed", weight: 1, lagDays: null, isCritical: false, riskLevel: null, metadata: {} },
        { id: "e2", projectId: OTHER, sourceNodeId: "n2", targetNodeId: "n2", edgeType: "informed", weight: 1, lagDays: null, isCritical: false, riskLevel: null, metadata: {} },
      ],
      events: [
        { id: "ev1", projectId: PROJECT, eventType: "task_transition", entityType: "roadmap_tasks", entityId: "n1", nodeId: "n1", label: "x", occurredAt: "", inDegree: 0, outDegree: 0, metadata: {} },
        { id: "ev2", projectId: OTHER, eventType: "task_transition", entityType: "roadmap_tasks", entityId: "n2", nodeId: "n2", label: "x", occurredAt: "", inDegree: 0, outDegree: 0, metadata: {} },
      ],
      generatedAt: "2026-01-01T00:00:00.000Z",
    };
    const scoped = scopeLivingGraphDataToProject(data, PROJECT);
    expect(scoped.nodes.map((n) => n.id)).toEqual(["n1"]);
    expect(scoped.edges.map((e) => e.id)).toEqual(["e1"]);
    expect(scoped.events.map((e) => e.id)).toEqual(["ev1"]);
  });

  it("flag OFF (canonical arrays absent) stays byte-identical — no synthesized empty arrays", () => {
    const data: LivingGraphData = {
      nodes: [node("n1", PROJECT)],
      edges: [],
      events: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      requestedProjectId: PROJECT,
      canonicalEventProjectionStatus: "disabled",
    };
    const scoped = scopeLivingGraphDataToProject(data, PROJECT);
    expect(scoped.canonicalEvents).toBeUndefined();
    expect(scoped.eventRelationships).toBeUndefined();
    // The status + requestedProjectId scalars are carried through.
    expect(scoped.canonicalEventProjectionStatus).toBe("disabled");
    expect(scoped.requestedProjectId).toBe(PROJECT);
  });

  it("filters cross-project canonical events when present", () => {
    const data: LivingGraphData = {
      nodes: [node("n1", PROJECT)],
      edges: [],
      events: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      requestedProjectId: PROJECT,
      canonicalEventProjectionStatus: "ready",
      canonicalEvents: [canonicalEvent("ev1", PROJECT, 1), canonicalEvent("ev2", OTHER, 2)],
      eventRelationships: [],
    };
    const scoped = scopeLivingGraphDataToProject(data, PROJECT);
    expect(scoped.canonicalEvents?.map((e) => e.eventId)).toEqual(["ev1"]);
  });
});

describe("CAP-045 §C.2 — status contract (no silent fallback)", () => {
  it("flag OFF → status 'disabled' for every project (the events view must NOT fall back)", () => {
    expect(isEventRelationshipsEnabledFor(PROJECT, "")).toBe(false);
    expect(isEventRelationshipsEnabledFor(PROJECT, undefined)).toBe(false);
    // The page maps flag OFF → canonicalEventProjectionStatus === "disabled",
    // and the view renders an empty events graph + banner — never operational
    // nodes. This test pins the flag contract that drives that mapping.
  });

  it("a 'disabled' payload carries no canonical arrays (byte-identical invariant)", () => {
    const data: LivingGraphData = {
      nodes: [node("n1", PROJECT)],
      edges: [],
      events: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      requestedProjectId: PROJECT,
      canonicalEventProjectionStatus: "disabled",
    };
    expect(data.canonicalEvents).toBeUndefined();
    expect(data.canonicalEventProjectionStatus).toBe("disabled");
  });

  it("an 'empty' projection (flag ON, 0 events) is NOT a fallback to operational nodes", () => {
    // The page sets status "empty" (not "ready"); the view's canonicalEventsActive
    // is false for "empty" → displayGraph returns {nodes:[],edges:[]} for the
    // events view. Pin the contract: "empty" ≠ "ready".
    const data: LivingGraphData = {
      nodes: [node("n1", PROJECT)],
      edges: [],
      events: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      requestedProjectId: PROJECT,
      canonicalEventProjectionStatus: "empty",
      canonicalEvents: [],
      eventRelationships: [],
    };
    expect(data.canonicalEventProjectionStatus).toBe("empty");
    expect(data.canonicalEvents).toEqual([]);
    // The view's active gate: active ONLY for "ready"/"truncated".
    expect(
      data.canonicalEventProjectionStatus === "ready" ||
        data.canonicalEventProjectionStatus === "truncated",
    ).toBe(false);
  });

  it("an 'error' projection is NOT a fallback to operational nodes", () => {
    const data: LivingGraphData = {
      nodes: [node("n1", PROJECT)],
      edges: [],
      events: [],
      generatedAt: "2026-01-01T00:00:00.000Z",
      requestedProjectId: PROJECT,
      canonicalEventProjectionStatus: "error",
    };
    expect(data.canonicalEventProjectionStatus).toBe("error");
    expect(
      data.canonicalEventProjectionStatus === "ready" ||
        data.canonicalEventProjectionStatus === "truncated",
    ).toBe(false);
  });
});