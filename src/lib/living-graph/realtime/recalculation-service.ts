// ============================================================================
// ProjectOps360° — LGRE · Incremental Recalculation Service (Phase 4, Task 3)
// ============================================================================
// Orchestrates one recalculation cycle: authorize (deny-by-default) → accept/
// reject notices → attribute the affected subgraph (or fall back to a SAFE
// full rebuild) → invoke the caller's recompute step (the EXISTING
// deterministic engines — never computed here) → deterministic diff with
// evidence refs → observability counts.
//
// Never rebuilds the whole graph when a small affected subgraph suffices;
// never trusts a partial recompute when attribution was not possible. A pure
// consumer: no DB client, no writes, no canonical mutation, no
// project_event_log / process_nodes / process_edges. Guarded by
// LGRE-RECALCULATION.
// ============================================================================

import { isAcceptableChangeNotice, validateProjectScope } from "./engine";
import { resolveLivingGraphRealtimeAccess } from "./security";
import { LgreUnauthorizedAccessError } from "./errors";
import { attributeGraphRecalculation } from "./recalculation-attribution";
import { buildLivingGraphRecalculationResult } from "./recalculation-result";
import type {
  LivingGraphChangeNotice,
  GraphRecalculationPlan,
} from "./types";
import type {
  LivingGraphRecalculationRequest,
  LivingGraphRecalculationOutput,
  LivingGraphRecalculationMode,
  LivingGraphAttributionDetail,
} from "./recalculation-types";

export interface CreateLivingGraphRecalculationServiceOptions {
  now?: () => Date;
  idSeed?: string;
}

export interface LivingGraphRecalculationService {
  recalculate(request: LivingGraphRecalculationRequest): LivingGraphRecalculationOutput;
}

export function createLivingGraphRecalculationService(
  options: CreateLivingGraphRecalculationServiceOptions = {},
): LivingGraphRecalculationService {
  const now = options.now ?? (() => new Date());
  let counter = 0;

  function newId(kind: "plan" | "result"): string {
    counter += 1;
    return options.idSeed
      ? `lgre-${kind}-${options.idSeed}-${counter}`
      : `lgre-${kind}-${counter}`;
  }

  return {
    recalculate(request: LivingGraphRecalculationRequest): LivingGraphRecalculationOutput {
      validateProjectScope(request.scope);
      const decision = resolveLivingGraphRealtimeAccess(request.access, request.scope);
      if (!decision.allowed) throw new LgreUnauthorizedAccessError(decision.reason);

      const accepted: LivingGraphChangeNotice[] = [];
      let rejected = 0;
      for (const notice of request.notices) {
        if (isAcceptableChangeNotice(notice, request.scope)) accepted.push(notice);
        else rejected += 1;
      }

      let plan: GraphRecalculationPlan;
      let attribution: LivingGraphAttributionDetail | null = null;
      let mode: LivingGraphRecalculationMode;

      if (accepted.length === 0) {
        // Explicit, honest no-op — nothing is recomputed for nothing.
        mode = "noop";
        const warnings =
          rejected > 0 ? [`${rejected} change notice(s) rejected (wrong scope or malformed).`] : [];
        plan = {
          planId: newId("plan"),
          scope: request.scope,
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
      } else if (!request.snapshotIndex) {
        // No index to attribute against ⇒ safe full recalculation fallback.
        mode = "full";
        plan = {
          planId: newId("plan"),
          scope: request.scope,
          targets: ["full_graph"],
          affectedNodeIds: [],
          affectedEdgeIds: [],
          affectedOverlays: [],
          fullRebuild: true,
          reasons: ["event_appended", "snapshot_index_unavailable"],
          coalescedNoticeCount: accepted.length,
          rejectedNoticeCount: rejected,
          warnings: [
            "No snapshot index supplied; selective attribution is impossible — planning a safe full rebuild.",
            ...(rejected > 0 ? [`${rejected} change notice(s) rejected (wrong scope or malformed).`] : []),
          ],
          generatedAt: now().toISOString(),
        };
      } else {
        attribution = attributeGraphRecalculation({
          scope: request.scope,
          acceptedNotices: accepted,
          rejectedNoticeCount: rejected,
          index: request.snapshotIndex,
          planId: newId("plan"),
          now,
        });
        plan = attribution.plan;
        mode = plan.fullRebuild ? "full" : "partial";
      }

      // Recompute is the caller's step (existing deterministic engines).
      const recomputed = mode === "noop" ? null : request.recompute(plan);

      const result = buildLivingGraphRecalculationResult({
        resultId: newId("result"),
        scope: request.scope,
        mode,
        plan,
        attribution,
        basedOnSnapshotVersion: request.snapshotIndex?.snapshotVersion ?? null,
        previous: request.previous,
        recomputed,
        acceptedNotices: accepted,
        now,
      });

      return {
        plan,
        result,
        counts: {
          noticesAccepted: accepted.length,
          noticesRejected: rejected,
          attributedNodeCount: plan.affectedNodeIds.length,
          attributedEdgeCount: plan.affectedEdgeIds.length,
          propagatedNodeCount: attribution?.propagatedNodeIds.length ?? 0,
          changedNodeCount: result.nodeChanges.length,
          changedEdgeCount: result.edgeChanges.length,
          usedFullRebuildFallback: plan.fullRebuild,
        },
      };
    },
  };
}
