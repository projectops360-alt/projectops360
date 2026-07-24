"use server";

// ============================================================================
// PMO Process Intelligence — recommendation feedback capture (CAP-047 · M7)
// ============================================================================
// Governed learning signal: accept / reject / defer + optional reason land
// in the existing audit_logs table (no new schema). Feedback NEVER changes
// behavior by itself — it is reviewed and only reaches Isabella through a
// versioned knowledge package (CAP-047 §8). Gated by the same flag + role
// as the module.
// ============================================================================

import { z } from "zod";
import { createHash } from "node:crypto";
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import { canAccessProcessIntelligence } from "@/lib/pmo-process-intelligence/flags";
import { composeSignature } from "@/lib/pmo-process-intelligence/realtime";

const feedbackSchema = z.object({
  insightId: z.string().min(1).max(200),
  rule: z.string().min(1).max(60),
  decision: z.enum(["accepted", "rejected", "deferred"]),
  reason: z.string().max(1000).optional().default(""),
  title: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
  severity: z.enum(["info", "warning", "critical"]),
  contextScope: z.string().min(1).max(300),
  affectedProjectCount: z.number().int().min(0),
  knowledgeVersion: z.string().min(1).max(100),
  ruleSnapshotVersion: z.string().min(1).max(100),
  evidence: z.object({
    formulas: z.array(z.string().max(500)).max(20),
    projections: z.array(z.string().max(200)).max(20),
    technicalEventTypes: z.array(z.string().max(200)).max(20),
    affectedCaseCount: z.number().int().min(0).nullable(),
    cutoffDate: z.string().max(100).nullable(),
    dataQualityScore: z.number().min(0).max(1),
  }),
});

export async function recordInsightFeedbackAction(input: {
  insightId: string;
  rule: string;
  decision: string;
  reason?: string;
  title: string;
  confidence: number;
  severity: "info" | "warning" | "critical";
  contextScope: string;
  affectedProjectCount: number;
  knowledgeVersion: string;
  ruleSnapshotVersion: string;
  evidence: {
    formulas: string[];
    projections: string[];
    technicalEventTypes: string[];
    affectedCaseCount: number | null;
    cutoffDate: string | null;
    dataQualityScore: number;
  };
}): Promise<{ error?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  if (!canAccessProcessIntelligence(org.role)) return { error: "not_authorized" };
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { error: "validation_error" };
  const evidenceDigest = createHash("sha256")
    .update(JSON.stringify(parsed.data.evidence))
    .digest("hex");

  await logAudit({
    org,
    action: "create",
    entityType: "pmo_pi_recommendation_feedback",
    entityId: parsed.data.insightId,
    metadata: {
      rule: parsed.data.rule,
      decision: parsed.data.decision,
      reason: parsed.data.reason || null,
      original_recommendation: parsed.data.title,
      confidence: parsed.data.confidence,
      severity: parsed.data.severity,
      organization_context: parsed.data.contextScope,
      affected_project_count: parsed.data.affectedProjectCount,
      evidence: parsed.data.evidence,
      evidence_digest: evidenceDigest,
      knowledge_version: parsed.data.knowledgeVersion,
      rule_snapshot_version: parsed.data.ruleSnapshotVersion,
      outcome_status: "pending_review",
      calibration_scope: "organization_isolated",
      rollback_supported: true,
      behavior_changed: false,
      module: "pmo-process-intelligence",
      contract_version: 2,
    },
  });
  return {};
}

// ── Realtime scope signature (M8) ───────────────────────────────────────────
// A cheap RLS-scoped aggregate the client polls; the page only re-renders
// when the signature changes (no render storms). Same flag + role gate.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPmoPiSignatureAction(input: {
  projectId?: string | null;
}): Promise<{ error?: string; signature?: string }> {
  let org;
  try {
    org = await getOrgContext();
  } catch {
    return { error: "not_authenticated" };
  }
  if (!canAccessProcessIntelligence(org.role)) return { error: "not_authorized" };
  const projectId = input.projectId ?? null;
  if (projectId !== null && !UUID_RE.test(projectId)) return { error: "validation_error" };

  const supabase = await createClient();
  let query = supabase
    .from("project_event_log")
    .select("sequence_number", { count: "exact" })
    .eq("organization_id", org.organizationId)
    .order("sequence_number", { ascending: false })
    .limit(1);
  if (projectId) query = query.eq("project_id", projectId);
  const { data, count, error } = await query;
  if (error) return { error: "unexpected" };

  const maxSequence = (data?.[0]?.sequence_number as number | undefined) ?? null;
  return { signature: composeSignature(count ?? 0, maxSequence) };
}
