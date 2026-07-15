export const CANONICAL_GRAPH_SPEC_VERSION = "1.0.0";

export const CANONICAL_GRAPH_LAYERS = [
  "object", "relationship", "event", "knowledge", "intelligence", "prediction",
] as const;

export type CanonicalGraphLayer = (typeof CANONICAL_GRAPH_LAYERS)[number];
export type CanonicalRelationshipClass =
  | "temporal"
  | "causal"
  | "compensation"
  | "association"
  | "derived_intelligence";

export const CANONICAL_NODE_FAMILIES = [
  "project", "milestone", "task", "subtask", "risk", "decision", "document", "resource", "external_reference",
  "canonical_event", "knowledge_object", "engine_finding", "metric", "intelligence_signal", "prediction_signal",
] as const;

export type CanonicalNodeFamily = (typeof CANONICAL_NODE_FAMILIES)[number];

export const CANONICAL_RELATIONSHIP_FAMILIES = [
  "project_sequence_next", "object_sequence_next", "caused_by", "compensates", "relates_to_object",
  "supported_by", "contradicted_by", "contextualized_by", "derived_from", "intelligence_about", "prediction_about",
] as const;

export type CanonicalRelationshipFamily = (typeof CANONICAL_RELATIONSHIP_FAMILIES)[number];

export interface CanonicalRelationshipRule {
  family: CanonicalRelationshipFamily;
  relationshipClass: CanonicalRelationshipClass;
  sourceFamilies: readonly CanonicalNodeFamily[];
  targetFamilies: readonly CanonicalNodeFamily[];
  requiresEvidence: boolean;
  requiresExplicitProvenance: boolean;
}

const OBJECT_FAMILIES: readonly CanonicalNodeFamily[] = [
  "project", "milestone", "task", "subtask", "risk", "decision", "document", "resource", "external_reference",
];

export const CANONICAL_RELATIONSHIP_RULES: readonly CanonicalRelationshipRule[] = [
  { family: "project_sequence_next", relationshipClass: "temporal", sourceFamilies: ["canonical_event"], targetFamilies: ["canonical_event"], requiresEvidence: false, requiresExplicitProvenance: false },
  { family: "object_sequence_next", relationshipClass: "temporal", sourceFamilies: ["canonical_event"], targetFamilies: ["canonical_event"], requiresEvidence: false, requiresExplicitProvenance: false },
  { family: "caused_by", relationshipClass: "causal", sourceFamilies: ["canonical_event"], targetFamilies: ["canonical_event"], requiresEvidence: true, requiresExplicitProvenance: true },
  { family: "compensates", relationshipClass: "compensation", sourceFamilies: ["canonical_event"], targetFamilies: ["canonical_event"], requiresEvidence: true, requiresExplicitProvenance: true },
  { family: "relates_to_object", relationshipClass: "association", sourceFamilies: ["canonical_event"], targetFamilies: OBJECT_FAMILIES, requiresEvidence: true, requiresExplicitProvenance: false },
  { family: "supported_by", relationshipClass: "association", sourceFamilies: ["knowledge_object"], targetFamilies: [...OBJECT_FAMILIES, "canonical_event", "engine_finding", "metric"], requiresEvidence: true, requiresExplicitProvenance: false },
  { family: "contradicted_by", relationshipClass: "association", sourceFamilies: ["knowledge_object"], targetFamilies: [...OBJECT_FAMILIES, "canonical_event", "engine_finding", "metric"], requiresEvidence: true, requiresExplicitProvenance: false },
  { family: "contextualized_by", relationshipClass: "association", sourceFamilies: ["knowledge_object"], targetFamilies: [...OBJECT_FAMILIES, "canonical_event", "engine_finding", "metric"], requiresEvidence: true, requiresExplicitProvenance: false },
  { family: "derived_from", relationshipClass: "derived_intelligence", sourceFamilies: ["knowledge_object", "intelligence_signal", "prediction_signal"], targetFamilies: ["canonical_event", "engine_finding", "metric", ...OBJECT_FAMILIES], requiresEvidence: true, requiresExplicitProvenance: true },
  { family: "intelligence_about", relationshipClass: "derived_intelligence", sourceFamilies: ["intelligence_signal"], targetFamilies: [...OBJECT_FAMILIES, "canonical_event", "knowledge_object"], requiresEvidence: true, requiresExplicitProvenance: true },
  { family: "prediction_about", relationshipClass: "derived_intelligence", sourceFamilies: ["prediction_signal"], targetFamilies: [...OBJECT_FAMILIES, "knowledge_object"], requiresEvidence: true, requiresExplicitProvenance: true },
];

export const CANONICAL_GRAPH_SPEC = {
  id: "projectops360-canonical-graph",
  version: CANONICAL_GRAPH_SPEC_VERSION,
  layers: CANONICAL_GRAPH_LAYERS,
  nodeFamilies: CANONICAL_NODE_FAMILIES,
  relationshipRules: CANONICAL_RELATIONSHIP_RULES,
  invariants: {
    temporalOrderIsCausality: false,
    graphOwnsKnowledgeLifecycle: false,
    projectionsAreReadOnly: true,
  },
} as const;
