// ============================================================================
// ProjectOps360° — Project Intelligence Engine · Variant Analysis Types
// ============================================================================
// CAP-046 / PD-019 — Feature 1: Execution Variant Analysis. Contracts for the
// pure, deterministic variant-discovery engine over Project Event Graph
// business events. The engine never reads the database: callers feed it
// read-only event refs (PD-018 §A.9 — the mining layer consumes events, never
// current state).
// ============================================================================

/** Read-only projection of a project_event_log row the variant engine consumes. */
export interface VariantEventRef {
  eventId: string;
  /** Registry event type (e.g. TaskCompleted, MilestoneAchieved) — the activity. */
  eventType: string;
  eventCategory: string;
  /** ISO timestamp — business time (occurred_at). */
  occurredAt: string;
  /** PEG lifecycle class; only BUSINESS_EVENT feeds mining (PD-018 §A.3). */
  lifecycleClass: string;
  isCompensatingEvent: boolean;
}

/** Known outcome of a case, resolved by the caller from canonical data. */
export type VariantCaseOutcome = "success" | "failure" | "open";

/**
 * One case (process instance). For the `project_lifecycle` process type the
 * case object is the project — a real domain object, not an artificial case id
 * (PD-018 §0.4); the engine is generic over caseId so other framings reuse it.
 */
export interface VariantCaseInput {
  caseId: string;
  caseLabel?: string;
  events: VariantEventRef[];
  outcome: VariantCaseOutcome;
}

/** A discovered execution variant: one unique activity sequence. */
export interface ExecutionVariant {
  /** Stable content hash of the signature — identical across runs. */
  variantId: string;
  /** The exact ordered activity sequence shared by every case in the variant. */
  signature: string[];
  caseIds: string[];
  caseCount: number;
  /** Share of analyzed cases following this variant (0–100). */
  frequencyPct: number;
  avgDurationMs: number | null;
  medianDurationMs: number | null;
  /**
   * Share of repeated activity executions in the signature (0–1):
   * (events − unique activities) / events. A property of the sequence itself.
   */
  reworkRate: number;
  /** Success share among cases with a known outcome; null when none is known. */
  successRate: number | null;
  /** Cases with a known (success/failure) outcome backing successRate. */
  decidedCaseCount: number;
  isReference: boolean;
}

/** Per-case assignment + comparison against the reference variant. */
export interface VariantAssignment {
  caseId: string;
  caseLabel?: string;
  variantId: string;
  /** Sequence similarity vs the reference variant (0–1); null without reference. */
  fitnessVsReference: number | null;
  /** Activities the reference performs that this case never did. */
  skippedActivities: string[];
  /** Activities this case performed that the reference never does. */
  insertedActivities: string[];
}

/** Honest data-quality disclosure for the analysis (guardrail: no invented data). */
export interface VariantAnalysisQuality {
  totalEventsSeen: number;
  businessEventsUsed: number;
  /** Non-business, compensating, or otherwise excluded events. */
  excludedEvents: number;
  casesWithoutEvents: number;
  casesWithKnownOutcome: number;
}

export interface VariantAnalysis {
  processType: string;
  totalCases: number;
  analyzedCases: number;
  variants: ExecutionVariant[];
  assignments: VariantAssignment[];
  /** Most successful variant (reference); null when no outcome data exists. */
  referenceVariantId: string | null;
  quality: VariantAnalysisQuality;
}
