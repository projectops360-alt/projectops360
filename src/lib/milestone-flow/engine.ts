// ============================================================================
// ProjectOps360° — Milestone Process Flow Engine · Stub Engine (Phase 3, Task 1)
// ============================================================================
// A SAFE, honest foundation. It:
//   • validates required input structure,
//   • enforces the security contract (deny-by-default),
//   • returns a VALID EMPTY projection when there is nothing to derive,
//   • stamps engine + config version and a full observability summary,
//   • marks unimplemented algorithms as not-implemented (never faked).
//
// It does NOT implement transition/segment/metrics/health/bottleneck/rework
// algorithms — those are later Phase 3 tasks. When evidence is insufficient,
// health is "unknown" and confidence is "unknown" (Constitution §32, §37 #12).
//
// READ-ONLY: consumes MilestoneFlowEventRef/MilestoneFlowMilestoneRef by value.
// Never writes project_event_log, process_nodes, or process_edges.
// ============================================================================

import {
  MPF_ENGINE_VERSION,
  MPF_CONFIG_VERSION,
  MPF_DEFAULT_CONFIDENCE,
  MPF_HEALTH_STATUSES,
  MPF_DEFAULT_HEALTH_STATUS,
} from "./constants";
import {
  MpfMissingProjectScopeError,
  MpfMissingOrganizationScopeError,
  MpfUnauthorizedAccessError,
  MpfInvalidEventInputError,
  MpfInvalidMilestoneInputError,
  MpfUnsupportedOperationError,
} from "./errors";
import {
  resolveMilestoneFlowAccess,
  filterAuthorizedProjectIds,
} from "./security";
import { openRunContext, closeRunSummary } from "./observability";
import { aggregateConfidence } from "./evidence";
import { buildMilestoneTransitions } from "./transition-builder";
import { buildFlowSegmentsForTransition } from "./flow-segment-builder";
import { calculateMilestoneFlowMetrics, calculateMilestoneTransitionMetrics } from "./metrics-calculator";
import { detectMilestoneFlowDelays } from "./delay-detector";
import { detectMilestoneFlowAdvancedFindings } from "./advanced-detection";
import type {
  MilestoneProcessFlowEngine,
  MilestoneFlowInputContract,
  MilestoneFlowOutputContract,
  MilestoneFlowEvidenceContract,
  MilestoneFlowHealthContract,
  MilestoneFlowSecurityContract,
  MilestoneFlowObservabilityContract,
  MilestoneFlowLivingGraphContract,
  MilestoneFlowIsabellaContract,
} from "./contracts";
import type {
  MilestoneFlowProjection,
  MilestoneTransition,
  MilestoneFlowSegment,
  MilestoneFlowMetrics,
  MilestoneTransitionHealth,
  MilestoneTransitionHealthSummary,
  MilestoneFlowEvidencePacket,
  MilestoneFlowEvidenceRef,
  IsabellaMilestoneFlowEvidencePacket,
  LivingGraphMilestoneFlowModel,
  MilestoneFlowEventRef,
} from "./types";

// ── Input validation (pure) ───────────────────────────────────────────────────

/** Throws a typed MpfError when the input contract is structurally invalid. */
export function validateInputContract(input: MilestoneFlowInputContract): void {
  if (!input.scope || !input.scope.organizationId) {
    throw new MpfMissingOrganizationScopeError();
  }
  if (!input.scope.projectId) {
    throw new MpfMissingProjectScopeError();
  }
  if (!Array.isArray(input.events)) {
    throw new MpfInvalidEventInputError("events must be an array (read-only event refs).");
  }
  for (const e of input.events) {
    if (!e || typeof e.eventId !== "string" || typeof e.occurredAt !== "string") {
      throw new MpfInvalidEventInputError("each event ref requires eventId and occurredAt.");
    }
  }
  if (!Array.isArray(input.milestones)) {
    throw new MpfInvalidMilestoneInputError("milestones must be an array (read-only milestone refs).");
  }
  for (const m of input.milestones) {
    if (!m || typeof m.milestoneId !== "string") {
      throw new MpfInvalidMilestoneInputError("each milestone ref requires milestoneId.");
    }
  }
}

