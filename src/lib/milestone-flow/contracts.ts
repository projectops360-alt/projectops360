// ============================================================================
// ProjectOps360° — Milestone Process Flow Engine · Contracts (Phase 3, Task 1)
// ============================================================================
// The stable contract surface every future MPF task and consumer depends on.
// These interfaces define WHAT the engine accepts and emits; the algorithms
// that fulfill them arrive in later Phase 3 tasks. Consumers (Living Graph, PM/
// PMO dashboards, Isabella) MUST consume these outputs and MUST NOT re-derive
// milestone-flow logic (Constitution §14.3).
// ============================================================================

import type {
  MilestoneFlowProjectScope,
  MilestoneFlowScope,
  MilestoneFlowEventRef,
  MilestoneFlowMilestoneRef,
  MilestoneFlowAccessContext,
  MilestoneFlowAccessDecision,
  MilestoneFlowProjection,
  MilestoneTransition,
  MilestoneFlowSegment,
  MilestoneFlowMetrics,
  MilestoneTransitionHealth,
  MilestoneTransitionHealthSummary,
  MilestoneTransitionHealthStatus,
  MilestoneFlowEvidencePacket,
  MilestoneFlowEvidenceRef,
  IsabellaMilestoneFlowEvidencePacket,
  LivingGraphMilestoneFlowModel,
  MilestoneFlowEngineRunSummary,
  MilestoneProcessFlowEngineVersion,
  MilestoneProcessFlowConfigVersion,
} from "./types";

// ── Engine configuration (versioned; shapes derived output) ───────────────────

export interface MilestoneFlowEngineConfig {
  /** Thresholds/weights are intentionally open for later tasks; version them. */
  configVersion: MilestoneProcessFlowConfigVersion;
  /** Working days / calendar hooks (unused in Task 1). */
  workingDays?: number[];
  timezone?: string | null;
  /** Delay thresholds in ms (decision/approval/etc.) — future tasks. */
  thresholds?: Record<string, number>;
}

// ── 2. Input Contract ─────────────────────────────────────────────────────────

/** Everything the engine needs to build a projection for one project. */
export interface MilestoneFlowInputContract {
  scope: MilestoneFlowProjectScope;
  /** Read-only canonical milestones (owned by the Milestone domain). */
  milestones: MilestoneFlowMilestoneRef[];
  /** Read-only Project Event Graph events, in occurrence order. */
  events: MilestoneFlowEventRef[];
  config: MilestoneFlowEngineConfig;
  access: MilestoneFlowAccessContext;
}

// ── 3. Output Contract ────────────────────────────────────────────────────────

export interface MilestoneFlowOutputContract {
  projection: MilestoneFlowProjection;
  transitionSummaries: MilestoneTransitionHealthSummary[];
  observability: MilestoneFlowEngineRunSummary;
}

// ── 1. Engine Contract ────────────────────────────────────────────────────────

/**
 * The Milestone Process Flow Engine. Task 1 provides a safe stub: it validates
 * input, enforces access, and returns a valid EMPTY projection with health
 * "unknown". Algorithmic methods throw MpfUnsupportedOperationError until later
 * tasks implement them — the engine never fabricates flow intelligence.
 */
export interface MilestoneProcessFlowEngine {
  readonly engineVersion: MilestoneProcessFlowEngineVersion;

  /** Primary entry point — build the full projection for the input. */
  buildMilestoneFlowProjection(input: MilestoneFlowInputContract): MilestoneFlowOutputContract;

  /** Identify milestone transitions (corridors between milestones). */
  buildTransitionModel(input: MilestoneFlowInputContract): MilestoneTransition[];

  /** Segment a transition's activity into flow states. */
  buildFlowSegments(transition: MilestoneTransition, events: MilestoneFlowEventRef[]): MilestoneFlowSegment[];

  /** Compute duration/waiting/blocked/delay/rework metrics for a transition. */
  calculateFlowMetrics(transition: MilestoneTransition): MilestoneFlowMetrics;

