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
  severity: FrictionSeverity;
  confidence: FrictionConfidence;
  magnitude?: number | null; // optional normalized 0..1; severity is used when absent
  occurredAt?: string | null;
  evidenceRefs: FrictionEvidenceRef[];
  relatedEntityIds?: string[];
  metadata?: Record<string, string | number | boolean | null>;
}

export interface FrictionCategoryScore {
  category: FrictionCategory;
  score: number; // 0..100, higher = more friction
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
  score: number;
  confidence: FrictionConfidence;
}

export interface FrictionRadarReadModel {
  organizationId: string;
  projectId: string;
  score: number;
  severity: FrictionSeverity;
  trend: FrictionTrend;
  confidence: FrictionConfidence;
  categories: FrictionCategoryScore[];
  clusters: FrictionCluster[];
  topSignalIds: string[];
  generatedFromSignalCount: number;
  version: "friction-radar-v1";
}
