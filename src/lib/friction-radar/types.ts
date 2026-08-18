// ProjectOps360° — Friction Radar v1
// Pure, read-only contracts. Friction Radar consumes existing intelligence; it does not
// replace MPF, Process Mining, Living Graph, EVM, Risk, or Isabella.

export const FRICTION_CATEGORIES = [
  "process",
  "resource",
  "dependency",
  "schedule",
  "cost",
  "risk",
  "decision",
  "quality",
] as const;

export type FrictionCategory = (typeof FRICTION_CATEGORIES)[number];
export type FrictionSeverity = "low" | "medium" | "high" | "critical";
export type FrictionTrend = "improving" | "stable" | "worsening" | "unknown";
export type FrictionConfidence = "unknown" | "low" | "medium" | "high";

export type FrictionSource =
  | "mpf"
  | "process_mining"
  | "living_graph"
  | "execution_intelligence"
  | "resource_intelligence"
  | "risk_intelligence"
  | "isabella";

export interface FrictionEvidenceRef {
  kind: string;
  id: string;
  label?: string;
}

export interface FrictionSignal {
  signalId: string;
  organizationId: string;
  projectId: string;
  source: FrictionSource;
  signalType: string;
  category: FrictionCategory;
  entityType?: string | null;
  entityId?: string | null;
  taskId?: string | null;
  milestoneId?: string | null;
  severity: FrictionSeverity;
  confidence: FrictionConfidence;
  magnitude?: number | null; // optional normalized 0..1; severity is used when absent
  observedValue?: string | number | boolean | null;
  expectedOrBaseline?: string | number | boolean | null;
  evidenceStatus?: "confirmed" | "candidate" | "unknown" | "insufficient_evidence";
  occurredAt?: string | null;
  evidenceTimestampStart?: string | null;
  evidenceTimestampEnd?: string | null;
  evidenceDescription?: string | null;
  evidenceRefs: FrictionEvidenceRef[];
  relatedEntityIds?: string[];
  metadata?: Record<string, string | number | boolean | null>;
}

export interface FrictionCategoryScore {
  category: FrictionCategory;
  /** Deliberately null in v1: category aggregation is not yet approved. */
  score: number | null;
  signalCount: number;
  confidence: FrictionConfidence;
  topSignalIds: string[];
}

export interface FrictionCluster {
  clusterId: string;
  projectId: string;
  categories: FrictionCategory[];
  signalIds: string[];
  entityIds: string[];
  /** Deliberately null in v1: correlation does not imply aggregate severity. */
  score: number | null;
  confidence: FrictionConfidence;
}

export interface FrictionRadarReadModel {
  organizationId: string;
  projectId: string;
  /** Deliberately null until a global aggregation policy is validated. */
  score: number | null;
  severity: FrictionSeverity | null;
  trend: FrictionTrend;
  confidence: FrictionConfidence;
  categories: FrictionCategoryScore[];
  clusters: FrictionCluster[];
  topSignalIds: string[];
  generatedFromSignalCount: number;
  version: "friction-radar-v1";
}
