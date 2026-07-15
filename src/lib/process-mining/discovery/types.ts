export type ProcessActivityFamily = "task" | "milestone" | "dependency" | "responsibility" | "phase" | "risk" | "decision" | "approval" | "rework" | "other";
export type TemporalRole = "start" | "complete" | "wait_start" | "wait_end" | "neutral";

export interface DiscoveryEvent {
  eventId: string; organizationId: string; projectId: string; caseId: string;
  eventType: string; eventCategory: string; occurredAt: string | null; recordedAt: string;
  sequenceNumber: number; lifecycleClass: string; isCompensatingEvent: boolean;
}

export interface ClassifiedActivity {
  eventType: string; family: ProcessActivityFamily; temporalRole: TemporalRole; canonical: boolean;
}

export interface DirectFollowRelation {
  id: string; sourceActivity: string; targetActivity: string; occurrenceCount: number; caseCount: number;
  caseCoveragePct: number; medianElapsedMs: number | null; p90ElapsedMs: number | null;
}

export interface DiscoveredVariant {
  id: string; signature: string[]; caseIds: string[]; caseCount: number; frequencyPct: number; reworkRate: number;
}

export interface DeclaredProcessModel {
  modelId: string; allowedStarts: string[]; allowedEnds: string[]; allowedTransitions: Array<[string, string]>; requiredActivities: string[];
}

export type ConformanceDeviationType = "invalid_start" | "invalid_end" | "illegal_transition" | "missing_required_activity";
export interface ConformanceDeviation { caseId: string; type: ConformanceDeviationType; activity: string | null; sourceActivity: string | null; targetActivity: string | null; }
export interface CaseConformance { caseId: string; conformant: boolean; fitness: number; deviations: ConformanceDeviation[]; }

export interface CaseTemporalMetrics {
  caseId: string; cycleTimeMs: number | null; recordingSpanMs: number | null; explicitWaitingTimeMs: number | null;
  touchTimeMs: number | null; eventCount: number; limitations: string[];
}

export interface ProcessDiscoveryResult {
  organizationId: string; projectId: string; taxonomy: ClassifiedActivity[]; directFollow: DirectFollowRelation[];
  variants: DiscoveredVariant[]; conformance: CaseConformance[]; temporalMetrics: CaseTemporalMetrics[];
  quality: { totalEvents: number; usedEvents: number; excludedEvents: number; unknownActivities: number; cases: number; };
}
