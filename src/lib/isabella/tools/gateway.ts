// ============================================================================
// ProjectOps360° — Isabella Tool Use Runtime · gateway (server-only)
// ============================================================================
// ISABELLA-TOOL-USE-RUNTIME-GATEWAY
//
// Ties the tool loop into an Isabella GuideAnswer, behind the feature flag. When
// the flag is OFF this is never called. When ON, it resolves RBAC-safe scope,
// runs the loop with the default model, persists COMPACT audit to ai_runs, and
// returns a verified answer — or null to fall through to the deterministic
// report / RAG (never crashes the response). Read-only.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { AskGuideInput, GuideAnswer } from "@/lib/knowledge-os/types";
import type { Locale } from "@/types/database";
import { resolveIsabellaProjectAccess } from "@/lib/isabella/process-context/access";
import { runIsabellaToolLoop } from "./agent-loop";
import { createOpenAiToolModel } from "./openai-model";
import { isIsabellaToolUseEnabled } from "./flag";
import type { ToolUseAudit } from "./audit";

interface ExpertInfo {
  key: string;
  displayName: string;
  title: string;
}

function buildToolUseSystemPrompt(persona: string, language: "en" | "es"): string {
  return `${persona}

# Live project data access
You have READ-ONLY tools to query the user's real project data through approved ProjectOps360° layers.
- When the user asks about their own data (lists, counts, filters, reports, "which tasks", "how many", "overdue", "tasks without milestone", "assigned to", "project summary"), you MUST call an approved tool before answering.
- Never say you lack access/information for a project-data question unless a tool was attempted or the required context/permission is missing.
- Never invent data. If a tool returns no rows, say so clearly. If a result was truncated, say so.
- Briefly mention the filter/scope used. Show lists as concise markdown tables. Distinguish verified project data from assumptions.
- Do NOT expose raw internal payloads, database rows, or ids beyond the safe references the tools return.
- Answer in ${language === "es" ? "Spanish" : "English"}.`;
}

async function persistToolUseAudit(org: OrgContext, question: string, audit: ToolUseAudit): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("ai_runs").insert({
      organization_id: org.organizationId,
      user_id: org.userId,
      model: "isabella-tool-use",
      prompt_type: "guide_coaching",
      input_snapshot: { toolUse: true, questionLength: question.length },
      output_snapshot: { toolUse: audit },
      status: "completed",
    });
  } catch {
    // Audit is best-effort — never break the answer flow.
  }
}

/**
 * Attempt to answer a project-data question via the tool loop. Returns null when
 * the flag is off, scope is unauthorized/missing, no model is configured, or the
 * loop produced no answer — the caller then uses the deterministic report / RAG.
 */
export async function maybeAnswerWithTools(
  org: OrgContext,
  input: AskGuideInput,
  expert: ExpertInfo,
  persona: string,
): Promise<GuideAnswer | null> {
  if (!isIsabellaToolUseEnabled()) return null;

  const language: "en" | "es" = (input.answerLanguage ?? input.locale) === "es" ? "es" : "en";
  const access = await resolveIsabellaProjectAccess({ projectId: input.context.projectId, locale: language });
  if (access.status !== "authorized" || !access.scope) return null;

  const model = createOpenAiToolModel();
  if (!model) return null;

  let loop;
  try {
    loop = await runIsabellaToolLoop({
      org,
      scope: access.scope,
      model,
      system: buildToolUseSystemPrompt(persona, language),
      userQuestion: input.query ?? "",
    });
  } catch {
    return null;
  }

  await persistToolUseAudit(org, input.query ?? "", loop.audit);

  const answer = loop.answer.trim();
  if (!answer) return null; // fall through to deterministic / RAG

  return {
    answerId: null,
    grounded: true,
    answer,
    steps: [],
    followups: [],
    tier: "verified",
    confidenceScore: 1,
    language: language as Locale,
    sources: [],
    expert,
  };
}
