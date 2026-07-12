"use server";

// ============================================================================
// ProjectOps360° — Closeout Report actions (UX-010)
// ============================================================================
// On-demand (re)generation of the AI executive summary for a project whose
// "Closing Project" meeting is already completed. The narrative is normally
// generated automatically on meeting completion (rhythm/service.ts); this lets
// the PM regenerate it from the Closeout Report page when needed.
// ============================================================================

import { revalidatePath } from "next/cache";
import { getOrgContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCloseoutReport } from "@/lib/rhythm/closeout";
import { isRiskEventCaptureEnabled } from "@/lib/events/risk-capture-flag";
import {
  emitRiskEventSafe,
  buildRiskClosed,
  buildRiskAssessed,
  buildRiskMaterialized,
  buildRiskReopened,
  type RiskRefInput,
} from "@/lib/events/risk-events";
import { CLOSURE_REASONS, type ClosureReason } from "@/lib/events/registry";
import type { Locale } from "@/types/database";

export type GenerateCloseoutResult =
  | { ok: true }
  | { ok: false; reason: "not_authorized" | "no_meeting" | "failed" };

/**
 * Generate the closeout executive summary + narrative and store it on the latest
 * completed Closing Project meeting. Requires a completed closing meeting (the
 * narrative is grounded in it). PMO/PM/member only — viewers cannot generate.
 */
export async function generateCloseoutNarrativeAction(
  projectId: string,
  locale: Locale,
): Promise<GenerateCloseoutResult> {
  const org = await getOrgContext();
  if (org.role === "viewer") return { ok: false, reason: "not_authorized" };

  const admin = createAdminClient();
  const { data: meeting } = await admin
    .from("meetings")
    .select("id, ai_summary")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .eq("meeting_type", "closing")
    .eq("meeting_status", "completed")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!meeting) return { ok: false, reason: "no_meeting" };

  try {
    const report = await generateCloseoutReport(org, projectId, locale);
    const { error } = await admin
      .from("meetings")
      .update({
        ai_summary: { ...((meeting.ai_summary as Record<string, unknown>) ?? {}), closeout: report },
      })
      .eq("id", meeting.id as string);
    if (error) return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }

  revalidatePath(`/${locale}/projects/${projectId}/closeout`);
  return { ok: true };
}

export type MarkExportedResult = { ok: true } | { ok: false; reason: "not_authorized" | "no_report" | "failed" };

/**
 * Mark the closeout report as exported (PDF downloaded) so the guided workflow
 * (UX-010) can advance past "Review report" to a completed state — otherwise the
 * step rail stalls on step 5 forever (there was no transition into "exported").
 * Stores `exportedAt` alongside the generated narrative on the closing meeting.
 */
export async function markCloseoutExportedAction(
  projectId: string,
  locale: Locale,
): Promise<MarkExportedResult> {
  const org = await getOrgContext();
  if (org.role === "viewer") return { ok: false, reason: "not_authorized" };

  const admin = createAdminClient();
  const { data: meeting } = await admin
    .from("meetings")
    .select("id, ai_summary")
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .eq("meeting_type", "closing")
    .eq("meeting_status", "completed")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!meeting) return { ok: false, reason: "no_report" };

  const summary = (meeting.ai_summary as Record<string, unknown>) ?? {};
  const closeout = (summary.closeout as Record<string, unknown> | undefined) ?? undefined;
  if (!closeout) return { ok: false, reason: "no_report" }; // nothing generated to export

  const { error } = await admin
    .from("meetings")
    .update({ ai_summary: { ...summary, closeout: { ...closeout, exportedAt: new Date().toISOString() } } })
    .eq("id", meeting.id as string);
  if (error) return { ok: false, reason: "failed" };

  revalidatePath(`/${locale}/projects/${projectId}/closeout`);
  return { ok: true };
}

export type ResolveRiskResult =
  | { ok: true }
  | { ok: false; reason: "not_authorized" | "not_found" | "failed" };

