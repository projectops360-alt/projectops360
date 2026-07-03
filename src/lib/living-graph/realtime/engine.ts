// ============================================================================
// ProjectOps360° — Living Graph Realtime Engine · Foundation Engine (Phase 4, Task 1)
// ============================================================================
// A SAFE foundation, not a runtime: it validates input, enforces deny-by-default
// access, and implements only the pure deterministic pieces (conservative
// recalculation planning, sync decision, fallback ladder). Subscription and
// delta building throw LgreUnsupportedOperationError until later Phase 4 tasks
// implement them — the engine never fabricates liveness or change data.
//
// READ-ONLY consumer by construction: no DB client, no write path, no event
// emission. Guarded by test LGRE-FOUNDATION.
// ============================================================================

import {
  LGRE_ENGINE_VERSION,
  LGRE_DEFAULT_PERFORMANCE_BUDGET,
  SUBSCRIPTION_TOPIC_SET,
  CHANGE_SOURCE_SET,
} from "./constants";
import {
  LgreMissingProjectScopeError,
  LgreMissingOrganizationScopeError,
  LgreUnauthorizedAccessError,
  LgreInvalidSubscriptionTopicError,
  LgreUnsupportedOperationError,
} from "./errors";
import { resolveLivingGraphRealtimeAccess, filterAuthorizedProjectIds } from "./security";
import type {
  LivingGraphRealtimeEngine,
  LivingGraphRecalculationInput,
  LivingGraphRealtimeSecurityContract,
} from "./contracts";
import type {
  LivingGraphChangeNotice,
  LivingGraphSubscriptionRequest,
  LivingGraphRealtimeProjectScope,
  GraphRecalculationPlan,
  LivingGraphDelta,
  LivingGraphSyncDecision,
  LivingGraphRealtimeConnectionState,
  LivingGraphRealtimeFallbackMode,
} from "./types";

// ── Validation helpers ────────────────────────────────────────────────────────

export function validateProjectScope(scope: Partial<LivingGraphRealtimeProjectScope>): void {
  if (!scope.organizationId) throw new LgreMissingOrganizationScopeError();
  if (!scope.projectId) throw new LgreMissingProjectScopeError();
}

export function validateSubscriptionRequest(request: LivingGraphSubscriptionRequest): void {
  validateProjectScope(request.scope);
  if (request.topics.length === 0) {
    throw new LgreInvalidSubscriptionTopicError("A subscription requires at least one topic.");
  }
  for (const topic of request.topics) {
    if (!SUBSCRIPTION_TOPIC_SET.has(topic)) {
      throw new LgreInvalidSubscriptionTopicError(`Unregistered topic: ${topic}`);
    }
  }
}

/** A notice is acceptable only if well-formed AND belongs to the planned scope. */
export function isAcceptableChangeNotice(
  notice: LivingGraphChangeNotice,
  scope: LivingGraphRealtimeProjectScope,
): boolean {
  if (!notice.noticeId || !notice.occurredAt) return false;
  if (!CHANGE_SOURCE_SET.has(notice.source)) return false;
  if (notice.organizationId !== scope.organizationId) return false;
  if (notice.projectId !== scope.projectId) return false;
  return true;
}

// ── Pure sync decision ────────────────────────────────────────────────────────

export function decideLivingGraphSync(
  consumerVersion: number | null,
  delta: LivingGraphDelta,
): LivingGraphSyncDecision {
  if (consumerVersion === delta.snapshotVersion) {
    return { instruction: "noop", reason: "already_at_snapshot_version" };
  }
  if (consumerVersion === delta.basedOnVersion) {
    if (delta.operations.length > LGRE_DEFAULT_PERFORMANCE_BUDGET.maxDeltaOperations) {
      return { instruction: "full_resync", reason: "delta_operation_budget_exceeded" };
    }
    return { instruction: "apply_delta", reason: "base_matches" };
  }
  return { instruction: "full_resync", reason: "base_version_diverged" };
}

// ── Pure fallback ladder ──────────────────────────────────────────────────────

