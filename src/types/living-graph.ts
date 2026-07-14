// ============================================================================
// ProjectOps360° — Living Graph visualization data contract (PI-005)
// ============================================================================
// Normalized, camelCase view-model types consumed by the Living Graph
// visualization. The server page maps raw `process_nodes` / `process_edges`
// rows (see types/database.ts) into these shapes, enriching them with
// roadmap task / milestone data when the source entity is available.
// ============================================================================

import type {
  ProcessNodeType,
  ProcessEdgeType,
  ProcessNodeSourceType,
  ShortageRiskLevel,
} from "./database";

import type { CapacityInsightKind } from "@/lib/labor/explanation";

export type LivingGraphRiskLevel = "low" | "medium" | "high";

/** Normalized process node, enriched from its source entity when possible. */
export interface LivingGraphNode {
  id: string;
  projectId: string;
  nodeType: ProcessNodeType;
  sourceEntityType: ProcessNodeSourceType;
  sourceEntityId: string;
  label: string;
  description: string | null;
  /** Status of the source entity (task/milestone status) if resolvable. */
  status: string | null;
  /** 0–100 progress of the source entity if resolvable. */
  progress: number | null;
  startDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  riskLevel: LivingGraphRiskLevel | null;
  isBlocked: boolean;
  /** Backend-computed critical flag (roadmap_tasks.is_critical). */
  isCritical: boolean;
  /** Milestone this activity belongs to (drill-down grouping). */
  milestoneId: string | null;
  milestoneLabel: string | null;
  /** Roadmap order of that milestone (drives the flowchart sequence). */
  milestoneOrder: number | null;
  /** 0–1 heuristic; null when not computable. */
  traceabilityScore: number | null;
  metadata: Record<string, unknown>;
}

/** Normalized process edge. */
export interface LivingGraphEdge {
  id: string;
  projectId: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: ProcessEdgeType;
  weight: number;
  lagDays: number | null;
  /** Whether both endpoints are on the computed critical path. */
  isCritical: boolean;
  riskLevel: LivingGraphRiskLevel | null;
  metadata: Record<string, unknown>;
}