/**
 * REG-017 — resolve an open risk directly from the Closeout Report so the
 * "Risks resolved" blocker is actionable where it is surfaced (there is no
 * separate risk-register page to route to). Scope-checked: the risk must belong
 * to this org+project and still be open. PMO/PM/member only — viewers cannot.
 */
export async function resolveRiskAction(
  projectId: string,
  riskId: string,
  locale: Locale,
  /** RISK-EVENT-CAPTURE (P2-T2): canonical closure reason from the flag-gated
   *  affordance. Ignored (and unused) when the pilot flag is off. */
  closureReason?: string,
): Promise<ResolveRiskResult> {
  const org = await getOrgContext();
  if (org.role === "viewer") return { ok: false, reason: "not_authorized" };

  const admin = createAdminClient();
  // Verify the risk is in scope and currently open before mutating it.
  const { data: risk } = await admin
    .from("risks")
    .select("id, status, linked_task_id, linked_milestone_id")
    .eq("id", riskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!risk) return { ok: false, reason: "not_found" };

  const { error } = await admin
    .from("risks")
    .update({ status: "resolved" })
    .eq("id", riskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId);
  if (error) return { ok: false, reason: "failed" };

  // RISK-EVENT-CAPTURE (flag-gated no-op by default). Mapping decision
  // (documented in the P2-T2 PR): the closeout resolution path is a closure
  // acceptance without the RI-05 request→validate workflow, so the event
  // always carries `unvalidated_closure` + `bulk_closure`; the reason comes
  // from the affordance (default: accepted).
  const reason: ClosureReason = (CLOSURE_REASONS as readonly string[]).includes(closureReason ?? "")
    ? (closureReason as ClosureReason)
    : "accepted";
  emitRiskEventSafe(buildRiskClosed({
    risk: riskRef(projectId, org.organizationId, risk),
    actor: { actorType: "human", actorId: org.userId },
    sourceModule: "closeout",
    closureReason: reason,
    viaCloseout: true,
  }));

  revalidatePath(`/${locale}/projects/${projectId}/closeout`);
  return { ok: true };
}

// ── RISK-EVENT-CAPTURE affordance actions (P2-T2 / PD-018 §B.4) ──────────────
// The three (and only three) minimum affordances. Every action: viewer-safe,
// scope-checked, and a hard no-op when the pilot flag is off for the project.

function riskRef(
  projectId: string,
  organizationId: string,
  risk: { id: unknown; linked_task_id?: unknown; linked_milestone_id?: unknown },
): RiskRefInput {
  return {
    riskId: String(risk.id),
    organizationId,
    projectId,
    linkedTaskId: (risk.linked_task_id as string | null) ?? null,
    linkedMilestoneId: (risk.linked_milestone_id as string | null) ?? null,
  };
}

type RiskScopeRow = {
  id: string;
  status: string;
  probability: string;
  impact: string;
  severity: string;
  linked_task_id: string | null;
  linked_milestone_id: string | null;
};

async function loadScopedRisk(
  projectId: string,
  riskId: string,
): Promise<{ org: Awaited<ReturnType<typeof getOrgContext>>; risk: RiskScopeRow } | { error: "not_authorized" | "not_found" | "flag_off" }> {
  const org = await getOrgContext();
  if (org.role === "viewer") return { error: "not_authorized" };
  if (!isRiskEventCaptureEnabled(projectId)) return { error: "flag_off" };
  const admin = createAdminClient();
  const { data: risk } = await admin
    .from("risks")
    .select("id, status, probability, impact, severity, linked_task_id, linked_milestone_id")
    .eq("id", riskId)
    .eq("project_id", projectId)
    .eq("organization_id", org.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!risk) return { error: "not_found" };
  return { org, risk: risk as RiskScopeRow };
}

export type RiskEventActionResult =
  | { ok: true }
  | { ok: false; reason: "not_authorized" | "not_found" | "flag_off" | "invalid" | "failed" };