// ── The engine ────────────────────────────────────────────────────────────────

export class MilestoneProcessFlowEngineStub implements MilestoneProcessFlowEngine {
  readonly engineVersion = MPF_ENGINE_VERSION;

  private readonly now: () => Date;
  private readonly runIdSeed?: string;

  constructor(opts?: { now?: () => Date; runIdSeed?: string }) {
    this.now = opts?.now ?? (() => new Date());
    this.runIdSeed = opts?.runIdSeed;
  }

  buildMilestoneFlowProjection(input: MilestoneFlowInputContract): MilestoneFlowOutputContract {
    validateInputContract(input);

    // Enforce access — deny-by-default. Cross-tenant / unauthorized → throw.
    const decision = resolveMilestoneFlowAccess(input.access, input.scope);
    if (!decision.allowed) {
      throw new MpfUnauthorizedAccessError(decision.reason, {
        projectId: input.scope.projectId,
        organizationId: input.scope.organizationId,
      });
    }

    const ctx = openRunContext({
      scope: input.scope,
      runId: this.runIdSeed ? `mpf_${this.runIdSeed}` : undefined,
      now: this.now,
    });

    // Task 3: build transition corridors + flow segments (structure only — no
    // metrics, no final health). Empty input still yields a safe empty projection.
    const build = buildMilestoneTransitions({
      scope: input.scope,
      milestones: input.milestones,
      events: input.events,
      config: input.config,
    });

    const dataQualityFlags: MilestoneFlowProjection["dataQualityFlags"] =
      input.events.length === 0 ? ["insufficient_event_density"] : [];

    // Task 4: metrics over the built transitions. No analysisAsOf is passed here,
    // so OPEN durations stay null (unknown) and the projection is replay-stable
    // (never reads the wall clock). Callers wanting elapsed metrics pass an
    // explicit analysisAsOf to calculateMilestoneFlowMetrics.
    const metrics = calculateMilestoneFlowMetrics({
      scope: input.scope,
      milestones: input.milestones,
      transitions: build.transitions,
    });

    // Task 5: detect blockers / waiting / decision & approval delays from the
    // built transitions + metrics. Detection reads metric durations (never
    // recomputes, never reads the wall clock) — severity is detection severity,
    // NOT health, and no health/bottleneck classification is produced.
    const detection = detectMilestoneFlowDelays({
      scope: input.scope,
      transitions: build.transitions,
      metricsByTransition: metrics.metricsByTransition,
    });

    // Task 6: advanced detection (rework, bottleneck candidates, constraint
    // propagation) over the built transitions + metrics + Task 5 findings.
    // Read-only, no metric recompute, no Date.now, no health/bottleneck-as-health.
    const advanced = detectMilestoneFlowAdvancedFindings({
      scope: input.scope,
      transitions: build.transitions,
      metricsByTransition: metrics.metricsByTransition,
      findingsByTransition: detection.findingsByTransition,
    });

    const summary = closeRunSummary(
      ctx,
      {
        inputEventCount: input.events.length,
        includedEventCount: input.events.length,
        excludedEventCount: 0,
        transitionCount: build.stats.transitionCount,
        segmentCount: build.stats.segmentCount,
        bottleneckCount: 0,
        healthAssessmentCount: 0, // final health is a later task — kept unknown
        unassignedEventCount: build.stats.unassignedEventCount,
        unknownSegmentCount: build.stats.unknownSegmentCount,
        openTransitionCount: build.stats.openTransitionCount,
        completedTransitionCount: build.stats.completedTransitionCount,
        metricsCalculatedCount: metrics.stats.metricsCalculatedCount,
        metricsUnknownCount: metrics.stats.metricsUnknownCount,
        openSegmentDurationCount: metrics.stats.openSegmentDurationCount,
        invalidDurationCount: metrics.stats.invalidDurationCount,
        totalKnownSegmentTimeMs: metrics.stats.totalKnownSegmentTimeMs,
        delayFindingCount: detection.stats.delayFindingCount,
        blockerFindingCount: detection.stats.blockerFindingCount,
        waitingFindingCount: detection.stats.waitingFindingCount,
        decisionDelayFindingCount: detection.stats.decisionDelayFindingCount,
        approvalDelayFindingCount: detection.stats.approvalDelayFindingCount,
        openFindingCount: detection.stats.openFindingCount,
        resolvedFindingCount: detection.stats.resolvedFindingCount,
        unknownFindingCount: detection.stats.unknownFindingCount,
        highSeverityFindingCount: detection.stats.highSeverityFindingCount,
        reworkFindingCount: advanced.stats.reworkFindingCount,
        bottleneckFindingCount: advanced.stats.bottleneckFindingCount,
        constraintPropagationFindingCount: advanced.stats.constraintPropagationFindingCount,
        structuralBottleneckCandidateCount: advanced.stats.structuralBottleneckCandidateCount,
        possiblePropagationCount: advanced.stats.possiblePropagationCount,
        openAdvancedFindingCount: advanced.stats.openAdvancedFindingCount,
        resolvedAdvancedFindingCount: advanced.stats.resolvedAdvancedFindingCount,
        unknownAdvancedFindingCount: advanced.stats.unknownAdvancedFindingCount,
        highSeverityAdvancedFindingCount: advanced.stats.highSeverityAdvancedFindingCount,
        warnings: [...build.warnings, ...metrics.warnings, ...detection.warnings, ...advanced.warnings],
      },
      this.now,
    );

    const projection: MilestoneFlowProjection = {
      runId: ctx.runId,
      scope: input.scope,
      engineVersion: MPF_ENGINE_VERSION,
      configVersion: MPF_CONFIG_VERSION,
      generatedAt: ctx.startedAt,
      transitions: build.transitions,
      metricsByTransition: metrics.metricsByTransition,
      // Final health is deferred to a later Phase 3 task (kept empty / unknown).
      healthByTransition: {},
      bottlenecks: [],
      constraintPropagations: [],
      dataQualityFlags,
      findingsByTransition: detection.findingsByTransition,
      reworkFindingsByTransition: advanced.reworkFindingsByTransition,
      bottleneckFindingsByTransition: advanced.bottleneckFindingsByTransition,
      constraintPropagationFindings: advanced.constraintPropagationFindings,
      observability: summary,
    };

    return { projection, transitionSummaries: [], observability: summary };
  }

