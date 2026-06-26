"use server";

// ============================================================================
// Living Guide™ — server actions (API layer between widget and services)
// ============================================================================
// Access control: the real org + role come from the session via getOrgContext.
// The client-supplied context payload is for COACHING CONTEXT ONLY and is never
// trusted for authorization. Knowledge served is global product knowledge plus
// the caller's own org overlays — never another tenant's data.
// ============================================================================

import { getOrgContext } from "@/lib/auth";
import { askKnowledgeOs, recordGuideFeedback } from "@/lib/knowledge-os/service";
import { indexPendingKnowledge } from "@/lib/knowledge-os/indexer";
import type { AskGuideInput, GuideAnswer } from "@/lib/knowledge-os/types";

/** Ask the Living Guide. Returns a fully-attributed answer. */
export async function askLivingGuideAction(input: AskGuideInput): Promise<GuideAnswer> {
  const org = await getOrgContext();
  // Re-stamp identity from the trusted session (ignore any client-claimed ids).
  const safeInput: AskGuideInput = {
    ...input,
    context: {
      ...input.context,
      userId: org.userId,
      organizationId: org.organizationId,
      role: org.orgRole,
    },
  };
  return askKnowledgeOs(org, safeInput);
}

/** Record 👍/👎 feedback against a previously generated answer. */
export async function submitGuideFeedbackAction(
  answerId: string,
  helpful: boolean,
): Promise<{ ok: boolean }> {
  const org = await getOrgContext();
  await recordGuideFeedback(org, answerId, helpful);
  return { ok: true };
}

/**
 * Generate embeddings for pending knowledge chunks. PMO-level only.
 * Lets an admin "turn on" semantic search after seeding without a deploy.
 */
export async function indexLivingGuideAction(): Promise<{
  ok: boolean;
  processed?: number;
  embedded?: number;
  failed?: number;
  message?: string;
}> {
  const org = await getOrgContext();
  if (!org.isPmoLevel) {
    return { ok: false, message: "Not authorized" };
  }
  const res = await indexPendingKnowledge();
  return {
    ok: !res.error,
    processed: res.processed,
    embedded: res.embedded,
    failed: res.failed,
    message: res.skipped ? res.error : undefined,
  };
}
