"use client";

// ============================================================================
// ProjectOps360° Navigator — contextual right-side guidance drawer
// ============================================================================
// Renders different content based on the current route:
//   • A known module → module guidance + lifecycle map + actions.
//   • An unknown / org-level route → full lifecycle overview.
// Not a PDF, not a static manual — a guided execution companion.
// ============================================================================

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { X, Compass, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/types/database";
import {
  getCurrentNavigatorModule,
  getNavigatorContent,
  getModuleGuidance,
  getModuleTitle,
  getLifecycleState,
  getNextModuleKey,
  getModuleRoute,
  extractProjectId,
  toNavigatorLanguage,
  type ModuleKey,
} from "@/features/navigator/navigatorContent";
import { useNavigatorProgress } from "@/components/navigator/use-navigator-progress";
import { GuidedOnboardingProgress } from "@/components/navigator/GuidedOnboardingProgress";
import { ProjectLifecycleMap } from "@/components/navigator/ProjectLifecycleMap";
import { ModuleGuidanceCard } from "@/components/navigator/ModuleGuidanceCard";
import { NavigatorActions } from "@/components/navigator/NavigatorActions";

interface ProjectOpsNavigatorDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ProjectOpsNavigatorDrawer({ open, onClose }: ProjectOpsNavigatorDrawerProps) {
  const locale = useLocale() as Locale;
  const language = toNavigatorLanguage(locale);
  const pathname = usePathname();
  const router = useRouter();
  const { completed, toggleStep } = useNavigatorProgress();

  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const showMeHowRef = useRef<HTMLElement>(null);
  const panelId = useId();
  const [showMeHow, setShowMeHow] = useState(false);

  // Portal target — only available after mount (and lets the fixed overlay
  // escape the header's backdrop-filter containing block).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The "Show me how" toggle lives in the footer but reveals the step-by-step
  // up in the body — scroll it into view so the user sees it appear.
  useEffect(() => {
    if (showMeHow) {
      showMeHowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showMeHow]);

  // Reset "Show me how" whenever the contextual module changes.
  const moduleKey: ModuleKey = getCurrentNavigatorModule(pathname);
  useEffect(() => {
    setShowMeHow(false);
  }, [moduleKey]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open + move focus to the panel.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the close button (stable, always present) for keyboard users.
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
    };
  }, [open]);

  if (!open || !mounted) return null;

  const projectId = extractProjectId(pathname);
  const { content, guidance } = getNavigatorContent(language, moduleKey);
  const { views } = getLifecycleState(language, moduleKey, completed);
  const chrome = content.chrome;

  const totalSteps = content.lifecycle.steps.length;
  const doneCount = views.filter((v) => v.state === "completed").length;

  const nextModuleKey = guidance ? getNextModuleKey(language, moduleKey) : null;
  const nextTitle = nextModuleKey ? getModuleTitle(language, nextModuleKey) : null;
  const nextRoute = nextModuleKey ? getModuleRoute(nextModuleKey, projectId) : null;

  function navigateToModule(target: ModuleKey) {
    const route = getModuleRoute(target, projectId);
    if (!route) return;
    onClose();
    router.push(route);
  }

  const relatedTitles: Partial<Record<ModuleKey, string>> = {};
  if (guidance) {
    for (const rel of guidance.relatedModules) {
      const title = getModuleTitle(language, rel.moduleKey);
      if (title) relatedTitles[rel.moduleKey] = title;
    }
  }
  const canNavigateTo = (target: ModuleKey) => Boolean(getModuleRoute(target, projectId));

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${panelId}-title`}
    >
      <div
        ref={panelRef}
        id={panelId}
        className="flex h-full w-full flex-col bg-background shadow-2xl sm:max-w-md"
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <h2 id={`${panelId}-title`} className="text-base font-semibold text-foreground">
                {chrome.drawerTitle}
              </h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{chrome.drawerSubtitle}</p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label={chrome.close}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Section 1 — Where you are */}
          <section aria-labelledby={`${panelId}-where`} className="mb-5">
            <h3 id={`${panelId}-where`} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {chrome.whereYouAre}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                {guidance ? guidance.title : chrome.lifecycleCurrent}
              </span>
            </div>
          </section>

          {/* Section 2 — Lifecycle map (always visible) */}
          <section aria-labelledby={`${panelId}-lifecycle`} className="mb-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 id={`${panelId}-lifecycle`} className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <MapIcon className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                {chrome.projectLifecycle}
              </h3>
            </div>
            {!guidance && (
              <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                {content.lifecycle.overviewDescription}
              </p>
            )}
            <GuidedOnboardingProgress
              done={doneCount}
              total={totalSteps}
              label={chrome.progress(doneCount, totalSteps)}
              className="mb-3"
            />
            <ProjectLifecycleMap
              views={views}
              onToggleStep={toggleStep}
              markCompleteLabel={chrome.markComplete}
              markIncompleteLabel={chrome.markIncomplete}
              completedLabel={chrome.completed}
              currentLabel={chrome.current}
              upcomingLabel={chrome.upcoming}
            />
          </section>

          {/* Section 3 — Module guidance (contextual) */}
          {guidance ? (
            <>
              <section aria-labelledby={`${panelId}-module`} className="mb-5 border-t border-border pt-5">
                <h3 id={`${panelId}-module`} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {chrome.whatThisModuleDoes}
                </h3>
                <div className="mt-3">
                  <ModuleGuidanceCard
                    guidance={guidance}
                    chrome={{
                      whatThisModuleDoes: chrome.whatThisModuleDoes,
                      whyItMatters: chrome.whyItMatters,
                      whatToDoFirst: chrome.whatToDoFirst,
                      whatToComplete: chrome.whatToComplete,
                      aiAssistance: chrome.aiAssistance,
                      commonMistakes: chrome.commonMistakes,
                      recommendedNextAction: chrome.recommendedNextAction,
                      relatedModules: chrome.relatedModules,
                    }}
                    relatedTitles={relatedTitles}
                    canNavigateTo={canNavigateTo}
                    onNavigateRelated={navigateToModule}
                  />
                </div>
              </section>

              {/* Section 4 — Show me how (collapsible step-by-step) */}
              {showMeHow && guidance.whatToDoFirst.length > 0 && (
                <section ref={showMeHowRef} className="mb-5 scroll-mt-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
                  <h3 className="text-sm font-semibold text-foreground">{chrome.showMeHowTitle}</h3>
                  <ol className="mt-2 space-y-2">
                    {guidance.whatToDoFirst.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                          {i + 1}
                        </span>
                        <span className="pt-0.5 leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          ) : (
            <section className="mb-5 border-t border-border pt-5">
              <p className="text-sm leading-relaxed text-muted-foreground">{chrome.notInProject}</p>
            </section>
          )}
        </div>

        {/* ── Footer actions ── */}
        {guidance && (
          <div className="border-t border-border px-5 py-4">
            <NavigatorActions
              continueLabel={chrome.continueInModule}
              showMeHowLabel={chrome.showMeHow}
              askAiGuideLabel={chrome.askAiGuide}
              aiGuideComingSoonLabel={chrome.aiGuideComingSoon}
              goToModuleLabel={chrome.goToModule}
              nextModuleTitle={nextTitle}
              nextRoute={nextRoute}
              showMeHowOpen={showMeHow}
              onToggleShowMeHow={() => setShowMeHow((v) => !v)}
              onContinue={onClose}
              onGoToModule={() => nextModuleKey && navigateToModule(nextModuleKey)}
            />
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}