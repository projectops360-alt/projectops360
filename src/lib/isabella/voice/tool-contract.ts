// ============================================================================
// ProjectOps360° — Isabella Voice · realtime tool contract + session config
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// The realtime speech model gets EXACTLY ONE tool: ask_isabella. No SQL tool,
// no query tool, no write tool — everything routes through the Isabella Voice
// Context Bridge, which re-stamps identity and calls Isabella's existing
// pipeline. This file is pure (no I/O) so the contract is unit-testable.
// ============================================================================

import { buildVoiceInstructions } from "./persona";
import type { VoiceClientContext } from "./types";

/** Default OpenAI Realtime model (overridable via ISABELLA_VOICE_MODEL). */
export const DEFAULT_REALTIME_MODEL = "gpt-realtime";

/** Default voice — warm, natural female (overridable via ISABELLA_VOICE_NAME). */
export const DEFAULT_REALTIME_VOICE = "marin";

/** The ONLY tool exposed to the speech model. */
export const ASK_ISABELLA_TOOL = {
  type: "function" as const,
  name: "ask_isabella",
  description:
    "Ask Isabella — the ProjectOps360° intelligence — anything about the user's projects, tasks, milestones, risks, people, metrics, screens, or how the product works. This is your ONLY source of project data and product knowledge. The question must be self-contained (resolve pronouns yourself). Returns a spoken-ready answer you must relay faithfully.",
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description:
          "The user's request as one self-contained question, in the user's language.",
      },
      intent: {
        type: "string",
        enum: ["question", "explain_screen", "step_by_step", "best_practices", "common_mistakes"],
        description: "Optional hint about the kind of help the user wants.",
      },
    },
    required: ["question"],
    additionalProperties: false,
  },
} as const;

export interface RealtimeSessionOptions {
  locale: "en" | "es";
  context: VoiceClientContext;
  model?: string;
  voice?: string;
}

/**
 * Build the session payload for POST /v1/realtime/client_secrets. Semantic VAD
 * gives natural turn-taking and barge-in (the user can interrupt Isabella);
 * input transcription lets the client show/log what was understood.
 */
export function buildRealtimeSessionConfig(opts: RealtimeSessionOptions): Record<string, unknown> {
  return {
    session: {
      type: "realtime",
      model: opts.model || DEFAULT_REALTIME_MODEL,
      instructions: buildVoiceInstructions(opts.locale, opts.context),
      tools: [ASK_ISABELLA_TOOL],
      tool_choice: "auto",
      audio: {
        input: {
          transcription: { model: "gpt-4o-mini-transcribe" },
          turn_detection: { type: "semantic_vad" },
        },
        output: {
          voice: opts.voice || DEFAULT_REALTIME_VOICE,
        },
      },
    },
  };
}
