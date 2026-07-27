import type { LivingGraphEdge, LivingGraphNode, LivingGraphRiskLevel } from "@/types/living-graph";
import type { TrustLensEdge, TrustLensNode, TrustNodeKind } from "./trust-lens-projection";
import type { ProcessEdgeType, ProcessNodeType, ProcessNodeSourceType } from "@/types/database";
import type { NodePosition } from "./living-graph-layout";

// ============================================================================
// Living Graph — Enterprise Trust lens adapter (presentation only)
// ============================================================================
// PURE mapping from the trust projection onto the Living Graph view-model so
// the lens reuses the EXISTING React Flow node/edge components instead of
// growing a parallel renderer. Nothing is persisted and no operational field is
// invented: `status` carries the control state / evidence outcome the
// projection already measured, and `riskLevel` carries freshness so a stale
// control reads as risk in the same visual language as the rest of the graph.
// ============================================================================

/** The lens is org-scoped, but the view-model is project-shaped. */
const LENS_PROJECT_ID = "trust-lens";

const KIND_TO_NODE_TYPE: Record<TrustNodeKind, ProcessNodeType> = {
  control: "milestone_gate",
  evidence_binding: "evidence_reference",
  finding: "risk_event",
  owner: "resource_event",
  obligation: "knowledge_object",
};

const KIND_TO_SOURCE_TYPE: Record<TrustNodeKind, ProcessNodeSourceType> = {
  control: "milestones",
  evidence_binding: "knowledge_evidence",
  finding: "risks",
  owner: "resources",
  obligation: "project_knowledge_objects",
};

const EDGE_KIND_TO_EDGE_TYPE: Record<TrustLensEdge["kind"], ProcessEdgeType> = {
  supports: "supported_by",
  raises: "creates_risk",
  owned_by: "assigned_to",
  satisfies: "requires_approval",
  contradicts: "contradicted_by",
};

/** Freshness maps onto the shared risk scale so lapsed evidence lights up in
 *  the same colours users already read as "needs attention". */
function riskOf(node: TrustLensNode): LivingGraphRiskLevel | null {
  if (node.severity === "critical" || node.severity === "high") return "high";
  switch (node.freshness) {
    case "unreadable":
    case "stale":
      return "high";
    case "warning":
      return "medium";
    case "never_measured":
      return node.kind === "obligation" ? null : "medium";
    case "fresh":
      return "low";
  }
}

/** The badge line under the node label. Reads the measured verdict — never a
 *  default, so a control that was never measured says so. */
function statusOf(node: TrustLensNode): string | null {
  return node.controlState ?? node.evidenceOutcome ?? node.conditionCode ?? null;
}

export function adaptTrustLens(
  nodes: readonly TrustLensNode[],
  edges: readonly TrustLensEdge[],
): { nodes: LivingGraphNode[]; edges: LivingGraphEdge[]; positions: Map<string, NodePosition> } {
  const adaptedNodes: LivingGraphNode[] = nodes.map((node) => ({
    id: node.id,
    projectId: LENS_PROJECT_ID,
    nodeType: KIND_TO_NODE_TYPE[node.kind],
    sourceEntityType: KIND_TO_SOURCE_TYPE[node.kind],
    sourceEntityId: node.canonicalObjectId,
    label: node.label,
    description: null,
    status: statusOf(node),
    progress: null,
    startDate: null,
    endDate: null,
    durationDays: null,
    // The lens has no event time — it is a snapshot of the current verdict.
    // A fabricated timestamp would make the date filters silently drop nodes.
    occurredAt: "",
    createdAt: "",
    updatedAt: "",
    riskLevel: riskOf(node),
    isBlocked: false,
    isCritical: false,
    milestoneId: null,
    milestoneLabel: null,
    milestoneOrder: null,
    traceabilityScore: null,
    metadata: {
      trustLens: true,
      trustKind: node.kind,
      freshness: node.freshness,
      severity: node.severity,
      controlState: node.controlState,
      evidenceOutcome: node.evidenceOutcome,
      conditionCode: node.conditionCode,
      ownerUserId: node.ownerUserId,
      occurrenceCount: node.occurrenceCount,
      canonicalObjectId: node.canonicalObjectId,
    },
  }));

  const adaptedEdges: LivingGraphEdge[] = edges.map((edge) => ({
    id: edge.id,
    projectId: LENS_PROJECT_ID,
    sourceNodeId: edge.sourceId,
    targetNodeId: edge.targetId,
    edgeType: EDGE_KIND_TO_EDGE_TYPE[edge.kind],
    weight: 1,
    lagDays: null,
    isCritical: false,
    // An unresolved contradiction is a cause of a control not operating, so it
    // is rendered as high risk rather than as an ordinary relation.
    riskLevel: edge.contradictory ? "high" : null,
    metadata: {
      trustLens: true,
      trustEdgeKind: edge.kind,
      contradictory: edge.contradictory,
      resolutionStatus: edge.resolutionStatus,
    },
  }));

  return { nodes: adaptedNodes, edges: adaptedEdges, positions: layoutTrustLens(nodes) };
}

// ── Layout ──────────────────────────────────────────────────────────────────
// Deterministic bands by kind (obligations → controls → evidence/findings →
// owners). Controls are the spine of the lens, so they get the centre band and
// everything that explains a control sits directly above or below it.

const BAND_ORDER: TrustNodeKind[] = ["obligation", "control", "evidence_binding", "finding", "owner"];
const BAND_GAP_Y = 220;
const BAND_GAP_X = 280;

function layoutTrustLens(nodes: readonly TrustLensNode[]): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  BAND_ORDER.forEach((kind, band) => {
    nodes
      .filter((node) => node.kind === kind)
      .forEach((node, index) => {
        positions.set(node.id, { x: 40 + index * BAND_GAP_X, y: 60 + band * BAND_GAP_Y });
      });
  });
  return positions;
}
