// ============================================================================
// ProjectOps360° — Isabella Voice Context Bridge (server-only core)
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// THE security boundary between the realtime speech model and Isabella. The
// speech model only ever submits a natural-language question + screen hints;
// this bridge:
//   1. Validates the body (Zod, bounded).
//   2. Builds an AskGuideInput and calls Isabella's EXISTING pipeline via an
//      injected ask function (production: askLivingGuideAction) — which
//      re-stamps user/org/role from the trusted session, enforces RBAC +
//      tenant isolation + project scope, and audits tool use, exactly as the
//      text panel does. NOTHING in that pipeline is modified.
//   3. Converts the markdown answer into bounded speakable text.
// The ask function is injected so this core is unit-testable with no session,
// no DB, and no OpenAI. Read-only: the voice layer exposes NO write path.
// ============================================================================

import type { AskGuideInput, GuideAnswer } from "@/lib/knowledge-os/types";
import type { Locale } from "@/types/database";
import { voiceBridgeRequestSchema } from "./schemas";
import { toSpeechText } from "./speech-text";
import type { VoiceBridgeResult } from "./types";

export interface VoiceBridgeDeps {
  /** Isabella's full existing pipeline (production: askLivingGuideAction). */
  ask: (input: AskGuideInput) => Promise<GuideAnswer>;
}

/**
 * Run one ask_isabella tool call through Isabella. Never throws; every failure
 * maps to a safe, speakable error code.
 */
export async function runVoiceBridge(rawBody: unknown, deps: VoiceBridgeDeps): Promise<VoiceBridgeResult> {
  const parsed = voiceBridgeRequestSchema.safeParse(rawBody);
  if (!parsed.success) return { ok: false, error: "invalid_request" };
  const req = parsed.data;

  // Mirror the text panel's input shape. Identity fields are intentionally NOT
  // set here — askLivingGuideAction re-stamps userId/organizationId/role from
  // the trusted session and ignores any client-claimed identity.
  const input: AskGuideInput = {
    query: req.question,
    intent: req.intentHint ?? "question",
    locale: req.locale as Locale,
    answerLanguage: (req.answerLanguage ?? req.locale) as Locale,
    context: {
      module: req.context.module ?? "",
      screen: req.context.screen,
      projectId: req.context.projectId,
      pathname: req.context.pathname,
      pageTitle: req.context.pageTitle,
      tab: req.context.tab,
      currentEntity: req.context.currentEntity,
    },
  };

  let answer: GuideAnswer;
  try {
    answer = await deps.ask(input);
  } catch {
    // Unauthorized sessions throw inside the pipeline (getOrgContext); any
    // other failure is equally non-recoverable for this turn. Safe code only.
    return { ok: false, error: "unavailable" };
  }

  const speech = toSpeechText(answer.answer);
  if (!speech.text) return { ok: false, error: "unavailable" };

  return {
    ok: true,
    answer: speech.text,
    language: answer.language,
    tier: answer.tier,
    grounded: answer.grounded,
    truncated: speech.truncated,
  };
}
