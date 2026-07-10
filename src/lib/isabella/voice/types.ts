// ============================================================================
// ProjectOps360° — Isabella Voice · shared types
// ============================================================================
// ISABELLA-VOICE-REALTIME-BRIDGE
//
// The voice layer is an INTERFACE on top of Isabella — never a replacement.
// The realtime speech model holds the spoken conversation; every data/knowledge
// request goes through the Isabella Voice Context Bridge, which re-stamps the
// trusted identity server-side and calls Isabella's EXISTING pipeline
// (deterministic query engine → tool loop → process intelligence → RAG).
// The speech model never sees SQL, tables, or write paths.
// ============================================================================

import type { Locale } from "@/types/database";

/**
 * Client-supplied screen/context hints, mirroring GuideContext's client fields.
 * COACHING CONTEXT ONLY — never trusted for authorization. Identity (user, org,
 * role) is re-stamped from the session inside the bridge, exactly like the text
 * panel does in askLivingGuideAction.
 */
export interface VoiceClientContext {
  projectId?: string;
  module?: string;
  screen?: string;
  pathname?: string;
  pageTitle?: string;
  tab?: string;
  /** Entity currently open/selected (lookup key only; server re-validates). */
  currentEntity?: { type: string; id: string; title?: string };
}

/** One recent spoken turn, for audit/log purposes (the realtime model already
 *  holds the audio conversation; the bridge is called with SELF-CONTAINED
 *  questions and never re-interprets pronouns). */
export interface VoiceConversationTurn {
  role: "user" | "assistant";
  text: string;
}

/** Body of POST /api/isabella/voice/session. */
export interface VoiceSessionRequest {
  locale: Locale;
  context: VoiceClientContext;
}

/** Response of POST /api/isabella/voice/session. */
export interface VoiceSessionResponse {
  /** Ephemeral OpenAI Realtime client secret — short-lived, single session. */
  clientSecret: string;
  expiresAt: number | null;
  model: string;
  voice: string;
}

/** Body of POST /api/isabella/voice/bridge — the ask_isabella tool call. */
export interface VoiceBridgeRequest {
  question: string;
  intentHint?: "question" | "explain_screen" | "step_by_step" | "best_practices" | "common_mistakes";
  locale: Locale;
  answerLanguage?: Locale;
  context: VoiceClientContext;
  recentConversation?: VoiceConversationTurn[];
}

/** What the bridge returns to the realtime model (spoken verbatim). */
export interface VoiceBridgeSuccess {
  ok: true;
  answer: string;
  language: Locale;
  /** Isabella's confidence tier — the model must disclose non-verified answers. */
  tier: string;
  grounded: boolean;
  truncated: boolean;
}

export interface VoiceBridgeFailure {
  ok: false;
  /** Safe, speakable error code — never a stack trace or internals. */
  error: "invalid_request" | "unauthorized" | "disabled" | "unavailable";
}

export type VoiceBridgeResult = VoiceBridgeSuccess | VoiceBridgeFailure;
