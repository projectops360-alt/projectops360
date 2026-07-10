// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · executive-brief executors
// ============================================================================
// REG-023 / ISABELLA-EXECUTIVE-BRIEF
//
// Composite, decision-oriented tools for the LLM loop — thin wrappers over the
// SAME approved executive-brief service the deterministic gateway uses (one
// brain: text, voice, and tool loop all consume identical layers). Read-only;
// results are compact + display-safe (no raw ids, no payloads). Never throws.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import type { IsabellaProjectScope } from "@/lib/isabella/process-context/types";
import { getExecutiveBriefData } from "@/lib/isabella/executive-brief/service";
import { collectRiskSignals, riskExposure } from "@/lib/isabella/executive-brief/formatter";
import type { Locale } from "@/types/database";
import { toolFailure, type ToolResult } from "./serializers";
import type { ExecutiveBriefArgs } from "./schemas";

function lang(scope: IsabellaProjectScope): Locale {
  return (scope.locale === "es" ? "es" : "en") as Locale;
}

function mapReason(reason: "no_project" | "not_authorized" | "unavailable"): ToolResult["status"] {
  return reason === "unavailable" ? "unavailable" : "unauthorized";
}

/** get_project_executive_brief — consolidated status/progress/attention view. */
export async function executeGetProjectExecutiveBrief(
  org: OrgContext,
  scope: IsabellaProjectScope,
  _args: ExecutiveBriefArgs,
): Promise<ToolResult> {
  const res = await getExecutiveBriefData(org, scope.projectId, lang(scope));
  if (!res.ok) return toolFailure(mapReason(res.reason), res.reason, "project");

  const b = res.data.briefing;
  const summary = {
    projectName: b.projectName,
    healthBand: b.healthBand,
    percentComplete: b.overview.percentComplete,
    totalTasks: b.overview.totalTasks,
    completedTasks: b.overview.completedTasks,
    inProgressTasks: b.overview.inProgressTasks,
    overdueTasks: b.overview.overdueTasks,
    activeBlockers: b.execution.activeBlockers,
    atRiskMilestones: b.execution.atRiskMilestones,
    unassignedActive: b.capacity.evaluable ? b.capacity.unassignedActive : null,
    nextMilestone: b.overview.nextMilestone,
    openRisks: b.risks.available ? b.risks.open : null,
    highRisks: b.risks.available ? b.risks.high : null,
    recentDecisions: b.memory.available ? b.memory.recentDecisions.slice(0, 3).map((d) => d.title) : null,
    dataGaps: b.dataGaps,
  };

  return {
    status: b.overview.totalTasks === 0 && b.overview.milestonesTotal === 0 ? "empty" : "success",
    entity: "project",
    rowCount: b.overview.totalTasks,
    truncated: false,
    message: JSON.stringify(summary),
    limitations: b.dataGaps.length > 0 ? b.dataGaps : undefined,
  };
}

/** get_project_risk_outlook — registered risks vs detected operational signals. */
export async function executeGetProjectRiskOutlook(
  org: OrgContext,
  scope: IsabellaProjectScope,
  _args: ExecutiveBriefArgs,
): Promise<ToolResult> {
  const res = await getExecutiveBriefData(org, scope.projectId, lang(scope));
  if (!res.ok) return toolFailure(mapReason(res.reason), res.reason, "risk");

  const b = res.data.briefing;
  const signals = collectRiskSignals(b);
  const registered = res.data.registeredRisks;
  const outlook = {
    exposure: riskExposure(b, registered?.length ?? 0, signals),
    // Registered records vs detected signals vs gaps — NEVER merged, so the
    // model can (and must) present them separately.
    registeredRisks: registered
      ? registered.map((r) => ({
          title: r.title,
          category: r.category,
          severity: r.severity,
          probability: r.probability,
          impact: r.impact,
          status: r.status,
        }))
      : null,
    registeredRisksAvailable: registered != null,
    detectedRiskSignals: signals,
    dataGaps: b.dataGaps,
  };

  return {
    status: (registered?.length ?? 0) === 0 && signals.length === 0 ? "empty" : "success",
    entity: "risk",
    rowCount: registered?.length ?? 0,
    truncated: false,
    message: JSON.stringify(outlook),
    limitations: registered == null ? ["risk register unreadable"] : undefined,
  };
}
