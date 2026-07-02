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

    // Task 1: no transition algorithm yet — an authorized, valid input yields a
    // safe EMPTY projection. This is honest "nothing derived", not fake output.
    const includedEventCount = input.events.length;
    const summary = closeRunSummary(
      ctx,
      {
        inputEventCount: input.events.length,
        includedEventCount,
        excludedEventCount: 0,
        transitionCount: 0,
        segmentCount: 0,
        bottleneckCount: 0,
        healthAssessmentCount: 0,
        warnings:
          input.events.length > 0
            ? [
                {
                  code: "ALGORITHM_NOT_IMPLEMENTED",
                  message:
                    "Transition derivation is not implemented in Phase 3 Task 1; events were accepted read-only but not interpreted.",
                },
              ]
            : [],
      },
      this.now,
    );

    const projection: MilestoneFlowProjection = {
      runId: ctx.runId,
      scope: input.scope,
      engineVersion: MPF_ENGINE_VERSION,
      configVersion: MPF_CONFIG_VERSION,
      generatedAt: ctx.startedAt,
      transitions: [],
      metricsByTransition: {},
      healthByTransition: {},
      bottlenecks: [],
      constraintPropagations: [],
      dataQualityFlags: input.events.length === 0 ? ["insufficient_event_density"] : [],
      observability: summary,
    };

    return { projection, transitionSummaries: [], observability: summary };
  }

  // ── Algorithmic methods — not implemented in Task 1 (never faked) ───────────

  buildTransitionModel(_input: MilestoneFlowInputContract): MilestoneTransition[] {
    throw new MpfUnsupportedOperationError("buildTransitionModel");
  }

  buildFlowSegments(_transition: MilestoneTransition, _events: MilestoneFlowEventRef[]): MilestoneFlowSegment[] {
    throw new MpfUnsupportedOperationError("buildFlowSegments");
  }

  calculateFlowMetrics(_transition: MilestoneTransition): MilestoneFlowMetrics {
    throw new MpfUnsupportedOperationError("calculateFlowMetrics");
  }

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