/**
 * Affordance 2 — explicit "Assess" confirmation. Emits `risk_assessed`
 * (method + confirmed current values + assessed_at — RI-02). It does NOT
 * modify the risk record: a field edit without this confirmation is NOT an
 * assessment (PD-016 §12.3).
 */
export async function assessRiskAction(
  projectId: string,
  riskId: string,
  method: string,
): Promise<RiskEventActionResult> {
  const loaded = await loadScopedRisk(projectId, riskId);
  if ("error" in loaded) return { ok: false, reason: loaded.error };
  if (!method || !method.trim()) return { ok: false, reason: "invalid" };

  emitRiskEventSafe(buildRiskAssessed({
    risk: riskRef(projectId, loaded.org.organizationId, loaded.risk),
    actor: { actorType: "human", actorId: loaded.org.userId },
    sourceModule: "closeout",
    method: method.trim(),
    values: {
      probability: loaded.risk.probability,
      impact: loaded.risk.impact,
      severity: loaded.risk.severity,
    },
    assessedAt: new Date().toISOString(),
  }));
  return { ok: true };
}

/**
 * Affordance 3a — mark materialization. Emits `risk_materialized` with scope +
 * impact note (RI-06 interim exception per PD-018 — no Issue/Blocker entity
 * yet). Does NOT change the risk status (no `materialized` status exists; zero
 * workflow redesign).
 */
export async function materializeRiskAction(
  projectId: string,
  riskId: string,
  scope: string,
  impactNote?: string,
): Promise<RiskEventActionResult> {
  const loaded = await loadScopedRisk(projectId, riskId);
  if ("error" in loaded) return { ok: false, reason: loaded.error };
  if (scope !== "total" && scope !== "partial") return { ok: false, reason: "invalid" };

  emitRiskEventSafe(buildRiskMaterialized({
    risk: riskRef(projectId, loaded.org.organizationId, loaded.risk),
    actor: { actorType: "human", actorId: loaded.org.userId },
    sourceModule: "closeout",
    materializationScope: scope,
    impactNote: impactNote?.trim() || null,
  }));
  return { ok: true };
}

/**
 * Affordance 3b — reopen a resolved/closed risk. Updates the status back to
 * `open` and emits `risk_reopened` with reason_code + the prior closure event
 * when one exists in the log (RI-07; `missing_prior_closure` otherwise).
 */
export async function reopenRiskAction(
  projectId: string,
  riskId: string,
  reasonCode: string,
  locale: Locale,
): Promise<RiskEventActionResult> {
  const loaded = await loadScopedRisk(projectId, riskId);
  if ("error" in loaded) return { ok: false, reason: loaded.error };
  if (!reasonCode || !reasonCode.trim()) return { ok: false, reason: "invalid" };
  if (loaded.risk.status !== "resolved" && loaded.risk.status !== "closed") {
    return { ok: false, reason: "invalid" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("risks")
    .update({ status: "open" })
    .eq("id", riskId)
    .eq("project_id", projectId)
    .eq("organization_id", loaded.org.organizationId);
  if (error) return { ok: false, reason: "failed" };

  // Recorded causality only: reference the latest risk_closed event if any.
  const { data: prior } = await admin
    .from("project_event_log")
    .select("event_id")
    .eq("project_id", projectId)
    .eq("subject_id", riskId)
    .eq("event_type", "risk_closed")
    .order("sequence_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  emitRiskEventSafe(buildRiskReopened({
    risk: riskRef(projectId, loaded.org.organizationId, loaded.risk),
    actor: { actorType: "human", actorId: loaded.org.userId },
    sourceModule: "closeout",
    reasonCode: reasonCode.trim(),
    priorClosureEventId: (prior?.event_id as string | undefined) ?? null,
  }));

  revalidatePath(`/${locale}/projects/${projectId}/closeout`);
  return { ok: true };
}
