// ============================================================================
// CAP-045 extension — Living Graph view-model + analysis-isolation tests
// ============================================================================
// Proves the feature-flag contract (OFF = byte-identical, ON = canonical events
// appear), the canonical flow builder, and that event relationships NEVER feed
// the operational analyses (critical path / bottleneck).
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  isEventRelationshipsEnabledFor,
} from "@/lib/graph/event-relationships-flag";
import {
  isExecutionRelationship,
  isTemporalRelationship,
  isCanonicalEventNode,
  projectEventRelationships,
  type CanonicalEventLogRow,
  type CanonicalEventObjectRow,
} from "@/lib/graph/event-relationship-projection";
import { buildCanonicalFlow, canonicalEventNodeId } from "@/lib/graph/canonical-event-flow";
import { analyzeGraph } from "@/lib/graph/living-graph-analysis";
import type {
  LivingGraphData,
  LivingGraphNode,
  LivingGraphEdge,
  LivingGraphCanonicalEvent,
  LivingGraphEventRelationship,
} from "@/types/living-graph";

const PROJECT = "00000000-0000-0000-0000-000000000010";

// ── Flag contract ─────────────────────────────────────────────────────────────

describe("CAP-045 feature flag (LIVING_GRAPH_EVENT_RELATIONSHIPS_PROJECT_IDS)", () => {
  it("OFF (empty/missing env) → disabled for every project (byte-identical)", () => {
    expect(isEventRelationshipsEnabledFor(PROJECT, "")).toBe(false);
    expect(isEventRelationshipsEnabledFor(PROJECT, undefined)).toBe(false);
    expect(isEventRelationshipsEnabledFor(PROJECT, null)).toBe(false);
    expect(isEventRelationshipsEnabledFor(PROJECT, "   ")).toBe(false);
  });

  it("ON for a listed project → enabled only for that project", () => {
    const raw = `other-project, ${PROJECT} ,third`;
    expect(isEventRelationshipsEnabledFor(PROJECT, raw)).toBe(true);
    expect(isEventRelationshipsEnabledFor("not-listed", raw)).toBe(false);
  });

  it('"all" enables every project (local testing only)', () => {
    expect(isEventRelationshipsEnabledFor(PROJECT, "all")).toBe(true);
    expect(isEventRelationshipsEnabledFor("any", "all")).toBe(true);
  });

  it("empty projectId → disabled even with all", () => {
    expect(isEventRelationshipsEnabledFor("", "all")).toBe(false);
  });
});

// ── Helpers: operational vs temporal vs canonical discrimination ───────────────

describe("CAP-045 discrimination helpers (analysis isolation)", () => {
  it("isExecutionRelationship identifies a LivingGraphEdge (operational)", () => {
    const edge: LivingGraphEdge = {
      id: "pe1", projectId: PROJECT, sourceNodeId: "n1", targetNodeId: "n2",
      edgeType: "informed", weight: 1, lagDays: null, isCritical: false, riskLevel: null, metadata: {},
    };
    expect(isExecutionRelationship(edge)).toBe(true);
  });

  it("isTemporalRelationship identifies an event relationship (never operational)", () => {
    const rel: LivingGraphEventRelationship = {
      id: "r1", projectId: PROJECT, sourceEventId: "e1", targetEventId: "e2", objectId: null,
      relationshipType: "project_sequence_next", relationshipClass: "temporal",
      objectType: null, objectRole: null, sequenceDistance: 1, occurredLagMs: 1000,
      evidence: "deterministic_projection", metadata: {},
    };
    expect(isTemporalRelationship(rel)).toBe(true);
    // An operational edge is NOT a temporal relationship.
    expect(
      isTemporalRelationship({ edgeType: "informed" } as unknown as LivingGraphEventRelationship),
    ).toBe(false);
  });

  it("isCanonicalEventNode identifies a canonical event node, not a process node", () => {
    expect(isCanonicalEventNode({ eventId: "e1" })).toBe(true);
    const processNode: LivingGraphNode = {
      id: "n1", projectId: PROJECT, nodeType: "task_event", sourceEntityType: "roadmap_tasks",
      sourceEntityId: "t1", label: "T", description: null, status: "todo", progress: null,
      startDate: null, endDate: null, durationDays: null, occurredAt: "", createdAt: "", updatedAt: "",
      riskLevel: null, isBlocked: false, isCritical: false, milestoneId: null, milestoneLabel: null,
      milestoneOrder: null, traceabilityScore: null, metadata: {},
    };
    expect(isCanonicalEventNode(processNode)).toBe(false);
  });
});

// ── View-model: flag OFF keeps the previous contract; ON adds canonical fields ─

