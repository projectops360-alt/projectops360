"use client";

// ============================================================================
// ProjectOps360° — Living Graph overlay clarity card (Sprint #3)
// ============================================================================
// A compact, dismissible card that makes an advanced overlay self-explanatory:
// what it is (purpose), what data it needs, why nodes appear / are disconnected
// (empty / incomplete states), what to do next (userAction), and an
// overlay-specific legend. Lightweight by design — collapses to a small chip so
// it never steals graph space. All content is deterministic metadata
// (overlay-metadata.ts); nothing is invented.
// ============================================================================

import { useState } from "react";
import { Info, X, ChevronRight, ArrowRight } from "lucide-react";
import type { Locale } from "@/types/database";
import { getI18nValue } from "@/types/database";
import {
  OVERLAY_META,
  type OverlayDataState,
  type OverlaySignals,
} from "@/lib/graph/overlay-metadata";
import type { LivingGraphOverlay } from "@/types/living-graph";

export function OverlayInfo({
  overlay,
  state,
  signals,
  locale,
  projectId,
  onNavigate,
}: {
  overlay: LivingGraphOverlay;
  state: OverlayDataState;
  signals: OverlaySignals;
  locale: Locale;
  projectId: string;
  onNavigate: (href: string) => void;
}) {
  const meta = OVERLAY_META[overlay];
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  if (!meta || dismissed) return null;

  const tr = (f: { en?: string; es?: string }) => getI18nValue(f, locale);
  const label = tr(meta.label_i18n);

  // Collapsed → a small chip the user can re-open.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute left-1/2 top-3 z-20 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card/95 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-md backdrop-blur transition-colors hover:bg-muted"
      >
        <Info className="h-3.5 w-3.5 text-brand-500" aria-hidden />
        {label}
        <ChevronRight className="h-3 w-3" aria-hidden />
      </button>
    );
  }

  const accent =
    state === "empty" ? "border-amber-500/50" : state === "incomplete" ? "border-amber-400/40" : "border-border";

  return (
    <div
      className={`absolute left-1/2 top-3 z-20 w-[420px] max-w-[calc(100%-1.5rem)] -translate-x-1/2 overflow-hidden rounded-xl border ${accent} bg-card/95 shadow-xl backdrop-blur`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Info className="h-3.5 w-3.5 text-brand-500" aria-hidden />
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={locale === "es" ? "Minimizar" : "Minimize"}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-3.5 w-3.5 rotate-90" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label={locale === "es" ? "Cerrar" : "Close"}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="space-y-2 px-3 py-2.5 text-[11px] leading-relaxed">
        {/* 1. What am I looking at? */}
        <p className="text-foreground/90">{tr(meta.purpose_i18n)}</p>

        {/* 2. Why are nodes here / what's missing? */}
        {state === "empty" ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
            <p className="font-semibold">{tr(meta.emptyTitle_i18n)}</p>
            <p className="mt-0.5">{tr(meta.emptyDescription_i18n)}</p>
          </div>
        ) : state === "incomplete" ? (
          <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-2 text-amber-700 dark:text-amber-300">
            {tr(meta.incompleteMessage_i18n)}
            {signals.disconnectedCount > 0 && (
              <span className="ml-1 font-medium">({signals.disconnectedCount})</span>
            )}
          </p>
        ) : null}

        {/* Data requirements */}
        <p className="text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide text-[9px]">
            {locale === "es" ? "Necesita" : "Needs"}:
          </span>{" "}
          {tr(meta.dataRequirements_i18n)}
        </p>

        {/* 3. What should I do next? */}
        <p className="text-foreground/90">
          <span className="font-semibold uppercase tracking-wide text-[9px] text-brand-600 dark:text-brand-400">
            {locale === "es" ? "Qué hacer" : "Do next"}:
          </span>{" "}
          {tr(meta.userAction_i18n)}
        </p>

        {/* Overlay-specific legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2">
          {meta.legend.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden />
              {tr(item.label_i18n)}
            </span>
          ))}
        </div>

        {/* Optional CTA (e.g. Variance → Delivery Framework) */}
        {meta.cta?.href && (
          <button
            type="button"
            onClick={() => onNavigate(meta.cta!.href!(projectId))}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {tr(meta.cta.label_i18n)}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