  // ── Transition + segment building (Task 3) ──────────────────────────────────

  buildTransitionModel(input: MilestoneFlowInputContract): MilestoneTransition[] {
    validateInputContract(input);
    return buildMilestoneTransitions({
      scope: input.scope,
      milestones: input.milestones,
      events: input.events,
      config: input.config,
    }).transitions;
  }

  buildFlowSegments(transition: MilestoneTransition, events: MilestoneFlowEventRef[]): MilestoneFlowSegment[] {
    return buildFlowSegmentsForTransition(transition.transitionId, events, {
      closesAt: transition.completedAt,
    });
  }

  // ── Metrics (Task 4) ────────────────────────────────────────────────────────

  calculateFlowMetrics(transition: MilestoneTransition): MilestoneFlowMetrics {
    // Delegates to the calculator. No milestone refs here (single-transition
    // contract) → planned/forecast durations are null; actual + segment metrics
    // come from the transition itself. No analysisAsOf → open durations unknown.
    return calculateMilestoneTransitionMetrics(transition);
  }

  // ── Algorithmic methods — not implemented yet (never faked) ─────────────────

  classifyTransitionHealth(
    _transition: MilestoneTransition,
    _metrics: MilestoneFlowMetrics,
  ): MilestoneTransitionHealth {
    throw new MpfUnsupportedOperationError("classifyTransitionHealth");
  }

  buildEvidencePacket(transition: MilestoneTransition): MilestoneFlowEvidencePacket {
    // Safe: an empty/insufficient transition yields an honest unknown packet.
    return {
      transitionId: transition.transitionId,
      refs: [],
      confidence: MPF_DEFAULT_CONFIDENCE,
      dataQualityFlags: ["insufficient_event_density"],
      uncertaintyNotes: ["No evidence has been derived for this transition in Phase 3 Task 1."],
    };
  }