  /** Classify evidence-backed transition health. */
  classifyTransitionHealth(transition: MilestoneTransition, metrics: MilestoneFlowMetrics): MilestoneTransitionHealth;

  /** Build the traceable evidence packet for a transition. */
  buildEvidencePacket(transition: MilestoneTransition): MilestoneFlowEvidencePacket;

  /** Build the Living Graph consumer model (no UI logic). */
  buildLivingGraphModel(projection: MilestoneFlowProjection): LivingGraphMilestoneFlowModel;

  /** Build the Isabella evidence packet (fact/inference/prediction/…). */
  buildIsabellaEvidencePacket(
    projection: MilestoneFlowProjection,
    transitionId: string,
  ): IsabellaMilestoneFlowEvidencePacket;
}

// ── 4. Evidence Contract ──────────────────────────────────────────────────────

/**
 * Enforces that a derived conclusion carries evidence. Implementations return
 * false (or downgrade to unknown) when a conclusion lacks a grounding fact —
 * they never publish an unsupported claim (Constitution §15.1).
 */
export interface MilestoneFlowEvidenceContract {
  requireEvidence(refs: readonly MilestoneFlowEvidenceRef[]): boolean;
  packetFor(transitionId: string, refs: MilestoneFlowEvidenceRef[]): MilestoneFlowEvidencePacket;
}

// ── 5. Health Contract ────────────────────────────────────────────────────────

export interface MilestoneFlowHealthContract {
  readonly statuses: readonly MilestoneTransitionHealthStatus[];
  /** The honest default when evidence is insufficient. */
  readonly defaultStatus: MilestoneTransitionHealthStatus;
  summarize(health: MilestoneTransitionHealth): MilestoneTransitionHealthSummary;
}

// ── 6. Security Contract ──────────────────────────────────────────────────────

export interface MilestoneFlowSecurityContract {
  authorize(access: MilestoneFlowAccessContext, scope: MilestoneFlowScope): MilestoneFlowAccessDecision;
  /** Strip any project not in the caller's authorized set from an aggregate. */
  redactUnauthorized(access: MilestoneFlowAccessContext, projectIds: readonly string[]): string[];
}

// ── 7. Observability Contract ─────────────────────────────────────────────────

export interface MilestoneFlowObservabilityContract {
  /** Every run MUST emit a complete run summary. */
  summarizeRun(output: MilestoneFlowOutputContract): MilestoneFlowEngineRunSummary;
}

// ── 8. Living Graph Contract ──────────────────────────────────────────────────

/**
 * The Living Graph consumes MPF outputs; it does not own MPF logic. The model is
 * pure data — nodes, edges, segment view models, evidence drill-down refs — with
 * no layout math and no UI (Constitution §25).
 */
export interface MilestoneFlowLivingGraphContract {
  toLivingGraphModel(projection: MilestoneFlowProjection): LivingGraphMilestoneFlowModel;
}

// ── 9. Isabella Contract ──────────────────────────────────────────────────────

/**
 * Isabella consumes structured evidence packets and MUST separate fact,
 * inference, prediction, recommendation, and uncertainty. She never invents
 * unsupported conclusions (Constitution §24).
 */
export interface MilestoneFlowIsabellaContract {
  toIsabellaEvidencePacket(
    projection: MilestoneFlowProjection,
    transitionId: string,
  ): IsabellaMilestoneFlowEvidencePacket;
}

// ── Consolidated contract registry (documentation-in-code) ────────────────────

export const MPF_CONTRACTS = {
  engine: "MilestoneProcessFlowEngine",
  input: "MilestoneFlowInputContract",
  output: "MilestoneFlowOutputContract",
  evidence: "MilestoneFlowEvidenceContract",
  health: "MilestoneFlowHealthContract",
  security: "MilestoneFlowSecurityContract",
  observability: "MilestoneFlowObservabilityContract",
  livingGraph: "MilestoneFlowLivingGraphContract",
  isabella: "MilestoneFlowIsabellaContract",
} as const;
