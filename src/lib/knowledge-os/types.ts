// ============================================================================
// ProjectOps360° — Living Guide™ shared types
// ============================================================================
// Pure types shared by server (retrieval/generation) and client (widget).
// No server-only imports here so the widget can import it safely.
// ============================================================================

import type { Locale } from "@/types/database";

/** Knowledge Confidence tiers — origin of an answer (see ADD §4). */
export type ConfidenceTier =
  | "verified"
  | "organization_policy"
  | "best_practice"
  | "learned_pattern"
  | "ai_suggestion";

export const CONFIDENCE_TIERS: ConfidenceTier[] = [
  "verified",
  "organization_policy",
  "best_practice",
  "learned_pattern",
  "ai_suggestion",
];

/** The intent the user expressed via a quick action or free text. */
export type GuideIntent =
  | "question"
  | "explain_screen"
  | "step_by_step"
  | "best_practices"
  | "common_mistakes";

/**
 * Context payload the frontend sends with every request. This is what makes the
 * Guide a *coach* and not a help center. Nothing here is trusted for access
 * control — the server re-derives the real org/role from the session.
 */
export interface GuideContext {
  module: string;            // e.g. "people_permissions"
  screen?: string;           // e.g. "team_directory"
  role?: string;             // the user's org role (display/context only)
  userId?: string;
  organizationId?: string;
  companyId?: string;
  permissions?: string[];    // coarse capability hints for phrasing
  action?: string;           // current workflow/action when available
  projectId?: string;
  // ── Screen Intelligence (Phase 1.2) — what the user is actually looking at ──
  pathname?: string;         // resolved client-side route, e.g. "/team"
  pageTitle?: string;        // human screen title, e.g. "People & Team"
  tab?: string;              // active tab/section when applicable
  workflow?: string;         // the primary workflow on this screen
  components?: string[];     // visible UI components (buttons/cards/tables/…)
  // ── Current item context (PD-012) — what entity is open/selected, so Isabella
  // can answer "where did THIS task/decision come from?". Client-supplied as a
  // lookup key only; the server re-validates ownership before resolving anything.
  currentEntity?: { type: string; id: string; title?: string };
  // ── Provenance facts (PD-012) — DETERMINISTIC, server-stamped only. Never set
  // by the client. Holds record-backed source/traceability facts the model must
  // use verbatim (and never invent). Populated in askLivingGuideAction.
  provenanceFacts?: string;
}

/** One retrieved chunk with provenance, after hybrid fusion. */
export interface RetrievedChunk {
  chunkId: string;
  packageId: string;
  versionId: string;
  slug: string;
  language: string;
  title: string;
  body: string;
  confidenceTier: ConfidenceTier;
  /** Vector cosine similarity, when present. */
  similarity?: number;
  /** Lexical ts_rank, when present. */
  lexRank?: number;
  /** Reciprocal-rank-fusion score used for final ordering. */
  fused: number;
}

/** A source citation surfaced to the user. */
export interface AnswerSource {
  packageId: string;
  versionId: string;
  slug: string;
  title: string;
  tier: ConfidenceTier;
}

/** The full answer returned to the widget. */
export interface GuideAnswer {
  answerId: string | null;
  grounded: boolean;
  answer: string;
  steps: string[];
  followups: string[];
  tier: ConfidenceTier;
  confidenceScore: number;   // 0..1
  language: Locale;
  sources: AnswerSource[];
  /** The AI Workforce expert (persona) that produced this answer. */
  expert: { key: string; displayName: string; title: string };
  /** Set when generation failed or no key configured; widget shows a soft fallback. */
  degraded?: boolean;
}

export interface AskGuideInput {
  query: string;
  intent: GuideIntent;
  context: GuideContext;
  /** UI language (chrome/labels). */
  locale: Locale;
  /**
   * Conversation language — the language Isabella answers in. Phase 1.2: this
   * follows the language of the user's latest message, NOT the UI locale. When
   * omitted, the service falls back to {@link locale}.
   */
  answerLanguage?: Locale;
  /** Optional explicit AI Workforce expert; otherwise resolved by module → Isabella. */
  expertKey?: string;
}