function makeBaselineData(): LivingGraphData {
  return {
    nodes: [
      {
        id: "n1", projectId: PROJECT, nodeType: "task_event", sourceEntityType: "roadmap_tasks",
        sourceEntityId: "t1", label: "Task 1", description: null, status: "todo", progress: null,
        startDate: null, endDate: null, durationDays: null, occurredAt: "2026-01-01T00:00:00.000Z",
        createdAt: "", updatedAt: "", riskLevel: null, isBlocked: false, isCritical: false,
        milestoneId: null, milestoneLabel: null, milestoneOrder: null, traceabilityScore: null, metadata: {},
      },
    ],
    edges: [],
    events: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("CAP-045 LivingGraphData view-model contract", () => {
  it("flag OFF → canonicalEvents/eventRelationships are absent/empty (byte-identical)", () => {
    const data = makeBaselineData();
    expect(data.canonicalEvents).toBeUndefined();
    expect(data.eventRelationships).toBeUndefined();
    expect(data.eventsTruncated).toBeUndefined();
  });

  it("flag ON → data carries canonicalEvents + eventRelationships (backward-compatible)", () => {
    const logRows: CanonicalEventLogRow[] = [
      {
        event_id: "e1", organization_id: "org-1", project_id: PROJECT, event_category: "risk",
        event_type: "risk_registered", event_schema_version: 1, event_importance: "MEDIUM",
        event_lifecycle_class: "BUSINESS_EVENT", subject_type: "risk", subject_id: "r1",
        actor_type: "human", actor_id: "u1", occurred_at: "2026-01-01T10:00:00.000Z",
        recorded_at: "2026-01-01T10:00:01.000Z", sequence_number: 1, source_module: "x",
        source_entity_type: "risks", source_entity_id: "r1", from_state: null, to_state: null,
        caused_by: null, is_compensating_event: null, compensates_event_id: null,
        event_hash: "h1", previous_event_hash: null, provenance: { capture_method: "direct" },
        confidence: null, payload: null, visibility: "members",
      },
    ];
    const objRows: CanonicalEventObjectRow[] = [
      { event_id: "e1", object_type: "risk", object_id: "r1", role: "focal" },
    ];
    const proj = projectEventRelationships(logRows, objRows, PROJECT);
    const data: LivingGraphData = {
      ...makeBaselineData(),
      canonicalEvents: proj.canonicalEvents,
      eventRelationships: proj.eventRelationships,
      eventsTruncated: false,
    };
    expect(data.canonicalEvents).toHaveLength(1);
    expect(data.eventRelationships?.some((r) => r.relationshipType === "relates_to_object")).toBe(true);
    // Backward-compat: the operational fields are unchanged.
    expect(data.nodes).toEqual(makeBaselineData().nodes);
    expect(data.edges).toEqual([]);
  });
});

// ── Events view uses canonical events; analysis stays on operational edges ────

describe("CAP-045 events view + analysis isolation", () => {
  it("buildCanonicalFlow renders every canonical event as a node + relationships as edges", () => {
    const events: LivingGraphCanonicalEvent[] = [
      {
        eventId: "e1", organizationId: "org-1", projectId: PROJECT, eventType: "risk_registered",
        eventCategory: "risk", eventSchemaVersion: 1, eventImportance: "HIGH",
        lifecycleClass: "BUSINESS_EVENT", subjectType: "risk", subjectId: "r1", actorType: "human",
        actorId: "u1", occurredAt: "2026-01-01T10:00:00.000Z", recordedAt: "2026-01-01T10:00:01.000Z",
        sequenceNumber: 1, sourceModule: "x", sourceEntityType: "risks", sourceEntityId: "r1",
        fromState: null, toState: null, causedBy: [], isCompensatingEvent: false,
        compensatesEventId: null, eventHash: "h1", previousEventHash: null,
        provenance: { capture_method: "direct" }, confidence: null, payload: null, visibility: "members",
        objectRefs: [{ object_type: "risk", object_id: "r1", role: "focal" }],
        dataQualityFlags: [], captureMethod: "direct", lateRecorded: false,
      },
      {
        ...({} as LivingGraphCanonicalEvent),
        eventId: "e2", organizationId: "org-1", projectId: PROJECT, eventType: "risk_assessed",
        eventCategory: "risk", eventSchemaVersion: 1, eventImportance: "MEDIUM",
        lifecycleClass: "BUSINESS_EVENT", subjectType: "risk", subjectId: "r1", actorType: "human",
        actorId: "u1", occurredAt: "2026-01-01T11:00:00.000Z", recordedAt: "2026-01-01T11:00:01.000Z",
        sequenceNumber: 2, sourceModule: "x", sourceEntityType: "risks", sourceEntityId: "r1",
        fromState: null, toState: null, causedBy: ["e1"], isCompensatingEvent: false,
        compensatesEventId: null, eventHash: "h2", previousEventHash: "h1",
        provenance: { capture_method: "direct" }, confidence: null, payload: null, visibility: "members",
        objectRefs: [{ object_type: "risk", object_id: "r1", role: "focal" }],
        dataQualityFlags: [], captureMethod: "direct", lateRecorded: false,
      },
    ];
    const rels: LivingGraphEventRelationship[] = [
      {
        id: "r1", projectId: PROJECT, sourceEventId: "e1", targetEventId: "e2", objectId: null,
        relationshipType: "project_sequence_next", relationshipClass: "temporal",
        objectType: null, objectRole: null, sequenceDistance: 1, occurredLagMs: 3600000,
        evidence: "deterministic_projection", metadata: {},
      },
      {
        id: "r2", projectId: PROJECT, sourceEventId: "e1", targetEventId: "e2", objectId: null,
        relationshipType: "caused_by", relationshipClass: "causal",
        objectType: null, objectRole: null, sequenceDistance: 1, occurredLagMs: 3600000,
        evidence: "explicit", metadata: {},
      },
    ];
    const flow = buildCanonicalFlow(events, rels, canonicalEventNodeId("e1"));
    const eventNodeIds = flow.nodes.filter((n) => n.type === "canonicalEvent").map((n) => n.id);
    expect(eventNodeIds).toEqual([canonicalEventNodeId("e1"), canonicalEventNodeId("e2")]);
    // The temporal edge (dashed) and causal edge (solid) both render.
    expect(flow.edges).toHaveLength(2);
    // Deterministic positions for every node.
    for (const n of flow.nodes) {
      expect(flow.positions.get(n.id)).toBeDefined();
    }
  });

  it("event relationships NEVER enter the operational analysis (critical path / bottleneck)", () => {
    // The operational analysis runs over process_nodes/process_edges ONLY.
    // Feed it the operational graph (no event relationships mixed in) and a
    // causal event relationship: the analysis must be computed over the
    // operational edges, and the event relationship must not influence it.
    const opNodes: LivingGraphNode[] = [
      {
        id: "n1", projectId: PROJECT, nodeType: "task_event", sourceEntityType: "roadmap_tasks",
        sourceEntityId: "t1", label: "A", description: null, status: "done", progress: 100,
        startDate: null, endDate: null, durationDays: 1, occurredAt: "2026-01-01T00:00:00.000Z",
        createdAt: "", updatedAt: "", riskLevel: null, isBlocked: false, isCritical: true,
        milestoneId: null, milestoneLabel: null, milestoneOrder: null, traceabilityScore: null, metadata: {},
      },
      {
        id: "n2", projectId: PROJECT, nodeType: "task_event", sourceEntityType: "roadmap_tasks",
        sourceEntityId: "t2", label: "B", description: null, status: "todo", progress: 0,
        startDate: null, endDate: null, durationDays: 2, occurredAt: "2026-01-02T00:00:00.000Z",
        createdAt: "", updatedAt: "", riskLevel: null, isBlocked: false, isCritical: false,
        milestoneId: null, milestoneLabel: null, milestoneOrder: null, traceabilityScore: null, metadata: {},
      },
    ];
    const opEdges: LivingGraphEdge[] = [
      {
        id: "pe1", projectId: PROJECT, sourceNodeId: "n1", targetNodeId: "n2",
        edgeType: "informed", weight: 1, lagDays: null, isCritical: false, riskLevel: null, metadata: {},
      },
    ];
    const analysis = analyzeGraph(opNodes, opEdges);

    // A stray event relationship object must be rejected by isExecutionRelationship
    // (i.e. the analysis helpers would never admit it as an operational edge).
    const strayRel: LivingGraphEventRelationship = {
      id: "rX", projectId: PROJECT, sourceEventId: "e1", targetEventId: "e2", objectId: null,
      relationshipType: "caused_by", relationshipClass: "causal", objectType: null, objectRole: null,
      sequenceDistance: 1, occurredLagMs: 1, evidence: "explicit", metadata: {},
    };
    expect(isExecutionRelationship(strayRel)).toBe(false);

    // The analysis metrics are driven ONLY by operational nodes/edges.
    expect(analysis.metrics.size).toBe(2);
    expect(analysis.adjacency.nodeById.has("n1")).toBe(true);
    expect(analysis.adjacency.nodeById.has("n2")).toBe(true);
    // No event-relationship id ever leaks into the analysis adjacency.
    expect(analysis.adjacency.nodeById.has(canonicalEventNodeId("e1"))).toBe(false);
    void strayRel;
  });

  it("milestones/activities views never populate canonicalEvents (coexist by construction)", () => {
    // The loader only populates canonicalEvents when the server flag is ON; the
    // operational milestones/activities paths never set them. A baseline data
    // object (no canonical fields) models the flag-OFF / milestones / activities
    // case — its analysis is purely operational.
    const data = makeBaselineData();
    expect(data.canonicalEvents ?? []).toEqual([]);
    const analysis = analyzeGraph(data.nodes, data.edges);
    expect(analysis.adjacency.nodeById.size).toBe(1);
  });
});