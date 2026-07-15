import type { KnowledgeConfidence, KnowledgeLifecycleStatus } from "@/lib/knowledge-layer/types";
import type { CanonicalGraphLayer, CanonicalNodeFamily, CanonicalRelationshipClass, CanonicalRelationshipFamily } from "./canonical-graph-spec";

export interface CanonicalGraphNavigation {
  kind: "project_object" | "project_event" | "knowledge_object" | "evidence";
  ref: string;
  href: string | null;
}

export interface CanonicalGraphNode {
  id: string;
  organizationId: string;
  projectId: string;
  layer: CanonicalGraphLayer;
  family: CanonicalNodeFamily;
  sourceRef: string;
  label: string;
  description: string | null;
  lifecycleStatus: KnowledgeLifecycleStatus | null;
  confidence: KnowledgeConfidence | null;
  evidenceRefs: string[];
  provenance: Record<string, unknown> | null;
  navigation: CanonicalGraphNavigation;
  recordedAt: string;
  metadata: Record<string, unknown>;
}

export interface CanonicalGraphEdge {
  id: string;
  organizationId: string;
  projectId: string;
  layer: "relationship";
  family: CanonicalRelationshipFamily;
  relationshipClass: CanonicalRelationshipClass;
  sourceNodeId: string;
  targetNodeId: string;
  evidenceRefs: string[];
  provenance: Record<string, unknown> | null;
  navigation: CanonicalGraphNavigation | null;
  metadata: Record<string, unknown>;
}

export interface CanonicalGraphProjection {
  specVersion: string;
  nodes: CanonicalGraphNode[];
  edges: CanonicalGraphEdge[];
}

export type CanonicalGraphValidationCode =
  | "cross_tenant"
  | "cross_project"
  | "duplicate_id"
  | "unstable_id"
  | "unknown_family"
  | "dangling_endpoint"
  | "invalid_source_target"
  | "invalid_relationship_class"
  | "missing_evidence"
  | "missing_provenance";

export interface CanonicalGraphValidationIssue {
  code: CanonicalGraphValidationCode;
  entityId: string;
  message: string;
}

export interface CanonicalGraphValidationResult {
  valid: boolean;
  issues: CanonicalGraphValidationIssue[];
}