export function decideLivingGraphFallback(
  state: LivingGraphRealtimeConnectionState,
  consecutiveFailures: number,
): LivingGraphRealtimeFallbackMode {
  if (state === "offline_snapshot") return "manual_refresh";
  if (consecutiveFailures >= LGRE_DEFAULT_PERFORMANCE_BUDGET.maxFailuresBeforeManualRefresh) {
    return "manual_refresh";
  }
  if (consecutiveFailures >= LGRE_DEFAULT_PERFORMANCE_BUDGET.maxRealtimeFailuresBeforePolling) {
    return "polling";
  }
  return "realtime";
}

// ── Security contract implementation ──────────────────────────────────────────

export const livingGraphRealtimeSecurityContract: LivingGraphRealtimeSecurityContract = {
  authorize: resolveLivingGraphRealtimeAccess,
  redactUnauthorized: filterAuthorizedProjectIds,
};

// ── Foundation engine factory ─────────────────────────────────────────────────

export interface CreateLivingGraphRealtimeEngineOptions {
  now?: () => Date;
  planIdSeed?: string;
}

export function createLivingGraphRealtimeEngine(
  options: CreateLivingGraphRealtimeEngineOptions = {},
): LivingGraphRealtimeEngine {
  const now = options.now ?? (() => new Date());
  let planCounter = 0;

  function newPlanId(): string {
    planCounter += 1;
    return options.planIdSeed ? `lgre-plan-${options.planIdSeed}-${planCounter}` : `lgre-plan-${planCounter}`;
  }

  function planRecalculation(input: LivingGraphRecalculationInput): GraphRecalculationPlan {
    validateProjectScope(input.scope);
    const decision = resolveLivingGraphRealtimeAccess(input.access, input.scope);
    if (!decision.allowed) throw new LgreUnauthorizedAccessError(decision.reason);

    const accepted: LivingGraphChangeNotice[] = [];
    let rejected = 0;
    for (const notice of input.notices) {
      if (isAcceptableChangeNotice(notice, input.scope)) accepted.push(notice);
      else rejected += 1;
    }

    const warnings: string[] = [];
    if (rejected > 0) warnings.push(`${rejected} change notice(s) rejected (wrong scope or malformed).`);

    if (accepted.length === 0) {
      return {
        planId: newPlanId(),
        scope: input.scope,
        targets: [],
        affectedNodeIds: [],
        affectedEdgeIds: [],
        affectedOverlays: [],
        fullRebuild: false,
        reasons: ["no_change"],
        coalescedNoticeCount: 0,
        rejectedNoticeCount: rejected,
        warnings,
        generatedAt: now().toISOString(),
      };
    }

    // Foundation behavior: selective attribution is a later Phase 4 task. The
    // honest conservative default is a full rebuild — disclosed, never hidden.
    warnings.push("Selective recalculation not implemented; planning a full rebuild.");
    return {
      planId: newPlanId(),
      scope: input.scope,
      targets: ["full_graph"],
      affectedNodeIds: [],
      affectedEdgeIds: [],
      affectedOverlays: [],
      fullRebuild: true,
      reasons: ["event_appended", "selective_recalculation_not_implemented"],
      coalescedNoticeCount: accepted.length,
      rejectedNoticeCount: rejected,
      warnings,
      generatedAt: now().toISOString(),
    };
  }

  return {
    engineVersion: LGRE_ENGINE_VERSION,

    registerSubscription(request) {
      validateSubscriptionRequest(request);
      const decision = resolveLivingGraphRealtimeAccess(request.access, request.scope);
      if (!decision.allowed) throw new LgreUnauthorizedAccessError(decision.reason);
      throw new LgreUnsupportedOperationError("registerSubscription");
    },

    releaseSubscription() {
      throw new LgreUnsupportedOperationError("releaseSubscription");
    },

    planRecalculation,

    buildDelta() {
      throw new LgreUnsupportedOperationError("buildDelta");
    },

    decideSync: decideLivingGraphSync,

    decideFallback: decideLivingGraphFallback,
  };
}
