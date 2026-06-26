"use client";

// ============================================================================
// Living Guide™ / Isabella — floating launcher
// ============================================================================
// The launcher is the entry point to the active AI Workforce expert (Isabella
// by default). Phase 1.2: activating Isabella opens the IMMERSIVE experience
// (dimmed/blurred workspace + a present, animated advisor on a dedicated stage)
// instead of a plain slide-over.
//
// Decoupling preserved: the launcher knows nothing about retrieval/confidence.
// The classic slide-over panel (LivingGuidePanel) remains exported and can be
// used by passing `immersive={false}` — no capability was removed, only a more
// premium default presentation was added.
// ============================================================================

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Locale } from "@/types/database";
import type { GuideContext } from "@/lib/knowledge-os/types";
import { resolveExpert } from "@/lib/knowledge-os/experts";
import { IsabellaExperience } from "@/components/isabella";
import { LivingGuidePanel } from "./living-guide-panel";
import { LivingGuideAvatar } from "./living-guide-avatar";

export function LivingGuideWidget({
  locale,
  context,
  immersive = true,
}: {
  locale: Locale;
  context: GuideContext;
  /** When true (default) the launcher opens the immersive Isabella Experience. */
  immersive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isEs = locale === "es";
  const expert = resolveExpert({ module: context.module });

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700"
        >
          <LivingGuideAvatar state="idle" size={22} initial={expert.presentation.initial} accent={expert.presentation.accent} />
          {isEs ? `Habla con ${expert.displayName}` : `Talk to ${expert.displayName}`}
          <Sparkles className="h-3.5 w-3.5 opacity-80" />
        </button>
      )}

      {/* Immersive experience (default) */}
      {open && immersive && (
        <IsabellaExperience locale={locale} baseContext={context} onClose={() => setOpen(false)} />
      )}

      {/* Classic slide-over (back-compat fallback) */}
      {open && !immersive && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-border shadow-2xl">
            <LivingGuidePanel locale={locale} context={context} onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
