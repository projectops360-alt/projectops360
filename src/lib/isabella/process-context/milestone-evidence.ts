// ============================================================================
// ProjectOps360° — Isabella Process Context · milestone/phase evidence
// ============================================================================
// ISABELLA-PROCESS-CONTEXT-EVIDENCE-RETRIEVAL
//
// Verified milestone summaries + evidence. Milestones support factual data +
// status summaries. A milestone evidence packet NEVER creates a dependency —
// the presentation-only milestone_chain sequence is not a prerequisite (mirrors
// LIVING-GRAPH-MILESTONE-CHAIN-NOT-DEPENDENCY). Pure builders + server retrieval.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { IsabellaCitation, IsabellaEvidencePacket } from "@/lib/isabella/process-intelligence/types";
import { buildIsabellaCitation, buildIsabellaEvidencePacket, safeRef } from "./evidence-builder";
import type { IsabellaMilestoneContext, IsabellaMilestoneSummary, IsabellaProjectScope } from "./types";

export interface MilestoneLite {
  id: string;
  title: string | null;
  status: string | null;
  progress_percent: number | null;
  order_index: number | null;
}

/** Deterministic milestone context from rows + a taskCount map. Pure. */
export function buildMilestoneContext(
  milestones: MilestoneLite[],
  taskCountByMilestone: Record<string, number>,
): IsabellaMilestoneContext {
  const summaries: IsabellaMilestoneSummary[] = milestones
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((m) => ({
      milestoneId: m.id,
      title: m.title ?? "",
      status: m.status,
      progress: m.progress_percent,
      orderIndex: m.order_index,
      taskCount: taskCountByMilestone[m.id] ?? 0,
      citationRef: safeRef("milestone", m.id),
    }));
  return { totalVisibleMilestones: summaries.length, milestones: summaries };
}

/** Verified milestone evidence packets + citations. Pure. No dependency claims. */
export function buildMilestoneEvidence(
  summaries: IsabellaMilestoneSummary[],
  scope: IsabellaProjectScope,
): { packets: IsabellaEvidencePacket[]; citations: IsabellaCitation[] } {
  const es = scope.locale === "es";
  const packets: IsabellaEvidencePacket[] = [];
  const citations: IsabellaCitation[] = [];
  for (const m of summaries) {
    const summary = es
      ? `Estado: ${m.status ?? "—"}; progreso ${m.progress ?? 0}%; ${m.taskCount ?? 0} tareas.`
      : `Status: ${m.status ?? "—"}; progress ${m.progress ?? 0}%; ${m.taskCount ?? 0} tasks.`;
    packets.push(
      buildIsabellaEvidencePacket({
        evidenceId: m.citationRef,
        evidenceType: "milestone",
        sourceKind: "deterministic_project_data",
        sourceId: m.citationRef,
        projectId: scope.projectId,
        organizationId: scope.organizationId,
        title: m.title,
        summary,
        citationLabel: es ? "Hito" : "Milestone",
        citationRef: m.citationRef,
        confidence: "verified",
        allowedClaims: ["factual_project_data", "status_summary"],
        // A milestone alone never establishes a dependency (milestone_chain is
        // presentation-only) or a blocker.
        disallowedClaims: ["dependency_claim", "blocker_claim", "root_cause_claim"],
      }),
    );
    citations.push(
      buildIsabellaCitation({
        sourceLabel: es ? "Hito" : "Milestone",
        entityType: "milestone",
        entityTitle: m.title,
        safeRef: m.citationRef,
        confidence: "verified",
      }),
    );
  }
  return { packets, citations };
}

export type MilestoneEvidenceOutcome =
  | { ok: true; context: IsabellaMilestoneContext; packets: IsabellaEvidencePacket[]; citations: IsabellaCitation[] }
  | { ok: false; reason: "unavailable" };

/** RBAC-scoped milestone evidence. `taskCountByMilestone` is caller-supplied. */
export async function getIsabellaMilestoneEvidence(
  org: OrgContext,
  scope: IsabellaProjectScope,
  taskCountByMilestone: Record<string, number> = {},
): Promise<MilestoneEvidenceOutcome> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("milestones")
    .select("id, title, status, progress_percent, order_index")
    .eq("project_id", scope.projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .order("order_index", { ascending: true });
  if (error) return { ok: false, reason: "unavailable" };
  const context = buildMilestoneContext((data ?? []) as MilestoneLite[], taskCountByMilestone);
  const { packets, citations } = buildMilestoneEvidence(context.milestones, scope);
  return { ok: true, context, packets, citations };
}
