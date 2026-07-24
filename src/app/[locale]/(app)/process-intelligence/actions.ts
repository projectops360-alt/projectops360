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
import { getOrgContext } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { canAccessProcessIntelligence } from "@/lib/pmo-process-intelligence/flags";

const feedbackSchema = z.object({
  insightId: z.string().min(1).max(200),
  rule: z.string().min(1).max(60),
  decision: z.enum(["accepted", "rejected", "deferred"]),
  reason: z.string().max(1000).optional().default(""),
});

export async function recordInsightFeedbackAction(input: {
  insightId: string;
  rule: string;
  decision: string;
  reason?: string;
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

  await logAudit({
    org,
    action: "create",
    entityType: "pmo_pi_recommendation_feedback",
    entityId: parsed.data.insightId,
    metadata: {
      rule: parsed.data.rule,
      decision: parsed.data.decision,
      reason: parsed.data.reason || null,
      module: "pmo-process-intelligence",
      contract_version: 1,
    },
  });
  return {};
}
