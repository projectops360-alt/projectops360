// ============================================================================
// ProjectOps360° — MPF Engine · Transition Builder Types (Phase 3, Task 3)
// ============================================================================
// The output shapes of the Milestone Transition & Flow Segment Builder. These
// EXTEND the Task 1 contract types (MilestoneTransition / MilestoneFlowSegment)
// additively — the base shapes stay valid so the engine projection keeps working
// — and carry the richer, evidence-backed builder detail. Nothing here is
// canonical truth; everything is derived, replay-stable, and evidence-traceable.
// ============================================================================

import type {
  MilestoneTransition,
  MilestoneFlowSegment,
  MilestoneFlowEvidenceConfidence,
  MilestoneProcessFlowEngineVersion,
  MilestoneProcessFlowConfigVersion,
  MilestoneFlowEngineWarning,
} from "./types";
import type { MilestoneFlowSemanticCategory } from "./event-semantics-types";

// ── Builder warning codes (incomplete-evidence signals, never hard errors) ────

export const MPF_BUILDER_WARNING_CODES = [
  "MISSING_MILESTONE_ORDER",
  "MISSING_EVENT_TIMESTAMP",
  "UNASSIGNED_EVENT",
  "AMBIGUOUS_MILESTONE_RELATION",
  "UNKNOWN_EVENT_SEMANTICS",
  "TRANSITION_BOUNDARY_INCOMPLETE",
  "UNSUPPORTED_EVENT_PAYLOAD_SHAPE",
  "SINGLE_MILESTONE_NO_TRANSITION",
] as const;
export type MilestoneFlowBuilderWarningCode = (typeof MPF_BUILDER_WARNING_CODES)[number];

// ── Built flow segment (base MilestoneFlowSegment + builder detail) ───────────

export interface BuiltMilestoneFlowSegment extends MilestoneFlowSegment {
  /** The event that opened this segment. */
  sourceEventId: string | null;
  /** The event that closed this segment (= the boundary event), or null if open. */
  closingEventId: string | null;
  /** Distinct semantic categories of the events inside this segment. */
  semanticCategories: MilestoneFlowSemanticCategory[];
  /** Aggregate confidence of the segment's supporting evidence. */
  confidence: MilestoneFlowEvidenceConfidence;
  /** Machine-readable reason for the segment's classification. */
  notes: string;
  /** True when no closing evidence exists (the segment is still running). */
  isOpenEnded: boolean;
}

// ── Built transition corridor (base MilestoneTransition + builder detail) ─────

export interface BuiltMilestoneTransition extends MilestoneTransition {
  /** The event ids assigned to this corridor, in normalized order. */
  orderedEventIds: string[];
  /** Segments narrowed to the richer built shape. */
  segments: BuiltMilestoneFlowSegment[];
  /** Aggregate confidence across the corridor's evidence. */
  confidence: MilestoneFlowEvidenceConfidence;
  createdByEngineVersion: MilestoneProcessFlowEngineVersion;
  configVersion: MilestoneProcessFlowConfigVersion;
}

// ── Event assignment / unassigned reporting ───────────────────────────────────

export interface MilestoneFlowEventAssignment {
  eventId: string;
  transitionId: string;
  /** Machine-readable reason the event landed in this corridor. */
  reason: string;
}

export interface UnassignedMilestoneFlowEvent {
  eventId: string;
  /** Machine-readable reason the event could not be assigned. */
  reason: MilestoneFlowBuilderWarningCode;
  detail: string;
}

// ── Builder result ────────────────────────────────────────────────────────────

export interface MilestoneTransitionBuildStats {
  transitionCount: number;
  segmentCount: number;
  unassignedEventCount: number;
  unknownSegmentCount: number;
  openTransitionCount: number;
  completedTransitionCount: number;
}

export interface MilestoneTransitionBuildResult {
  transitions: BuiltMilestoneTransition[];
  assignments: MilestoneFlowEventAssignment[];
  unassignedEvents: UnassignedMilestoneFlowEvent[];
  warnings: MilestoneFlowEngineWarning[];
  stats: MilestoneTransitionBuildStats;
}
