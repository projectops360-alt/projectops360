// ============================================================================
// ProjectOps360° — Isabella Process Context & Evidence Retrieval · types
// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL (Phase 5 · Task 2)
//
// The boundary between ProjectOps360° data and Isabella intelligence. This layer
// PRODUCES sanitized IsabellaEvidencePackets + citations from approved,
// RBAC-scoped selectors. Future engines (diagnosis/root-cause/recommendation)
// reason from these packets — never from raw DB internals. Pure types; the
// server retrieval lives in the sibling modules.
// ============================================================================

import type {
  IsabellaCitation,
  IsabellaEvidencePacket,
} from "@/lib/isabella/process-intelligence/types";

/** The trusted scope every retrieval runs under (resolved server-side). */
export interface IsabellaProjectScope {
  projectId: string;
  organizationId: string;
  userId: string;
  locale?: string;
  timezone?: string;
}

export type IsabellaAccessStatus = "authorized" | "unauthorized" | "missing_context" | "unavailable";

export interface IsabellaAccessResult {
  status: IsabellaAccessStatus;
  scope?: IsabellaProjectScope;
  /** Sanitized reason category — never a raw DB error, never existence disclosure. */
  reason?: string;
  /** A user-safe message in the caller's language. */
  message?: string;
}

export type IsabellaContextInclude =
  | "project"
  | "tasks"
  | "subtasks"
  | "milestones"
  | "workboard"
  | "living_graph_summary"
  | "milestone_flow_summary"
  | "process_mining_summary"
  | "risks"
  | "decisions"
  | "approvals"
  | "blockers"
  | "status_reports"
  | "project_memory";

export interface IsabellaContextFocus {
  taskId?: string;
  milestoneId?: string;
}

export interface IsabellaProjectSummary {
  projectId: string;
  name: string;
  slug?: string | null;
  citationRef: string;
}

export interface IsabellaTaskSummary {
  taskId: string;
  title: string;
  status: string;
  priority?: string | null;
  milestoneId?: string | null;
  milestoneTitle?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  dueDate?: string | null;
  parentTaskId?: string | null;
  isSubtask?: boolean;
  blockedReason?: string | null;
  updatedAt?: string | null;
  citationRef: string;
}

export interface IsabellaTaskContext {
  totalVisibleTasks: number;
  tasks: IsabellaTaskSummary[];
  subtasks: IsabellaTaskSummary[];
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  withoutMilestoneCount: number;
  withoutOwnerCount: number;
  overdueCount?: number;
  blockedCount?: number;
}

export interface IsabellaMilestoneSummary {
  milestoneId: string;
  title: string;
  status?: string | null;
  progress?: number | null;
  orderIndex?: number | null;
  taskCount?: number | null;
  citationRef: string;
}

export interface IsabellaMilestoneContext {
  totalVisibleMilestones: number;
  milestones: IsabellaMilestoneSummary[];
}

export interface IsabellaProcessSignals {
  /** Record-backed active blockers derived from task/subtask blocked flags. */
  blockedCount: number;
  /** Advanced findings (delay/rework/bottleneck) availability. */
  advancedFindingsAvailable: boolean;
  packets: IsabellaEvidencePacket[];
  eventHistoryAvailable?: boolean;
  delayFindingCount?: number;
  reworkFindingCount?: number;
  bottleneckFindingCount?: number;
  transitionCount?: number;
  advancedPackets?: IsabellaEvidencePacket[];
}

export type IsabellaProcessMiningStatus = "ready" | "partial" | "empty" | "unavailable";

/** Sanitized Process Mining aggregate; never raw event rows or payloads. */
export interface IsabellaProcessMiningContext {
  status: IsabellaProcessMiningStatus;
  eventCount: number;
  caseCount: number;
  taskEventCount: number;
  milestoneEventCount: number;
  dependencyEventCount: number;
  transitionCount: number;
  delayFindingCount: number;
  blockerFindingCount: number;
  reworkFindingCount: number;
  bottleneckFindingCount: number;
  dataQualityFlagCount: number;
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
  eventsTruncated: boolean;
  integrityValid: boolean | null;
  integrityIssueCount: number;
  engineVersion?: string | null;
}

export interface IsabellaContextRequest {
  /** Client lookup key ONLY — re-validated server-side against the session org. */
  projectId?: string;
  organizationId?: string;
  userId?: string;
  locale?: string;
  include?: IsabellaContextInclude[];
  focus?: IsabellaContextFocus;
  /** Optional validated plan (Task 1B) to execute deterministically. */
  queryPlanFilters?: unknown;
}

export type IsabellaContextStatus =
  | "ready"
  | "partial"
  | "empty"
  | "unauthorized"
  | "missing_context"
  | "unavailable";

export interface IsabellaProcessContext {
  scope: IsabellaProjectScope | null;
  project: IsabellaProjectSummary | null;
  snapshotAt: string;
  included: IsabellaContextInclude[];
  evidencePackets: IsabellaEvidencePacket[];
  citations: IsabellaCitation[];
  taskContext?: IsabellaTaskContext;
  milestoneContext?: IsabellaMilestoneContext;
  processSignals?: IsabellaProcessSignals;
  processMiningContext?: IsabellaProcessMiningContext;
  limitations: string[];
  status: IsabellaContextStatus;
  /** User-safe message for missing_context / unauthorized / unavailable. */
  message?: string;
}
