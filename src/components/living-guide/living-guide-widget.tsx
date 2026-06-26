"use client";

// ============================================================================
// Living Guide™ — Floating widget launcher
// ============================================================================
// A clean floating assistant / side panel for Phase 1. The panel content and
// the presentation avatar are separate components, so an immersive/hologram
// mode can be swapped in later without changing the launcher or the knowledge
// engine.
// ============================================================================

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Locale } from "@/types/database";
import type { GuideContext } from "@/lib/knowledge-os/types";
import { resolveExpert } from "@/lib/knowledge-os/experts";
import { LivingGuidePanel } from "./living-guide-panel";
import { LivingGuideAvatar } from "./living-guide-avatar";

export function LivingGuideWidget({
  locale,
  context,
}: {
  locale: Locale;
  context: GuideContext;
}) {
  const [open, setOpen] = useState(false);
  const isEs = locale === "es";
  // The Living Guide is the shell; the active expert (Isabella by default) is
  // who the user actually meets.
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
          {isEs ? `Pregúntale a ${expert.displayName}` : `Ask ${expert.displayName}`}
          <Sparkles className="h-3.5 w-3.5 opacity-80" />
        </button>
      )}

      {/* Slide-over panel */}
      {open && (
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
