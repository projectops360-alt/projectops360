// ============================================================================
// ProjectOps360° — Isabella Process Context · deterministic query executor
// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL
//
// The execution/data/evidence layer for the Task 1B generic query engine. It
// VALIDATES a plan and executes it through the approved RBAC-scoped adapter
// (`runTaskQuery`) — the LLM never filters/sorts — then produces verified task
// evidence packets from the resulting rows. Never throws.
// ============================================================================

import type { OrgContext } from "@/lib/auth";
import { runTaskQuery } from "@/lib/isabella/query-engine/task-adapter";
import { validateQueryPlan } from "@/lib/isabella/query-engine/catalog";
import type { IsabellaProjectQueryPlan } from "@/lib/isabella/query-engine/query-plan";
import type { QueryReportView } from "@/lib/isabella/query-engine/formatter";
import type { IsabellaCitation, IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence/types";
import { buildTaskEvidence, mapTaskRowsToSummaries } from "./task-evidence";
import type { IsabellaProjectScope } from "./types";

export type ProjectQueryExecution =
  | {
      ok: true;
      view: QueryReportView;
      packets: IsabellaEvidencePacket[];
      citations: IsabellaCitation[];
    }
  | {
      ok: false;
      reason: "no_project" | "not_authorized" | "unavailable" | "invalid_plan" | "unsupported_entity";
      errors?: string[];
    };

/**
 * Execute a validated deterministic project-data query plan through the approved
 * adapter and return verified rows + evidence packets. Rejects invalid/forbidden
 * plans BEFORE retrieval. The scope's org/project bound the RBAC-scoped read.
 */
export async function executeDeterministicProjectDataRequest(
  org: OrgContext,
  scope: IsabellaProjectScope,
  plan: IsabellaProjectQueryPlan,
): Promise<ProjectQueryExecution> {
  const validation = validateQueryPlan(plan);
  if (!validation.ok) return { ok: false, reason: "invalid_plan", errors: validation.errors };

  const outcome = await runTaskQuery({ org, projectId: scope.projectId, plan });
  if (!outcome.ok) return { ok: false, reason: outcome.reason, errors: outcome.errors };

  const summaries = mapTaskRowsToSummaries(outcome.view.rows);
  const { packets, citations } = buildTaskEvidence(summaries, scope);
  return { ok: true, view: outcome.view, packets, citations };
}
