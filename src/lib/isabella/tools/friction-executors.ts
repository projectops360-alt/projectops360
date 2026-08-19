// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · Friction Radar executor
// ============================================================================
// ISABELLA-FRICTION-RADAR-READ
//
// Thin wrapper over the approved Friction Radar read service, which is itself a
// projection of the canonical loader the screen uses. No engine, no scoring, no
// recomputation and no writes live here — this file only maps a validated
// request onto that service and hands back a compact, honest result.
//
// The result deliberately keeps `global_score: null` with its reason, and keeps
// every `unknown` / `insufficient_evidence` marker intact: a summary that
// quietly drops them would let the model read silence as good news.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import {
  getFrictionRadarForIsabella,
  type IsabellaFrictionRadarRequest,
} from "@/lib/isabella/friction-radar/service";
import type { IsabellaFrictionRadarFailure } from "@/lib/isabella/friction-radar/types";
import { toolFailure, type ToolResult } from "./serializers";
import type { FrictionRadarArgs } from "./schemas";

/**
 * A disabled pilot and a foreign-organization project must not be
 * distinguishable in a way that leaks whether the project exists. Both map to
 * `unauthorized`; only the human-readable note differs, and it names the
 * capability, never the project.
 */
function mapFailure(reason: IsabellaFrictionRadarFailure): ToolResult {
  if (reason === "no_project") {
    return toolFailure("missing_context", "No project is in context.", "friction_signal");
  }
  if (reason === "not_enabled") {
    return toolFailure(
      "unauthorized",
      "Friction Radar is not available for this project. It is a controlled pilot enabled per project; do not imply signals exist.",
      "friction_signal",
    );
  }
  if (reason === "not_authorized") {
    return toolFailure("unauthorized", "not_authorized", "friction_signal");
  }
  return toolFailure("unavailable", "The Friction Radar read model could not be loaded.", "friction_signal");
}

function toRequest(args: FrictionRadarArgs): IsabellaFrictionRadarRequest {
  return {
    category: args.category,
    severity: args.severity,
    confidence: args.confidence,
    taskId: args.task_id,
    milestoneId: args.milestone_id,
    signalId: args.signal_id,
    search: args.search,
    scope: args.scope,
    limit: args.limit,
  };
}

/** get_friction_radar — evidence-backed friction signals for the current project. */
export async function executeGetFrictionRadar(
  _org: OrgContext,
  scope: IsabellaProjectScope,
  args: FrictionRadarArgs,
): Promise<ToolResult> {
  const res = await getFrictionRadarForIsabella(scope, toRequest(args));
  if (!res.ok) return mapFailure(res.reason);

  const view = res.data;

  // Zero promoted signals is NOT zero friction. Say so here rather than trust
  // the model to remember it, and keep the gaps attached to the same result.
  const limitations = [
    view.global_score_reason,
    ...(view.promoted_signal_count === 0
      ? [
          "No signal met the complete evidence contract in this snapshot. This is not evidence of zero friction - review the evidence gaps.",
        ]
      : []),
    ...(view.evidence_gaps.length > 0
      ? [
          `${view.evidence_gaps.length} detector-level evidence gap(s) reported as unknown or insufficient_evidence. Gaps are excluded from ranking and never mean zero friction.`,
        ]
      : []),
    ...(view.rejected_evidence_count > 0
      ? [`${view.rejected_evidence_count} signal(s) were rejected for an incomplete evidence contract and are not listed.`]
      : []),
    ...view.limitations,
  ];

  return {
    status: view.signals.length === 0 ? "empty" : "success",
    entity: "friction_signal",
    rowCount: view.matched_signal_count,
    truncated: view.truncated,
    appliedFilters: view.applied_filters,
    message: JSON.stringify(view),
    limitations,
  };
}
