// ============================================================================
// ProjectOps360° — Isabella Voice · audit trail (server-only, best-effort)
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// Every voice session start and every bridge (ask_isabella) call is recorded
// in ai_runs — same table + shape the tool-use gateway already uses, so no
// migration is needed and the voice trail sits next to Isabella's existing
// audit. COMPACT + non-sensitive only: lengths, codes, tiers — never the raw
// question/answer text, never audio. Best-effort: audit failures never break
// the voice turn.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgContext } from "@/lib/auth";
import type { VoiceClientContext } from "./types";

export const VOICE_AUDIT_MODEL = "isabella-voice";

interface VoiceAuditInput {
  event: "voice_session_created" | "voice_bridge_call";
  context?: VoiceClientContext;
  questionLength?: number;
  recentTurns?: number;
}

interface VoiceAuditOutput {
  ok: boolean;
  error?: string;
  tier?: string;
  grounded?: boolean;
  truncated?: boolean;
  answerLength?: number;
  executionMs?: number;
}

/** Compact, non-sensitive context summary (no free text beyond screen names). */
function summarizeContext(context?: VoiceClientContext): Record<string, unknown> {
  if (!context) return {};
  return {
    projectId: context.projectId ? "provided" : "none",
    module: context.module ?? "",
    screen: context.screen ?? context.pageTitle ?? "",
    entityType: context.currentEntity?.type ?? null,
  };
}

/** Persist one voice audit row. Never throws. */
export async function persistVoiceAudit(
  org: OrgContext,
  input: VoiceAuditInput,
  output: VoiceAuditOutput,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("ai_runs").insert({
      organization_id: org.organizationId,
      user_id: org.userId,
      model: VOICE_AUDIT_MODEL,
      prompt_type: "guide_coaching",
      input_snapshot: {
        voice: true,
        event: input.event,
        context: summarizeContext(input.context),
        questionLength: input.questionLength ?? 0,
        recentTurns: input.recentTurns ?? 0,
      },
      output_snapshot: { voice: output },
      status: output.ok ? "completed" : "failed",
    });
  } catch {
    // Audit is best-effort — never break the voice flow.
  }
}
