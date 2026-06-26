"use client";

// ============================================================================
// Living Guide™ — Confidence tier badge
// ============================================================================
// Tier-first trust signal. Always shows WHERE an answer came from, so an AI
// suggestion can never look like Verified knowledge.
// ============================================================================

import { ShieldCheck, Building2, Sparkles, TrendingUp, Bot } from "lucide-react";
import type { ConfidenceTier } from "@/lib/knowledge-os/types";
import { TIER_META, tierLabel } from "@/lib/knowledge-os/config";

const TIER_ICON: Record<ConfidenceTier, typeof ShieldCheck> = {
  verified: ShieldCheck,
  organization_policy: Building2,
  best_practice: Sparkles,
  learned_pattern: TrendingUp,
  ai_suggestion: Bot,
};

export function ConfidenceBadge({
  tier,
  score,
  locale,
}: {
  tier: ConfidenceTier;
  score?: number;
  locale: string;
}) {
  const Icon = TIER_ICON[tier] ?? Bot;
  const tone = TIER_META[tier]?.tone ?? TIER_META.ai_suggestion.tone;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
      title={
        score != null
          ? `${locale === "es" ? "Confianza" : "Confidence"}: ${Math.round(score * 100)}%`
          : undefined
      }
    >
      <Icon className="h-3 w-3" />
      {tierLabel(tier, locale)}
      {score != null && <span className="opacity-70">· {Math.round(score * 100)}%</span>}
    </span>
  );
}
