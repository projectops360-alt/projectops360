"use client";

import { AlertTriangle, ArrowRight, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleGuidance, ModuleKey } from "@/features/navigator/navigatorContent";
import { NavigatorChecklist } from "@/components/navigator/NavigatorChecklist";

interface ModuleGuidanceCardProps {
  guidance: ModuleGuidance;
  chrome: {
    whatThisModuleDoes: string;
    whyItMatters: string;
    whatToDoFirst: string;
    whatToComplete: string;
    aiAssistance: string;
    commonMistakes: string;
    recommendedNextAction: string;
    relatedModules: string;
  };
  /** Title lookup for related modules (by moduleKey). */
  relatedTitles: Partial<Record<ModuleKey, string>>;
  /** Whether a related module has a navigable route. */
  canNavigateTo: (moduleKey: ModuleKey) => boolean;
  onNavigateRelated: (moduleKey: ModuleKey) => void;
  className?: string;
}

function SectionLabel({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

export function ModuleGuidanceCard({
  guidance,
  chrome,
  relatedTitles,
  canNavigateTo,
  onNavigateRelated,
  className,
}: ModuleGuidanceCardProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {/* Purpose + why */}
      <div className="space-y-3">
        <div>
          <SectionLabel icon={Target}>{chrome.whatThisModuleDoes}</SectionLabel>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{guidance.purpose}</p>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{chrome.whyItMatters}:</span>{" "}
          {guidance.whyItMatters}
        </p>
      </div>

      {/* What to do first */}
      {guidance.whatToDoFirst.length > 0 && (
        <div>
          <SectionLabel icon={Target}>{chrome.whatToDoFirst}</SectionLabel>
          <ol className="mt-2 space-y-1.5">
            {guidance.whatToDoFirst.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Checklist */}
      {guidance.checklist.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <SectionLabel icon={Target}>{chrome.whatToComplete}</SectionLabel>
          <div className="mt-2">
            <NavigatorChecklist items={guidance.checklist} />
          </div>
        </div>
      )}

      {/* AI assistance */}
      {guidance.aiAssistance && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              {chrome.aiAssistance}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">{guidance.aiAssistance}</p>
        </div>
      )}

      {/* Common mistakes */}
      {guidance.commonMistakes && guidance.commonMistakes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {chrome.commonMistakes}
            </span>
          </div>
          <ul className="mt-2 space-y-1.5">
            {guidance.commonMistakes.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                <span className="leading-relaxed">{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended next action */}
      <div className="rounded-xl border border-border bg-card p-3">
        <SectionLabel icon={Target}>{chrome.recommendedNextAction}</SectionLabel>
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-foreground">{guidance.nextAction}</p>
      </div>

      {/* Related modules */}
      {guidance.relatedModules.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {chrome.relatedModules}
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {guidance.relatedModules.map((rel) => {
              const title = relatedTitles[rel.moduleKey];
              if (!title) return null;
              const enabled = canNavigateTo(rel.moduleKey);
              return (
                <button
                  key={rel.moduleKey}
                  type="button"
                  disabled={!enabled}
                  onClick={() => enabled && onNavigateRelated(rel.moduleKey)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    enabled
                      ? "border-border bg-card text-foreground hover:border-brand-400 hover:text-brand-700"
                      : "border-border bg-muted/40 text-muted-foreground/70",
                  )}
                >
                  {title}
                  {enabled && <ArrowRight className="h-3 w-3 text-brand-600" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}