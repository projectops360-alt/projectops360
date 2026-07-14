// ============================================================================
// ProjectOps360° — Isabella Daily Process Diagnosis · types (Phase 5 · Task 3)
// ============================================================================
// ISABELLA-DAILY-PROCESS-DIAGNOSIS-ENGINE
//
// A SYNTHESIS layer over the Task 2 IsabellaProcessContext: "what is happening
// today, what needs attention, and what evidence supports that". Deterministic
// where data is deterministic; evidence-backed where judgment is needed. It
// identifies SYMPTOMS + attention signals only — NEVER root causes, NEVER
// recommendations. Pure types; reuses Task 1 confidence + citation types.
// ============================================================================

import type { IsabellaConfidence, IsabellaCitation } from "@/lib/isabella/process-intelligence/types";
import type { IsabellaContextStatus } from "@/lib/isabella/process-context/types";

export type DiagnosisHealthLevel = "healthy" | "watch" | "at_risk" | "blocked" | "unknown";

export type DiagnosisSectionStatus = "ok" | "watch" | "at_risk" | "blocked" | "unknown" | "unavailable";

export type DiagnosisSeverity = "info" | "watch" | "at_risk" | "blocked";

export interface DiagnosisItem {
  label: string;
  detail: string;
  severity: DiagnosisSeverity;
  confidence: IsabellaConfidence;
  evidenceRefs: string[];
  citations?: IsabellaCitation[];
}

export interface DiagnosisSection {
  title: string;
  status: DiagnosisSectionStatus;
  summary: string;
  items: DiagnosisItem[];
  limitations?: string[];
}

export interface DiagnosisSections {
  progress: DiagnosisSection;
  blockers: DiagnosisSection;
  risksOrAttention: DiagnosisSection;
  milestoneFocus: DiagnosisSection;
  executionGaps: DiagnosisSection;
  todayFocus: DiagnosisSection;
}

export interface DiagnosisMetrics {
  totalTasks?: number;
  doneTasks?: number;
  inProgressTasks?: number;
  notStartedTasks?: number;
  blockedTasks?: number;
  overdueTasks?: number;
  withoutMilestoneTasks?: number;
  withoutOwnerTasks?: number;
  milestonesTotal?: number;
  processEventCount?: number;
  processTransitionCount?: number;
  delayFindingCount?: number;
  reworkFindingCount?: number;
  bottleneckFindingCount?: number;
}

export interface DiagnosisOverallHealth {
  level: DiagnosisHealthLevel;
  confidence: IsabellaConfidence;
  rationale: string;
  evidenceRefs: string[];
}

/** Structured handoff to the FUTURE engines — never acted on by this engine. */
export interface NextEngineHint {
  engine: "root_cause" | "recommendation";
  reason: string;
  evidenceRefs: string[];
}

export interface IsabellaDailyProcessDiagnosis {
  status: IsabellaContextStatus;
  projectId: string | null;
  organizationId: string | null;
  snapshotAt: string;
  title: string;
  executiveSummary: string;
  overallHealth: DiagnosisOverallHealth;
  sections: DiagnosisSections;
  metrics: DiagnosisMetrics;
  evidenceRefs: string[];
  citations: IsabellaCitation[];
  limitations: string[];
  /** User-safe message for missing_context / unauthorized / unavailable / empty. */
  message?: string;
  nextEngineHints?: NextEngineHint[];
}

export type DiagnosisLanguage = "en" | "es";

/** Health threshold config (conservative defaults). */
export const DIAGNOSIS_BLOCKED_THRESHOLD = 3;
