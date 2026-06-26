// ============================================================================
// ProjectOps360° — Living Guide™ confidence model (pure, testable)
// ============================================================================
// Tier  = origin of the answer (provenance of the cited packages).
// Score = how much to trust it right now (0..1).
//
// Phase 1 inputs: source-tier weight × retrieval strength × corroboration.
// Recency and feedback factors are reserved for Phase 3/4 (no history yet) and
// are intentionally NOT faked here.
// ============================================================================

import type { ConfidenceTier, RetrievedChunk } from "./types";
import { TIER_META } from "./config";

/**
 * The answer's tier is the tier of its PRIMARY (top-ranked) cited source.
 * If nothing was cited / not grounded, it is an AI suggestion.
 */
export function pickAnswerTier(usedChunks: RetrievedChunk[]): ConfidenceTier {
  if (usedChunks.length === 0) return "ai_suggestion";
  // usedChunks arrive already ranked; the first is the primary source.
  return usedChunks[0].confidenceTier;
}

export interface ConfidenceInput {
  grounded: boolean;
  usedChunks: RetrievedChunk[];
  /** True if at least one cited chunk was confirmed by vector similarity. */
  hadVectorConfirmation: boolean;
}

export interface ConfidenceResult {
  tier: ConfidenceTier;
  score: number; // 0..1, rounded to 3 decimals
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Retrieval strength from the best available signal. Vector similarity is the
 * strong signal; without it we cap strength so a purely-lexical match never
 * masquerades as high-confidence.
 */
function retrievalStrength(usedChunks: RetrievedChunk[], hadVector: boolean): number {
  if (usedChunks.length === 0) return 0;
  const topSim = Math.max(...usedChunks.map((c) => c.similarity ?? 0));
  if (hadVector && topSim > 0) {
    // Map cosine 0.6..0.95 → ~0.6..1.0 band.
    return clamp01(0.4 + topSim * 0.65);
  }
  // Lexical-only: usable but capped.
  return 0.7;
}

/** More independent supporting passages → modest corroboration boost. */
function corroboration(count: number): number {
  if (count >= 3) return 1.0;
  if (count === 2) return 0.95;
  if (count === 1) return 0.85;
  return 0;
}

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  if (!input.grounded || input.usedChunks.length === 0) {
    return { tier: "ai_suggestion", score: 0.2 };
  }
  const tier = pickAnswerTier(input.usedChunks);
  const weight = TIER_META[tier]?.weight ?? TIER_META.ai_suggestion.weight;
  const strength = retrievalStrength(input.usedChunks, input.hadVectorConfirmation);
  const corr = corroboration(input.usedChunks.length);

  const score = clamp01(weight * strength * corr);
  return { tier, score: Math.round(score * 1000) / 1000 };
}
