// ============================================================================
// ProjectOps360° — Isabella Process Intelligence Runtime · Guide wiring (server)
// ============================================================================
// ISABELLA-PROCESS-INTELLIGENCE-UI-REALTIME-FINAL-INTEGRATION (Phase 5 · Task 6)
//
// Ties the runtime into an Isabella GuideAnswer behind the process-intelligence
// flag. When the flag is OFF this is never called. When ON, it routes the
// question; if the route is RAG/factual it returns null (caller keeps the
// existing pipeline); otherwise it answers from the accepted engines, persists
// COMPACT audit to ai_runs, and returns a verified GuideAnswer. Read-only.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { AskGuideInput, GuideAnswer } from "@/lib/knowledge-os/types";
import type { Locale } from "@/types/database";
import { isIsabellaProcessIntelligenceEnabled } from "./flag";
import { runIsabellaProcessIntelligence } from "./runtime";
import type { IsabellaProcessIntelligenceAudit, IsabellaSelectedNode } from "./types";

interface ExpertInfo {
  key: string;
  displayName: string;
  title: string;
}

const NODE_TYPES = new Set(["project", "milestone", "task", "subtask", "risk", "decision", "approval"]);

/** Map the client-supplied selected item to a safe node scope (lookup key only). */
function toSelectedNode(input: AskGuideInput): IsabellaSelectedNode | undefined {
  const e = input.context.currentEntity;
  if (!e || !e.id || !NODE_TYPES.has(e.type)) return undefined;
  return { id: e.id, type: e.type as IsabellaSelectedNode["type"], title: e.title };
}

async function persistAudit(org: OrgContext, question: string, audit: IsabellaProcessIntelligenceAudit): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("ai_runs").insert({
      organization_id: org.organizationId,
      user_id: org.userId,
      model: "isabella-process-intelligence",
      prompt_type: "guide_coaching",
      input_snapshot: { processIntelligence: true, questionLength: question.length },
      output_snapshot: { processIntelligence: audit },
      status: "completed",
    });
  } catch {
    // Audit is best-effort — never break the answer flow.
  }
}

/**
 * Attempt to answer via the process-intelligence engines. Returns null when the
 * flag is off or the route is RAG/factual-data (the caller then keeps the
 * deterministic query engine / provenance / RAG path unchanged).
 */
export async function maybeAnswerWithProcessIntelligence(
  org: OrgContext,
  input: AskGuideInput,
  expert: ExpertInfo,
): Promise<GuideAnswer | null> {
  if (!isIsabellaProcessIntelligenceEnabled()) return null;

  const language: "en" | "es" = (input.answerLanguage ?? input.locale) === "es" ? "es" : "en";
  let result;
  try {
    result = await runIsabellaProcessIntelligence({
      question: input.query ?? "",
      locale: language,
      projectId: input.context.projectId,
      organizationId: org.organizationId,
      userId: org.userId,
      screenContext: { module: input.context.module, screen: input.context.screen, pathname: input.context.pathname, tab: input.context.tab },
      selectedNode: toSelectedNode(input),
    });
  } catch {
    return null; // never break the flow — fall through to the existing pipeline
  }

  // RAG / factual-data → let the existing pipeline handle it (unchanged).
  if (result.status === "fallback") return null;

  await persistAudit(org, input.query ?? "", result.audit);

  const answered = result.status === "answered";
  return {
    answerId: null,
    grounded: answered,
    answer: result.answer,
    steps: [],
    followups: [],
    tier: answered ? "verified" : "best_practice",
    confidenceScore: answered ? 1 : 0.5,
    language: language as Locale,
    sources: [],
    expert,
    degraded: !answered && result.status === "unavailable",
  };
}
