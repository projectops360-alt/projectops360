// ============================================================================
// ProjectOps360° — Isabella Root Cause & Constraint Analysis · types (Task 4)
// ============================================================================
// ISABELLA-ROOT-CAUSE-CONSTRAINT-ANALYSIS-ENGINE
//
// Answers "WHY does this show execution problems, and what evidence supports
// that?" — evidence-backed, uncertainty-aware, CONSERVATIVE. It distinguishes
// symptom vs constraint vs likely/possible/confirmed cause vs insufficient
// evidence, and NEVER prescribes actions (that is Task 5). Pure types; reuses
// Task 1 confidence + citation types.
// ============================================================================

import type { IsabellaConfidence, IsabellaCitation } from "@/lib/isabella/process-intelligence/types";
import type { IsabellaContextStatus } from "@/lib/isabella/process-context/types";

export type ConstraintType =
  | "explicit_blocker"
  | "dependency_constraint"
  | "ownership_gap"
  | "milestone_assignment_gap"
  | "sequencing_gap"
  | "overdue_constraint"
  | "stalled_progress"
  | "decision_delay"
  | "approval_delay"
  | "external_dependency"
  | "capacity_signal"
  | "process_delay"
  | "rework_signal"
  | "bottleneck_signal"
  | "evidence_gap";

export type RootCauseClassification =
  | "confirmed_cause"
  | "likely_cause"
  | "possible_cause"
  | "insufficient_evidence";

export type FindingSeverity = "info" | "watch" | "at_risk" | "blocked";

export type SymptomType =
  | "blocked_task"
  | "overdue_task"
  | "missing_owner"
  | "missing_milestone"
  | "stalled"
  | "partial_context"
  | "process_delay"
  | "rework"
  | "bottleneck"
  | "unknown";

export interface AffectedEntity {
  type: "project" | "milestone" | "task" | "subtask" | "risk" | "decision" | "approval";
  title: string;
  safeRef?: string;
}

export interface SymptomSignal {
  id: string;
  type: SymptomType;
  label: string;
  evidenceRefs: string[];
}

export interface ConstraintSignal {
  id: string;
  type: ConstraintType;
  label: string;
  severity: FindingSeverity;
  confidence: IsabellaConfidence;
  evidenceRefs: string[];
  affectedEntityRefs: string[];
}

export interface EvidenceChainStep {
  kind: "evidence" | "signal" | "inference" | "limitation";
  label: string;
  evidenceRef?: string;
  confidence: IsabellaConfidence;
}

export interface EvidenceChain {
  id: string;
  findingId: string;
  steps: EvidenceChainStep[];
  conclusion: string;
}

export interface RootCauseFinding {
  id: string;
  label: string;
  classification: RootCauseClassification;
  constraintType: ConstraintType;
  severity: FindingSeverity;
  confidence: IsabellaConfidence;
  explanation: string;
  affectedEntities: AffectedEntity[];
  evidenceRefs: string[];
  citations?: IsabellaCitation[];
  limitations?: string[];
}

export interface InvestigationGap {
  label: string;
  missingEvidenceType: string;
  reason: string;
  blocksConfidenceAbove?: "low" | "medium" | "high";
}

export interface RecommendationHandoffHint {
  reason: string;
  findingIds: string[];
  evidenceRefs: string[];
  allowedForRecommendationEngine: true;
}

export interface RootCauseAnalysisScope {
  projectId?: string;
  milestoneId?: string;
  taskId?: string;
  source: "project" | "milestone" | "task" | "daily_diagnosis";
}

export interface IsabellaRootCauseAnalysis {
  status: IsabellaContextStatus;
  projectId: string | null;
  organizationId: string | null;
  snapshotAt: string;
  title: string;
  summary: string;
  analysisScope: RootCauseAnalysisScope;
  findings: RootCauseFinding[];
  constraints: ConstraintSignal[];
  symptoms: SymptomSignal[];
  evidenceChains: EvidenceChain[];
  investigationGaps: InvestigationGap[];
  recommendationHandoffHints: RecommendationHandoffHint[];
  confidence: IsabellaConfidence;
  evidenceRefs: string[];
  citations: IsabellaCitation[];
  limitations: string[];
  message?: string;
}

export type RootCauseLanguage = "en" | "es";

/** Constraint types this engine can support TODAY (others are evidence gaps). */
export const SUPPORTED_CONSTRAINT_TYPES: ConstraintType[] = [
  "explicit_blocker",
  "ownership_gap",
  "milestone_assignment_gap",
  "overdue_constraint",
  "process_delay",
  "rework_signal",
  "bottleneck_signal",
  "evidence_gap",
];