/** Chronological process event used by timeline playback. */
export interface LivingGraphEvent {
  id: string;
  projectId: string;
  eventType: ProcessNodeType;
  entityType: ProcessNodeSourceType;
  entityId: string;
  /** The process node this event materialized as. */
  nodeId: string;
  label: string;
  occurredAt: string;
  inDegree: number;
  outDegree: number;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Canonical-event Relationships view (CAP-045 extension)
// ============================================================================
// A read-only PROJECTION over the canonical event store (project_event_log +
// project_event_objects). These types mirror the event store 1:1 — they never
// invent fields and never duplicate the operational `process_nodes`/`process_edges`
// projection. Causality is only represented when EXPLICITLY recorded (caused_by /
// compensates_event_id); temporal order is order alone, never implied causality.
// ============================================================================

/** Lifecycle class of a canonical event (mirrors project_event_log CHECK). */
export type CanonicalEventLifecycleClass =
  | "BUSINESS_EVENT"
  | "SYSTEM_EVENT"
  | "AI_EVENT"
  | "DERIVED_EVENT"
  | "EXTERNAL_EVENT"
  | "SYNTHETIC_BACKFILL_EVENT";

/** Actor that produced the event (mirrors project_event_log CHECK). */
export type CanonicalEventActorType = "human" | "system" | "ai" | "external";

/** Importance of a canonical event (mirrors project_event_log CHECK). */
export type CanonicalEventImportance = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/** Role an object plays relative to an event (mirrors project_event_objects). */
export type CanonicalEventObjectRole =
  | "focal"
  | "context"
  | "impacted"
  | "protected"
  | "response"
  | "control"
  | "materialization"
  | "evidence"
  | "responsibility"
  | "reference"
  | "phase"
  | "previous_responsibility"
  | "previous_phase"
  | "predecessor"
  | "relation"
  | "actor"
  | "other";

/** A single object reference attached to a canonical event. */
export interface CanonicalEventObjectRef {
  object_type: string;
  object_id: string;
  role: CanonicalEventObjectRole;
}

/** How the event was captured (mirrors provenance.capture_method). */
export type CanonicalEventCaptureMethod =
  | "direct"
  | "scribe"
  | "import"
  | "system"
  | "ai_extracted"
  | "backfill"
  | string;

/**
 * Canonical event projected 1:1 from a project_event_log row plus its
 * project_event_objects refs. Every field is read straight from the log — none
 * is invented, recalculated, or merged across the two timestamps.
 */
export interface LivingGraphCanonicalEvent {
  /** project_event_log.event_id (uuid). */
  eventId: string;
  organizationId: string;
  projectId: string;
  /** project_event_log.case_id — canonical process case framing. */
  caseId: string;
  /** project_event_log.event_type (canonical event_type, NOT ProcessNodeType). */
  eventType: string;
  /** project_event_log.event_category (e.g. risk). */
  eventCategory: string;
  /** project_event_log.event_schema_version. */
  eventSchemaVersion: number | null;
  /** project_event_log.event_importance (CRITICAL/HIGH/MEDIUM/LOW). */
  eventImportance: CanonicalEventImportance | null;
  /** project_event_log.event_lifecycle_class. */
  lifecycleClass: CanonicalEventLifecycleClass | null;
  /** project_event_log.subject_type / subject_id. */
  subjectType: string | null;
  subjectId: string | null;
  /** project_event_log.actor_type / actor_id. */
  actorType: CanonicalEventActorType | null;
  actorId: string | null;
  /** Business time (occurred_at) — the moment the thing happened. */
  occurredAt: string | null;
  /** Recording time (recorded_at) — the moment it entered the log. */
  recordedAt: string | null;
  /** Authoritative per-project order (project_event_log.sequence_number). */
  sequenceNumber: number;
  /** project_event_log.source_module / source_entity_type / source_entity_id. */
  sourceModule: string | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  /** State transition carried by the event, if any. */
  fromState: string | null;
  toState: string | null;
  /** Explicitly recorded cause(s) — uuid[] pointing at earlier events. ONLY
   *  present when the source registered it; never inferred from proximity. */
  causedBy: string[];
  /** Whether this event compensates a prior one, and which. */
  isCompensatingEvent: boolean;
  compensatesEventId: string | null;
  /** Tamper-evident chain fields (read-only display). */
  eventHash: string | null;
  previousEventHash: string | null;
  /** Provenance blob (capture_method, evidenceRefs, flags, idempotency_fingerprint…). */
  provenance: Record<string, unknown> | null;
  /** project_event_log.confidence (0–1) if recorded. */
  confidence: number | null;
  /** project_event_log.payload (opaque; rendered behind a collapsible section). */
  payload: Record<string, unknown> | null;
  /** project_event_log.visibility. */
  visibility: string | null;
  /** Object refs from project_event_objects (grouped by event_id). */
  objectRefs: CanonicalEventObjectRef[];
  /** Recorded data-quality flags from provenance (e.g. missing_prior_closure). */
  dataQualityFlags: string[];
  /** capture_method extracted from provenance for quick display. */
  captureMethod: CanonicalEventCaptureMethod | null;
  /** True iff recorded_at lags occurred_at beyond a nominal threshold. FLAGGED
   *  ONLY from the recorded values — never recalculated or invented. */
  lateRecorded: boolean;
}

/** Class of a projected event relationship. Drives edge styling. */
export type EventRelationshipClass =
  | "temporal"
  | "causal"
  | "compensation"
  | "object_reference";

/** The five relationship types produced by the projection. */
export type EventRelationshipType =
  | "project_sequence_next"
  | "object_sequence_next"
  | "caused_by"
  | "compensates"
  | "relates_to_object";

/** Whether a relationship is backed by an explicit record or deterministic
 *  projection. Causal/compensation are `explicit` (read from the log); temporal
 *  adjacency and object-reference are `deterministic_projection` (derived from
 *  order). This field is the audit trail that proves we never infer causality. */
export type EventRelationshipEvidence = "explicit" | "deterministic_projection";

/** A deterministic relationship between two canonical events, or between an
 *  event and an object. Built purely from project_event_log +
 *  project_event_objects — never written, never persisted. */
export interface LivingGraphEventRelationship {
  /** Deterministic id (stable across runs for the same inputs). */
  id: string;
  projectId: string;
  /** Source canonical event (eventId). */
  sourceEventId: string;
  /** Target canonical event (eventId) for event↔event relationships. */
  targetEventId: string | null;
  /** Target object (object_id) for relates_to_object relationships. */
  objectId: string | null;
  relationshipType: EventRelationshipType;
  relationshipClass: EventRelationshipClass;
  /** For relates_to_object: the object_type of the referenced object. */
  objectType: string | null;
  /** For relates_to_object: the role the object plays relative to the event. */
  objectRole: CanonicalEventObjectRole | null;
  /** Sequence distance between source and target event (≥1 for temporal/causal). */
  sequenceDistance: number;
  /** Wall-clock lag between the two events' occurred_at (ms). Null if either
   *  occurred_at is absent. */
  occurredLagMs: number | null;
  /** explicit (recorded cause/compensation) vs deterministic_projection
   *  (derived order/object-ref). */
  evidence: EventRelationshipEvidence;
  metadata: Record<string, unknown>;
}

/** Full payload passed from the server page to the client view. */
export interface LivingGraphData {
  nodes: LivingGraphNode[];
  edges: LivingGraphEdge[];
  events: LivingGraphEvent[];
  generatedAt: string;
  // ── Canonical-event Relationships view (CAP-045 extension) ───────────────
  // ALL OPTIONAL and backward-compatible: when the feature flag
  // LIVING_GRAPH_EVENT_RELATIONSHIPS_PROJECT_IDS is OFF (default), these are
  // absent/empty and the Living Graph behaves byte-identically to before. When
  // ON, the "events" view renders a read-only PROJECTION over the canonical
  // event store (project_event_log + project_event_objects) — never a second
  // event store, never a write path.
  /** Canonical events projected from project_event_log (1:1 with log rows). */
  canonicalEvents?: LivingGraphCanonicalEvent[];
  /** Deterministic relationships between events / events↔objects. */
  eventRelationships?: LivingGraphEventRelationship[];
  /** True when the event log exceeded the explicit read limit and was
   *  truncated. Surfaced in the view so the user knows the projection is
   *  bounded — never silently truncated. */
  eventsTruncated?: boolean;
  // ── Projection status contract (CAP-045 §C.2 / Part B) ─────────────────
  // EXPLICIT signal of the canonical-event projection state so the "events"
  // view never silently falls back to operational process_nodes/process_edges.
  // - "disabled": flag OFF for this project (the three arrays above stay
  //   undefined — preserves the byte-identical invariant for flag-OFF).
  // - "empty":    flag ON, projection loaded, 0 canonical events.
  // - "ready":    flag ON, ≥1 canonical event rendered.
  // - "truncated": flag ON, log exceeded the explicit read limit.
  // - "error":    the projection read failed (loader returned status "error").
  canonicalEventProjectionStatus?: CanonicalEventProjectionStatus;
  /** The project the page actually requested. The view filters every layer
   *  to rows whose projectId === requestedProjectId — defense-in-depth against
   *  any cross-project leak when data is reused across mounts. */
  requestedProjectId?: string;
}

/** Explicit state of the canonical-event projection for the current project.
 *  Drives the status banners in the "events" view (never a silent fallback). */
export type CanonicalEventProjectionStatus =
  | "disabled"
  | "empty"
  | "ready"
  | "error"
  | "truncated";

export type LivingGraphOverlay =
  | "normal"
  | "bottleneck"
  | "criticalPath"
  | "rework"
  | "traceabilityGap"
  | "risk"
  | "sopCandidate"
  | "blocker"
  | "timeline"
  | "simulation"
  | "laborCapacity"
  | "readiness"
  | "variance"
  | "workforceCapacity";

export type LivingGraphLayoutMode = "hierarchical" | "timeline" | "force";

/**
 * Detail level of the rendered graph:
 * - milestones: one node per milestone (high-level flowchart, default)
 * - activities: one node per source entity (aggregated process map)
 * - events: every process event as its own node
 */
export type LivingGraphViewLevel = "milestones" | "activities" | "events";

export type LivingGraphSimulationScenario =
  | "delay1d"
  | "delay3d"
  | "delay1w"
  | "markBlocked"
  | "removeBlocker"
  | "increaseDuration";

/** Result of a deterministic what-if simulation run. */
export interface LivingGraphSimulationState {
  focusNodeId: string;
  scenario: LivingGraphSimulationScenario;
  affectedNodeIds: string[];
  /** Estimated extra days propagated to the deepest affected node. */
  estimatedDelayDays: number;
  /** Number of critical-path nodes among the affected set. */
  criticalPathImpact: number;
  /** Milestone-gate nodes affected downstream. */
  affectedMilestoneLabels: string[];
  /** Strongest downstream dependency (highest weight edge target). */
  strongestDependencyLabel: string | null;
  riskDelta: LivingGraphRiskLevel;
}

/** Deterministic insight rendered in the detail panel (AI placeholder). */
export interface LivingGraphInsight {
  /** i18n key under livingGraph.insights */
  kind:
    | "bottleneck"
    | "rework"
    | "traceabilityGap"
    | "risk"
    | "sopCandidate"
    | "blocker"
    | "laborCapacityGap"
    | "healthy";
  /** Values interpolated into the i18n template. */
  values: Record<string, string | number>;
}

/** Labor risk metadata attached to synthetic labor_risk nodes or enriched existing nodes. */
export interface LaborRiskNodeData {
  tradeKey: string;
  weekLabel: string;
  shortageRisk: ShortageRiskLevel;
  gapHeadcount: number;
  requiredHeadcount: number;
  availableHeadcount: number;
  utilizationPct: number | null;
  locationZone: string | null;
  affectedActivityKeys: string[];
  affectedResourceKeys: string[];
  affectedMilestoneIds: string[];
  criticalPathImpact: boolean;
  insightKind: CapacityInsightKind;
}

/** Workface readiness metadata attached to construction_activity nodes. */
export interface ReadinessNodeData {
  readinessLevel: "ready" | "at_risk" | "not_ready" | "blocked";
  readinessPct: number;
  missingPrerequisites: string[];
  summary: string;
  recommendedAction: string;
}

/** Productivity variance metadata attached to construction_activity nodes. */
export interface VarianceNodeData {
  /** Variance severity classification (on_track/minor/major/critical). */
  varianceSeverity: "on_track" | "minor" | "major" | "critical";
  /** Variance percentage (null if not tracked). */
  variancePct: number | null;
  /** Schedule risk level. */
  scheduleRisk: "none" | "low" | "medium" | "high" | "critical";
  /** Numeric risk score 0-100. */
  scheduleRiskScore: number;
  /** Most likely cause category. */
  likelyCause: string;
  /** Confidence score 0-1 for the likely cause. */
  causeConfidence: number;
  /** Trend direction compared to trade peers. */
  trendDirection: "improving" | "worsening" | "stable" | "insufficient_data";
}

/** Generic Resource Capacity (Workforce Intelligence Layer) metadata attached
 *  to resource nodes and to task/milestone nodes affected by capacity. */
export interface WorkforceNodeData {
  /** available | healthy | near_capacity | overallocated | critical | needs_review */
  status: string;
  utilizationPercent: number | null;
  resourceName: string | null;
  role: string | null;
  effectiveHours: number | null;
  assignedHours: number | null;
  overallocatedHours: number | null;
  /** "resource" for resource nodes, "task" / "milestone" for enriched nodes. */
  kind: "resource" | "task" | "milestone";
}

/** Project-level summary shown in the toolbar / header. */
export interface GraphMetricSummary {
  nodeCount: number;
  edgeCount: number;
  orphanCount: number;
  cycleCount: number;
  /** Items with an explicit active impediment (ADR-006). Never dependency-derived. */
  blockedCount: number;
  /** Items waiting on unfinished predecessor(s) — NOT blocked (ADR-006). */
  waitingCount: number;
  bottleneckCount: number;
  criticalPathLength: number;
  maxDepth: number;
  laborRiskCount: number;
}
