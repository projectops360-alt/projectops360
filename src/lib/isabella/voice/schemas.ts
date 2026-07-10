// ============================================================================
// ProjectOps360° — Isabella Voice · request schemas (Zod)
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// Runtime validation for EVERY voice endpoint body. The realtime speech model
// (and any client) may only submit a bounded, typed question + context hints —
// never SQL, never arbitrary payloads. Invalid bodies are rejected before any
// execution. Pure schemas; no DB, no side effects.
//
// Tolerance rule: SECURITY-RELEVANT fields (unknown keys, question bound,
// projectId shape) reject hard. AUXILIARY metadata (intent hint, recent
// conversation used only for audit) is truncated/dropped instead — a spoken
// turn must never fail because Isabella's own transcript was long or the
// speech model improvised an intent label (that regression reached prod:
// every bridge call 422'd once the conversation grew).
// ============================================================================

import { z } from "zod";

export const VOICE_QUESTION_MAX = 600;
export const VOICE_TURN_TEXT_MAX = 400;
export const VOICE_RECENT_TURNS_MAX = 12;

const localeSchema = z.enum(["en", "es"]);

const voiceEntitySchema = z
  .object({
    type: z.string().min(1).max(40),
    id: z.string().min(1).max(80),
    title: z.string().max(200).optional(),
  })
  .strict();

export const voiceClientContextSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    module: z.string().max(80).optional(),
    screen: z.string().max(120).optional(),
    pathname: z.string().max(300).optional(),
    pageTitle: z.string().max(160).optional(),
    tab: z.string().max(80).optional(),
    currentEntity: voiceEntitySchema.optional(),
  })
  .strict();

export const voiceSessionRequestSchema = z
  .object({
    locale: localeSchema,
    context: voiceClientContextSchema,
  })
  .strict();

// Audit-only turns: long transcripts are TRUNCATED, never rejected.
const voiceTurnSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    text: z.string().transform((s) => s.slice(0, VOICE_TURN_TEXT_MAX)),
  })
  .strict();

export const voiceBridgeRequestSchema = z
  .object({
    question: z.string().min(1).max(VOICE_QUESTION_MAX),
    // Hint only — an improvised label degrades to undefined ("question").
    intentHint: z
      .enum(["question", "explain_screen", "step_by_step", "best_practices", "common_mistakes"])
      .optional()
      .catch(undefined),
    locale: localeSchema,
    answerLanguage: localeSchema.optional(),
    context: voiceClientContextSchema,
    // Audit only — a malformed/oversized transcript list degrades to undefined.
    recentConversation: z
      .array(voiceTurnSchema)
      .max(VOICE_RECENT_TURNS_MAX)
      .optional()
      .catch(undefined),
  })
  .strict();

export type VoiceSessionRequestParsed = z.infer<typeof voiceSessionRequestSchema>;
export type VoiceBridgeRequestParsed = z.infer<typeof voiceBridgeRequestSchema>;