  buildLivingGraphModel(projection: MilestoneFlowProjection): LivingGraphMilestoneFlowModel {
    // Consumer model only — pure projection, no UI, no layout.
    return {
      scope: projection.scope,
      nodes: [],
      edges: [],
      engineVersion: projection.engineVersion,
      configVersion: projection.configVersion,
    };
  }

  buildIsabellaEvidencePacket(
    projection: MilestoneFlowProjection,
    transitionId: string,
  ): IsabellaMilestoneFlowEvidencePacket {
    // Honest empty frame — every slot present, none fabricated.
    return {
      scope: projection.scope,
      transitionId,
      frame: { fact: [], inference: [], prediction: [], recommendation: [], uncertainty: [] },
      recommendedActions: [],
      confidence: MPF_DEFAULT_CONFIDENCE,
      uncertaintyNotes: ["Insufficient evidence — no milestone-flow conclusions in Phase 3 Task 1."],
      engineVersion: projection.engineVersion,
      configVersion: projection.configVersion,
    };
  }
}

/** Default engine instance factory. */
export function createMilestoneProcessFlowEngine(opts?: {
  now?: () => Date;
  runIdSeed?: string;
}): MilestoneProcessFlowEngine {
  return new MilestoneProcessFlowEngineStub(opts);
}

// ── Contract implementations (thin, foundation-safe) ──────────────────────────

export const milestoneFlowEvidenceContract: MilestoneFlowEvidenceContract = {
  requireEvidence(refs) {
    return refs.some((r) => r.kind === "fact" && (r.eventId != null || r.metricRef != null));
  },
  packetFor(transitionId, refs): MilestoneFlowEvidencePacket {
    return {
      transitionId,
      refs,
      confidence: aggregateConfidence(refs),
      dataQualityFlags: refs.length === 0 ? ["insufficient_event_density"] : [],
      uncertaintyNotes: refs.filter((r) => r.kind === "uncertainty" && r.note).map((r) => r.note as string),
    };
  },
};

export const milestoneFlowHealthContract: MilestoneFlowHealthContract = {
  statuses: MPF_HEALTH_STATUSES,
  defaultStatus: MPF_DEFAULT_HEALTH_STATUS,
  summarize(health): MilestoneTransitionHealthSummary {
    const keyReason = health.reasons[0]?.detail ?? null;
    const currentBlockers: MilestoneFlowEvidenceRef[] = health.reasons.flatMap((r) => r.evidence);
    return {
      transitionId: health.transitionId,
      status: health.status,
      score: health.score,
      keyReason,
      topFrictionSources: [],
      currentBlockers,
      downstreamImpact: null,
      recommendedActionCategory: null,
      confidence: health.confidence,
      uncertaintyNotes: [],
    };
  },
};

export const milestoneFlowSecurityContract: MilestoneFlowSecurityContract = {
  authorize: resolveMilestoneFlowAccess,
  redactUnauthorized: filterAuthorizedProjectIds,
};

export const milestoneFlowObservabilityContract: MilestoneFlowObservabilityContract = {
  summarizeRun(output) {
    return output.observability;
  },
};

export const milestoneFlowLivingGraphContract: MilestoneFlowLivingGraphContract = {
  toLivingGraphModel(projection): LivingGraphMilestoneFlowModel {
    return {
      scope: projection.scope,
      nodes: [],
      edges: [],
      engineVersion: projection.engineVersion,
      configVersion: projection.configVersion,
    };
  },
};

export const milestoneFlowIsabellaContract: MilestoneFlowIsabellaContract = {
  toIsabellaEvidencePacket(projection, transitionId): IsabellaMilestoneFlowEvidencePacket {
    return {
      scope: projection.scope,
      transitionId,
      frame: { fact: [], inference: [], prediction: [], recommendation: [], uncertainty: [] },
      recommendedActions: [],
      confidence: MPF_DEFAULT_CONFIDENCE,
      uncertaintyNotes: [],
      engineVersion: projection.engineVersion,
      configVersion: projection.configVersion,
    };
  },
};
